"""API de l'application enquêteur (phase 8) : activation par code de mission, session par jeton (en-tête Authorization,
jamais de cookie : pas de CSRF possible), mission et formulaire, réception des fiches par lots (idempotente),
métadonnées et photos à part, signalements ; console usine : création et révocation des missions.

Une fiche arrive comme une réponse de Google Forms (titres « Qn. … », libellés des modalités) : elle passe ensuite par la
même codification que la V1 (N° de fiche, anomalies, statut qualité), sans code de collecte particulier.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from plateforme.api import audit, securite
from plateforme.api.contexte import Config, chemin_sur, etat
from plateforme.codification.fiche import ParametresCodification
from plateforme.codification.reponses import ItemReponse, ReponseBrute
from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion
from plateforme.projet import projet as pj
from plateforme.stockage import synchro
from plateforme.stockage.modeles import (
    FicheCodeeBD,
    MetaFiche,
    Mission,
    Photo,
    Projet,
    ReponseBruteBD,
    SessionTerrain,
    Signalement,
)

DUREE_JETON = timedelta(days=45)
PHOTO_MAX = 1_500_000                       # octets, après compression sur le téléphone
LOT_MAX = 100


def nouveau_code() -> str:
    """Code de mission : 20 caractères en base 32 (100 bits), groupés par 4 pour la saisie ; imprimé en QR."""
    brut = base64.b32encode(secrets.token_bytes(13)).decode()[:20]
    return "-".join(brut[i:i + 4] for i in range(0, 20, 4))


def empreinte_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().replace(" ", "").encode()).hexdigest()


# ------------------------------------------------------------------------------------------------ schémas
class Activation(BaseModel):
    code: str = Field(min_length=8, max_length=40)


class ItemFiche(BaseModel):
    titre: str = Field(max_length=500)
    valeur: str | list[str] | None = None
    lignes: list[str] | None = None


class Position(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    precision_m: int | None = Field(default=None, ge=0, le=100_000)


class FicheTerrain(BaseModel):
    id: str = Field(min_length=8, max_length=80, description="Identifiant créé sur le téléphone (clé d'idempotence)")
    debut: datetime
    fin: datetime
    items: list[ItemFiche] = Field(max_length=400)
    position: Position | None = None
    photo_jpeg: str | None = Field(default=None, description="Photo du point de vente, JPEG en base 64")


class Lot(BaseModel):
    fiches: list[FicheTerrain] = Field(max_length=LOT_MAX)


class NouveauSignalement(BaseModel):
    type: str = Field(pattern=r"^(probleme_terrain|refus|securite|materiel|autre)$")
    texte: str = Field(min_length=3, max_length=2000)


class Revocation(BaseModel):
    actif: bool


# ------------------------------------------------------------------------------------------------ authentification
class Terrain:
    def __init__(self, mission: Mission, session: Session) -> None:
        self.mission, self.session = mission, session


def _bd_terrain(request: Request) -> Any:
    """Session de base du terrain : jeton (en-tête Authorization) → mission active → contexte RLS de son organisation."""
    entete = request.headers.get("Authorization", "")
    if not entete.startswith("Bearer "):
        raise HTTPException(401, "jeton de mission absent")
    e = etat(request)
    with e.sessions() as s, s.begin():
        st = s.get(SessionTerrain, securite.empreinte(entete[7:].strip()))
        m = s.get(Mission, st.mission_id) if st else None
        if st is None or m is None or st.expire_le < securite.maintenant():
            raise HTTPException(401, "session de terrain expirée : réactiver la mission")
        if not m.actif:
            raise HTTPException(403, "mission révoquée par l'usine")
        s.execute(text("SELECT set_config('app.organisation_id', :o, true), set_config('app.usine', 'non', true)"),
                  {"o": str(m.organisation_id)})
        yield Terrain(m, s)


BDTerrain = Annotated[Terrain, Depends(_bd_terrain, scope="function")]


def _contexte_projet(cfg: Config, p: Projet) -> pj.Projet:
    return pj.charger(chemin_sur(cfg, p.dossier))


def _formulaire(d: Dictionnaire, enqueteur: str, ville: str) -> dict[str, Any]:
    """Formulaire à rendre sur le téléphone. Chaque champ porte le TITRE de référence (celui que la codification
    reconnaît) et ses libellés par langue ; une réponse est envoyée dans la langue de référence."""
    langues = d.langues
    champs: list[dict[str, Any]] = []
    for ident in d.identification:
        champ: dict[str, Any] = {"cle": ident.role.value, "titre": d.texte(ident.libelles), "libelles": {lg: d.texte(ident.libelles, lg) for lg in langues},
                 "type": ident.type.value, "obligatoire": ident.obligatoire, "section": "identification",
                 "options": [{"valeur": d.texte(m.libelles), "libelles": {lg: d.texte(m.libelles, lg) for lg in langues}} for m in ident.modalites],
                 "donnee_personnelle": ident.donnee_personnelle, "aide": {lg: d.texte(ident.aide, lg) for lg in langues} if ident.aide else {}}
        if ident.role.value == "enqueteur":
            champ.update(type="fixe", valeur_fixe=enqueteur, options=[])
        champs.append(champ)
    cible = d.question_cible()
    for q in d.questions:
        champ = {"cle": q.code, "titre": d.titre_question(q), "libelles": {lg: d.titre_question(q, lg) for lg in langues},
                 "type": q.type.value, "obligatoire": q.obligatoire or (cible is not None and q.code == cible.code),
                 "section": q.section, "condition": q.condition,
                 "options": [{"valeur": d.texte(m.libelles), "libelles": {lg: d.texte(m.libelles, lg) for lg in langues}} for m in q.modalites],
                 "autre": {lg: d.texte(q.autre.libelles, lg) for lg in langues} if q.autre else None,
                 "lignes": [{"valeur": d.texte(li.libelles), "libelles": {lg: d.texte(li.libelles, lg) for lg in langues}} for li in q.lignes]
                 if q.type is TypeQuestion.GRILLE else []}
        if q.prerempli == "ville":
            champ.update(type="fixe", valeur_fixe=ville, options=[])
        champs.append(champ)
    return {"langues": langues, "titre": {lg: d.texte(d.titre, lg) for lg in langues},
            "sections": [{"id": s.id, "libelles": {lg: d.texte(s.libelles, lg) for lg in langues}} for s in d.sections],
            "champs": champs}


# ------------------------------------------------------------------------------------------------ routeur
def routeur(cfg: Config) -> APIRouter:
    r = APIRouter()

    @r.post("/api/terrain/activation")
    def activation(d: Activation, request: Request) -> dict[str, Any]:
        with etat(request).sessions() as s, s.begin():
            m = s.scalar(select(Mission).where(Mission.code_empreinte == empreinte_code(d.code)))
            if m is None or not m.actif:
                raise HTTPException(401, "code de mission inconnu ou révoqué")
            jeton = securite.jeton()
            s.add(SessionTerrain(empreinte=securite.empreinte(jeton), mission_id=m.id, expire_le=securite.maintenant() + DUREE_JETON))
            audit.journaliser(s, "mission_activee", m.enqueteur, organisation_id=m.organisation_id)
            return {"jeton": jeton, "enqueteur": m.enqueteur}

    @r.get("/api/terrain/mission")
    def mission(t: BDTerrain) -> dict[str, Any]:
        p = t.session.get(Projet, t.mission.projet_id)
        assert p is not None
        projet = _contexte_projet(cfg, p)
        terrain, pe, d = projet.exiger_terrain(), projet.exiger_echantillonnage(), projet.dictionnaire
        poste = next((e for e in terrain.enqueteurs if e.id == t.mission.enqueteur), None)
        if poste is None or poste.ville is None:
            raise HTTPException(409, "poste absent du plan de terrain")
        ville = terrain.ville(poste.ville)
        q_ville = next(q.code for q in d.questions if q.prerempli == "ville")
        realises: dict[int, int] = {}
        for valeurs in t.session.scalars(select(FicheCodeeBD.valeurs).where(FicheCodeeBD.projet_id == p.id,
                                                                            FicheCodeeBD.statut != "REJETE")):
            c, v = valeurs.get(pe.variable_cible), valeurs.get(q_ville)
            if c not in (None, "") and str(v) == str(ville.code):
                realises[int(c)] = realises.get(int(c), 0) + 1
        miennes = int(t.session.scalar(select(func.count()).select_from(MetaFiche).where(MetaFiche.mission_id == t.mission.id)) or 0)
        aujourdhui = datetime.now(UTC).date()
        du_jour = int(t.session.scalar(select(func.count()).select_from(MetaFiche).where(
            MetaFiche.mission_id == t.mission.id, func.date(MetaFiche.recue_le) == aujourdhui)) or 0)
        return {
            "etude": projet.brief.titre, "enqueteur": t.mission.enqueteur, "ville": {"code": ville.code, "libelle": ville.libelle},
            "zones": [{"libelle": z.libelle, "lieux": [projet.referentiel.localite(x).nom for x in z.localites]} for z in terrain.zones_de(poste)],
            "objectif_jour": terrain.objectif_jour, "jours": [j.isoformat() for j in terrain.jours_ouvres()],
            "quotas": [{"cible": q.cible, "quota": q.villes.get(ville.id, 0), "realise": realises.get(q.code, 0),
                        "reste": max(0, q.villes.get(ville.id, 0) - realises.get(q.code, 0))} for q in pe.quotas],
            "mes_fiches": {"total": miennes, "recues_aujourdhui": du_jour},
            "formulaire": _formulaire(d, t.mission.enqueteur, ville.libelle),
            "mention_gps": "Position approximative enregistrée à l'envoi, réservée au contrôle qualité (jamais transmise au client).",
            "consigne_photo": "Photo facultative du point de vente uniquement : ne jamais photographier une personne.",
        }

    @r.post("/api/terrain/fiches")
    def fiches(lot: Lot, t: BDTerrain) -> dict[str, Any]:
        p = t.session.get(Projet, t.mission.projet_id)
        assert p is not None
        projet = _contexte_projet(cfg, p)
        terrain, d = projet.exiger_terrain(), projet.dictionnaire
        poste = next(e for e in terrain.enqueteurs if e.id == t.mission.enqueteur)
        ville = terrain.ville(poste.ville or "")
        titre_enq = next((d.texte(i.libelles) for i in d.identification if i.role.value == "enqueteur"), None)
        q_ville = next((d.titre_question(q) for q in d.questions if q.prerempli == "ville"), None)
        refusees: list[dict[str, str]] = []
        valides: list[tuple[FicheTerrain, ReponseBrute]] = []
        for f in lot.fiches:
            items = {i.titre: i.valeur for i in f.items}
            # le téléphone ne peut pas écrire pour un autre poste ou une autre ville que sa mission
            if (titre_enq and items.get(titre_enq) != t.mission.enqueteur) or (q_ville and items.get(q_ville) != ville.libelle):
                refusees.append({"id": f.id, "motif": "enquêteur ou ville différents de la mission"})
                continue
            if f.fin < f.debut:
                refusees.append({"id": f.id, "motif": "fin d'entretien avant son début"})
                continue
            valides.append((f, ReponseBrute(f.id, f.fin, tuple(ItemReponse(i.titre, i.valeur, tuple(i.lignes) if i.lignes else None)
                                                                for i in f.items), source=f"APPLI:{t.mission.enqueteur}")))
        res = synchro.recevoir(t.session, p, [rb for _, rb in valides], source=f"APPLI:{t.mission.enqueteur}")
        ids = dict(t.session.execute(select(ReponseBruteBD.id_externe, ReponseBruteBD.id).where(
            ReponseBruteBD.projet_id == p.id, ReponseBruteBD.id_externe.in_([f.id for f, _ in valides]))).all())
        for f, _ in valides:
            if f.id in res.conflits or f.id not in ids:
                continue
            rid = ids[f.id]
            pos = f.position
            t.session.execute(insert(MetaFiche).values(
                reponse_id=rid, organisation_id=p.organisation_id, projet_id=p.id, mission_id=t.mission.id, debut=f.debut,
                duree_s=int((f.fin - f.debut).total_seconds()),
                latitude=round(pos.latitude, 4) if pos else None, longitude=round(pos.longitude, 4) if pos else None,  # ≈ 11 m
                precision_m=pos.precision_m if pos else None).on_conflict_do_nothing(index_elements=["reponse_id"]))
            if f.photo_jpeg:
                try:
                    contenu = base64.b64decode(f.photo_jpeg, validate=True)
                except (binascii.Error, ValueError):
                    refusees.append({"id": f.id, "motif": "photo illisible (fiche reçue sans photo)"})
                    continue
                if not contenu.startswith(b"\xff\xd8") or len(contenu) > PHOTO_MAX:
                    refusees.append({"id": f.id, "motif": "photo refusée : JPEG de 1,5 Mo au plus (fiche reçue sans photo)"})
                    continue
                rel = Path(str(p.organisation_id)) / p.code / "photos" / f"{rid}.jpg"
                chemin = chemin_sur(cfg, str(rel))
                chemin.parent.mkdir(parents=True, exist_ok=True)
                chemin.write_bytes(contenu)
                t.session.execute(insert(Photo).values(id=uuid.uuid4(), organisation_id=p.organisation_id, projet_id=p.id, reponse_id=rid,
                                                       fichier=str(rel), octets=len(contenu), empreinte=hashlib.sha256(contenu).hexdigest())
                                  .on_conflict_do_nothing(index_elements=["reponse_id"]))
        if res.nouvelles:
            params = ParametresCodification(villes=terrain.villes_masque(), enqueteurs={e.id: e.ville or "" for e in terrain.enqueteurs},
                                            seuil_delai_min=terrain.seuil_delai_min, fuseau=terrain.fuseau)
            synchro.coder(t.session, p, d, params)
        return {"nouvelles": res.nouvelles, "deja_recues": res.deja_recues,
                "refusees": refusees + [{"id": i, "motif": "contenu différent d'un envoi précédent (fiche immuable)"} for i in res.conflits],
                "acceptees": [f.id for f, _ in valides if f.id not in res.conflits]}

    @r.post("/api/terrain/signalements")
    def signalement(d: NouveauSignalement, t: BDTerrain) -> dict[str, str]:
        t.session.add(Signalement(organisation_id=t.mission.organisation_id, projet_id=t.mission.projet_id, mission_id=t.mission.id,
                                  type=d.type, texte=d.texte))
        return {"etat": "transmis"}

    return r
