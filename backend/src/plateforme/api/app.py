"""Application FastAPI : authentification, espace client, console usine, sécurité (en-têtes, CSRF, limites)."""

from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable, Iterator
from datetime import UTC, date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from typing import Annotated, Any

import yaml
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from plateforme.analyse.croisement import CroisementRefuse, Demande, Garde, croiser
from plateforme.api import audit, donnees, securite, terrain
from plateforme.api.contexte import (
    COOKIE,
    Config,
    Courant,
    Etat,
    bd_auth,
    bd_contexte,
    chemin_sur,
    courant,
    exiger_complet,
    utilisateur_par_email,
    uuid_ou_404,
)
from plateforme.api.terrain import Revocation
from plateforme.stockage.modeles import (
    Abonnement,
    CroisementBD,
    Facture,
    Formule,
    Livrable,
    Organisation,
    Paiement,
    Projet,
    SessionWeb,
    Utilisateur,
)

METHODES_SURES = {"GET", "HEAD", "OPTIONS"}
SANS_CSRF = {"/api/auth/connexion"}
PREFIXE_TERRAIN = "/api/terrain/"      # jeton en en-tête Authorization, jamais de cookie : pas de CSRF possible
LIMITEES = {"/api/auth/connexion", "/api/terrain/activation"}
EN_TETES = {
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; "
                               "base-uri 'self'; form-action 'self'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(self)",      # application enquêteur : GPS et photo
    "Cross-Origin-Opener-Policy": "same-origin",
}


# ------------------------------------------------------------------------------------------------ dépendances
def _client(c: Annotated[Courant, Depends(courant)]) -> Courant:
    return exiger_complet(c)


def _usine(c: Annotated[Courant, Depends(courant)]) -> Courant:
    c = exiger_complet(c)
    if not c.usine:
        raise HTTPException(403, "réservé à l'usine")
    return c


def _bd(request: Request, c: Annotated[Courant, Depends(_client)]) -> Iterator[Session]:
    yield from bd_contexte(request, c)


def _bd_usine(request: Request, c: Annotated[Courant, Depends(_usine)]) -> Iterator[Session]:
    yield from bd_contexte(request, c)


Client = Annotated[Courant, Depends(_client)]
Usine = Annotated[Courant, Depends(_usine)]
# scope="function" : la transaction est validée (ou échoue, visiblement) AVANT l'envoi de la réponse. Par défaut, FastAPI
# fermerait la dépendance APRÈS l'envoi : le navigateur pourrait relire avant la validation, et un échec de validation
# serait masqué derrière un 200 (défaut trouvé par les tests de bout en bout).
BD = Annotated[Session, Depends(_bd, scope="function")]
BDUsine = Annotated[Session, Depends(_bd_usine, scope="function")]
BDAuth = Annotated[Session, Depends(bd_auth, scope="function")]


# ------------------------------------------------------------------------------------------------ schémas
class Connexion(BaseModel):
    email: str = Field(max_length=254)
    mot_de_passe: str = Field(max_length=200)


class CodeTotp(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class DemandeCroisement(BaseModel):
    ligne: str = Field(max_length=64)
    colonne: str = Field(max_length=64)
    filtre: str = Field(default="", max_length=300)
    poids: str | None = Field(default=None, max_length=64)


class NouveauBrief(BaseModel):
    titre: str = Field(min_length=3, max_length=200)
    besoin: str = Field(min_length=3, max_length=2000)
    antecedents: str = Field(default="", max_length=3000)
    marche: str = Field(default="", max_length=5000)
    produits: str = Field(default="", max_length=5000)
    attentes: str = Field(default="", max_length=5000)
    objectifs: list[str] = Field(min_length=1, max_length=10)
    cibles: list[str] = Field(min_length=1, max_length=10)
    villes: list[str] = Field(min_length=1, max_length=20)
    taille: int = Field(ge=30, le=20000)
    debut: date
    echeance: date


class NouvelleOrganisation(BaseModel):
    nom: str = Field(min_length=2, max_length=200)
    admin_email: str = Field(max_length=254)
    admin_nom: str = Field(max_length=200)
    mot_de_passe: str = Field(max_length=200)
    formule: str | None = None


class NouvelleFacture(BaseModel):
    organisation_id: uuid.UUID
    lignes: list[tuple[str, float]] = Field(min_length=1)


class NouveauPaiement(BaseModel):
    montant: float = Field(gt=0)
    moyen: str = Field(pattern=r"^(virement|mobile_money|especes)$")
    reference: str = Field(default="", max_length=120)


class Partage(BaseModel):
    partage_client: bool


class ValidationProjet(BaseModel):
    commentaire: str = Field(default="", max_length=2000)
    version: str = Field(default="", max_length=40)
    regle: str = Field(default="", max_length=120)


class VersionProjet(BaseModel):
    type: str = Field(pattern=r"^(brief|questionnaire|dictionnaire|echantillonnage|terrain|analyse|rapport)$")
    commentaire: str = Field(default="", max_length=2000)
    source: str = Field(default="", max_length=2000)


class QuotaEntree(BaseModel):
    code: int
    cible: str = Field(min_length=1, max_length=120)
    villes: dict[str, int] = Field(max_length=100)


class PlanEchantillonnageEntree(BaseModel):
    version: str = Field(max_length=20, description="Version lue : refus si le plan a changé entre-temps")
    methode: str = Field(pattern=r"^(quotas|aleatoire|stratifie)$")
    taille: dict[str, Any] | None = None
    quotas: list[QuotaEntree] = Field(min_length=1, max_length=50)


class DictionnaireEntree(BaseModel):
    version: str = Field(max_length=20, description="Version lue : refus si le dictionnaire a changé entre-temps")
    dictionnaire: dict[str, Any]


class QuestionAssistant(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    projet: str | None = None

class MemoAssistant(BaseModel):
    projet: str
    type: str = Field(pattern=r"^(note|decision|preuve|limite)$")
    contenu: str = Field(min_length=2, max_length=4000)

class ProcedureAnalyse(BaseModel):
    methode: str = Field(pattern=r"^(tri_plat|croisement|comparaison|regression|acp|classification)$")
    variable: str = Field(default="", max_length=120)
    filtre: str = Field(default="", max_length=500)

class RecommandationProjet(BaseModel):
    constat: str = Field(min_length=3, max_length=1000)
    preuve: str = Field(min_length=2, max_length=1000)
    action: str = Field(min_length=3, max_length=1000)
    risque: str = Field(default="", max_length=500)
    priorite: str = Field(default="moyenne", pattern=r"^(basse|moyenne|haute)$")

class DecisionRecommandation(BaseModel):
    decision: str = Field(pattern=r"^(validee|rejetee)$")
    commentaire: str = Field(default="", max_length=2000)
    preuve: str = Field(default="", max_length=1000)


# ------------------------------------------------------------------------------------------------ outils
def _moi(u: Utilisateur, o: Organisation, sw: SessionWeb) -> dict[str, Any]:
    return {"id": str(u.id), "nom": u.nom, "email": u.email, "role": u.role, "organisation": o.nom,
            "organisation_type": o.type, "csrf": sw.csrf, "permissions": sorted(securite.permissions(u.role)),
            # Même règle que exiger_complet (contexte.py) : l'interface ne doit jamais croire complète une session que le
            # serveur refuse.
            "second_facteur_requis": u.role in securite.ROLES_USINE and not sw.second_facteur}


def _projet(s: Session, ident: str) -> Projet:
    p = s.get(Projet, uuid_ou_404(ident))                        # RLS : un projet d'un autre client est « introuvable »
    if p is None:
        raise HTTPException(404, "projet introuvable")
    return p


def _garde(p: Projet) -> Garde:
    g = p.parametres.get("garde", {})
    return Garde(base_min=int(g.get("base_min", 30)), k=int(g.get("k", 5)), quotas=bool(g.get("quotas", True)))


def _droits(s: Session, org: uuid.UUID) -> dict[str, Any]:
    ab = s.scalar(select(Abonnement).where(Abonnement.organisation_id == org, Abonnement.statut == "actif"))
    f = s.get(Formule, ab.formule_id) if ab else None
    return {"formule": f.nom if f else None, "type": f.type if f else None, **(f.droits if f else {})}


def _croisements_du_mois(s: Session, org: uuid.UUID) -> int:
    debut = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return int(s.scalar(select(func.count()).select_from(CroisementBD).where(
        CroisementBD.organisation_id == org, CroisementBD.le >= debut, CroisementBD.refuse.is_(False))) or 0)


def _resultat(r: Any) -> dict[str, Any]:
    return {"base": r.base, "lignes": [{"code": c, "libelle": lib} for c, lib in r.lignes],
            "colonnes": [{"code": c, "libelle": lib, "lettre": le} for c, lib, le in r.colonnes], "bases_colonnes": r.bases_colonnes,
            "cellules": [[{"effectif": x.effectif, "pct": None if x.pct is None else round(x.pct, 1), "lettres": x.lettres} for x in li]
                         for li in r.cellules],
            "khi2": None if r.khi2 != r.khi2 else round(r.khi2, 3), "p": None if r.p != r.p else r.p,
            "v_cramer": None if r.v_cramer != r.v_cramer else round(r.v_cramer, 3),
            "avertissements": r.avertissements, "commentaire": r.commentaire, "syntaxe_spss": r.syntaxe_spss}


def _cookie(reponse: Response, valeur: str, cfg: Config, effacer: bool = False) -> None:
    if effacer:
        reponse.delete_cookie(COOKIE, path="/")
        return
    reponse.set_cookie(COOKIE, valeur, httponly=True, secure=cfg.cookie_securise, samesite="strict", path="/",
                       max_age=int(securite.DUREE_SESSION.total_seconds()))


# ------------------------------------------------------------------------------------------------ application
def creer_app(cfg: Config) -> FastAPI:
    app = FastAPI(title="DATA'A", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.dataa = Etat(cfg)
    tentatives: dict[str, deque[float]] = defaultdict(deque)

    @app.middleware("http")
    async def securiser(request: Request, suite: Callable[[Request], Awaitable[Response]]) -> Response:
        if (request.url.path.startswith("/api/") and request.method not in METHODES_SURES and request.url.path not in SANS_CSRF
                and not request.url.path.startswith(PREFIXE_TERRAIN)):
            jeton = request.cookies.get(COOKIE)
            fourni = request.headers.get("X-CSRF-Token", "")
            ok = False
            if jeton and fourni:
                with app.state.dataa.sessions() as s:
                    sw = s.get(SessionWeb, securite.empreinte(jeton))
                    ok = sw is not None and securite.egaux(sw.csrf, fourni)
            if not ok:
                return JSONResponse({"detail": "jeton CSRF absent ou invalide"}, status_code=403)
        if request.url.path in LIMITEES:
            ip = request.client.host if request.client else "?"
            fenetre, maintenant = tentatives[ip], time.monotonic()
            while fenetre and maintenant - fenetre[0] > 600:
                fenetre.popleft()
            if len(fenetre) >= 20:
                return JSONResponse({"detail": "trop de tentatives, réessayez plus tard"}, status_code=429)
            fenetre.append(maintenant)
        reponse = await suite(request)
        for k, v in EN_TETES.items():
            reponse.headers.setdefault(k, v)
        if cfg.cookie_securise:
            reponse.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if request.url.path.startswith("/api/"):
            reponse.headers["Cache-Control"] = "no-store"
        return reponse

    # -------------------------------------------------------------------------------------------- authentification
    def _echec(utilisateur_id: uuid.UUID, action: str, compter: bool) -> None:
        """Échec enregistré dans SA transaction, validée avant le refus : sinon l'erreur annulerait le compteur de
        verrouillage et la ligne d'audit (défaut trouvé par les tests de la phase 7)."""
        with app.state.dataa.sessions() as s2, s2.begin():
            u = s2.get(Utilisateur, utilisateur_id)
            assert u is not None
            if compter:
                u.echecs += 1
                if u.echecs >= securite.ECHECS_MAX:
                    u.bloque_jusqu, u.echecs = securite.maintenant() + securite.DUREE_BLOCAGE, 0
            audit.journaliser(s2, action, u.email, organisation_id=u.organisation_id, utilisateur_id=u.id)

    @app.post("/api/auth/connexion")
    def connexion(d: Connexion, reponse: Response, s: BDAuth) -> dict[str, Any]:
        u = utilisateur_par_email(s, d.email)
        if u is not None and u.bloque_jusqu and u.bloque_jusqu > securite.maintenant():
            raise HTTPException(429, "compte temporairement bloqué après plusieurs échecs")
        if u is None or not u.actif or not securite.verifier(u.hash_mdp, d.mot_de_passe):
            if u is not None:
                _echec(u.id, "connexion_echec", compter=True)
            raise HTTPException(401, "identifiants incorrects")
        u.echecs, u.bloque_jusqu = 0, None
        usine = u.role in securite.ROLES_USINE
        if cfg.double_authentification and usine and not u.totp_secret:
            # Sans secret TOTP, le second facteur exigé partout est impossible : refus clair, aucune session ouverte.
            _echec(u.id, "connexion_refusee_sans_2fa", compter=False)      # journal dans sa propre transaction
            raise HTTPException(403, "double authentification non configurée pour ce compte : demandez à l'administrateur "
                                     "de l'usine de l'activer avant de vous connecter")
        jeton = securite.jeton()
        sw = SessionWeb(empreinte=securite.empreinte(jeton), utilisateur_id=u.id, csrf=securite.jeton(),
                        second_facteur=usine and not cfg.double_authentification, expire_le=securite.expiration())
        s.add(sw)
        # Second facteur désactivé (D-061) : la session usine est complète d'emblée, et le journal le dit.
        audit.journaliser(s, "connexion" if cfg.double_authentification or not usine else "connexion_sans_2fa", u.email,
                          organisation_id=u.organisation_id, utilisateur_id=u.id)
        _cookie(reponse, jeton, cfg)
        o = s.get(Organisation, u.organisation_id)
        assert o is not None
        return _moi(u, o, sw)

    @app.post("/api/auth/totp")
    def totp(d: CodeTotp, request: Request, s: BDAuth, c: Annotated[Courant, Depends(courant)]) -> dict[str, Any]:
        u = s.get(Utilisateur, c.utilisateur.id)
        assert u is not None
        if not u.totp_secret or not securite.verifier_totp(u.totp_secret, d.code):
            _echec(u.id, "totp_echec", compter=True)
            raise HTTPException(401, "code de vérification incorrect")
        sw = s.get(SessionWeb, c.session.empreinte)
        assert sw is not None
        sw.second_facteur = True
        audit.journaliser(s, "totp_ok", u.email, organisation_id=u.organisation_id, utilisateur_id=u.id)
        return _moi(u, c.organisation, sw)

    @app.post("/api/auth/deconnexion")
    def deconnexion(request: Request, reponse: Response, s: BDAuth) -> dict[str, str]:
        jeton = request.cookies.get(COOKIE)
        if jeton:
            sw = s.get(SessionWeb, securite.empreinte(jeton))
            if sw is not None:
                s.delete(sw)
        _cookie(reponse, "", cfg, effacer=True)
        return {"etat": "déconnecté"}

    @app.get("/api/moi")
    def moi(c: Annotated[Courant, Depends(courant)]) -> dict[str, Any]:
        return _moi(c.utilisateur, c.organisation, c.session)

    # -------------------------------------------------------------------------------------------- espace client
    @app.get("/api/projets")
    def projets(c: Client, s: BD) -> list[dict[str, Any]]:
        return [{"id": str(p.id), "code": p.code, "nom": p.nom, "statut": p.statut, "base_disponible": bool(p.base_analyse)}
                for p in s.scalars(select(Projet).order_by(Projet.cree_le))]

    @app.get("/api/projets/{ident}/suivi")
    def suivi(ident: str, c: Client, s: BD) -> dict[str, Any]:
        p = _projet(s, ident)
        if not p.dossier or not p.base_analyse:
            raise HTTPException(409, "suivi indisponible : terrain non démarré")
        return donnees.suivi(chemin_sur(cfg, p.dossier), donnees.jeu(chemin_sur(cfg, p.base_analyse)))

    @app.get("/api/projets/{ident}/variables")
    def variables(ident: str, c: Client, s: BD) -> list[dict[str, Any]]:
        p = _projet(s, ident)
        if not p.base_analyse:
            raise HTTPException(409, "base d'analyse non livrée")
        return donnees.variables(donnees.jeu(chemin_sur(cfg, p.base_analyse)))

    @app.get("/api/projets/{ident}/tri-plats")
    def tri_plat(ident: str, variable: str, c: Client, s: BD) -> dict[str, Any]:
        p = _projet(s, ident)
        if not p.base_analyse:
            raise HTTPException(409, "base d'analyse non livrée")
        jd = donnees.jeu(chemin_sur(cfg, p.base_analyse))
        if variable not in jd.table.columns:
            raise HTTPException(422, "variable inconnue")
        serie = jd.table[variable].dropna().value_counts(dropna=False)
        total = int(serie.sum())
        return {"variable": variable, "base": total, "lignes": [{"modalite": str(k), "effectif": int(v), "pourcentage": round(float(v) * 100 / total, 2)} for k, v in serie.items()], "avertissements": ["Les modalités rares doivent être interprétées avec prudence."]}

    @app.post("/api/projets/{ident}/croisements")
    def croisement(ident: str, d: DemandeCroisement, c: Client, s: BD) -> JSONResponse:
        if not c.usine and "croisement.executer" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "permission insuffisante pour calculer un croisement")
        p = _projet(s, ident)
        if not p.base_analyse:
            raise HTTPException(409, "base d'analyse non livrée")
        droits = _droits(s, c.organisation.id) if not c.usine else {}
        plafond = droits.get("croisements_par_mois")
        if plafond is not None and _croisements_du_mois(s, c.organisation.id) >= int(plafond):
            raise HTTPException(403, f"plafond de {plafond} croisements par mois atteint pour la formule {droits.get('formule')}")
        jd = donnees.jeu(chemin_sur(cfg, p.base_analyse))
        if d.ligne not in {v["nom"] for v in donnees.variables(jd)} or d.colonne not in {v["nom"] for v in donnees.variables(jd)}:
            raise HTTPException(422, "variable non croisable")
        demande = d.model_dump()
        try:
            r = croiser(jd, Demande(d.ligne, d.colonne, d.filtre, d.poids), _garde(p))
        except CroisementRefuse as e:
            s.add(CroisementBD(organisation_id=p.organisation_id, projet_id=p.id, utilisateur_id=c.utilisateur.id,
                               demande=demande, base=0, refuse=True, motif=str(e)))
            return JSONResponse({"refuse": True, "motif": str(e)}, status_code=422)
        cb = CroisementBD(organisation_id=p.organisation_id, projet_id=p.id, utilisateur_id=c.utilisateur.id,
                          demande=demande, base=r.base, refuse=False)
        s.add(cb)
        s.flush()
        return JSONResponse({"refuse": False, "id": cb.id, **_resultat(r)})

    @app.get("/api/projets/{ident}/croisements/{num}/export")
    def export_croisement(ident: str, num: int, c: Client, s: BD) -> StreamingResponse:
        from openpyxl import Workbook

        if not c.usine and "croisement.executer" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "permission insuffisante pour exporter un croisement")
        p = _projet(s, ident)
        cb = s.get(CroisementBD, num)
        if cb is None or cb.projet_id != p.id or cb.refuse:
            raise HTTPException(404, "croisement introuvable")
        dm = cb.demande
        r = croiser(donnees.jeu(chemin_sur(cfg, p.base_analyse)), Demande(dm["ligne"], dm["colonne"], dm.get("filtre", ""),
                                                                          dm.get("poids")), _garde(p))
        wb = Workbook()
        ws = wb.active
        assert ws is not None
        ws.title = "CROISEMENT"
        ws.append(["", *[f"{lib} ({le})" for _, lib, le in r.colonnes]])
        for (_, lib), cellules in zip(r.lignes, r.cellules, strict=True):
            ws.append([lib, *[("—" if x.pct is None else round(x.pct, 1)) if x.effectif is not None else "< k" for x in cellules]])
        ws.append(["Base", *r.bases_colonnes])
        ws.append([])
        ws.append(["Commentaire", r.commentaire])
        for a in r.avertissements:
            ws.append(["Avertissement", a])
        wb.create_sheet("SYNTAXE_SPSS").append([r.syntaxe_spss])
        tampon = BytesIO()
        wb.save(tampon)
        tampon.seek(0)
        return StreamingResponse(tampon, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": f'attachment; filename="croisement_{num}.xlsx"'})

    @app.get("/api/projets/{ident}/livrables")
    def livrables(ident: str, c: Client, s: BD) -> list[dict[str, Any]]:
        p = _projet(s, ident)
        q = select(Livrable).where(Livrable.projet_id == p.id)
        if not c.usine:
            q = q.where(Livrable.partage_client.is_(True))
        return [{"id": str(x.id), "nom": x.nom, "partage_client": x.partage_client} for x in s.scalars(q.order_by(Livrable.nom))]

    @app.get("/api/livrables/{ident}")
    def telecharger(ident: str, c: Client, s: BD) -> FileResponse:
        x = s.get(Livrable, uuid_ou_404(ident))
        if x is None or (not c.usine and not x.partage_client):
            raise HTTPException(404, "livrable introuvable")
        f = chemin_sur(cfg, x.fichier)
        if not f.exists():
            raise HTTPException(404, "fichier absent")
        audit.journaliser(s, "telechargement", x.nom, organisation_id=x.organisation_id, utilisateur_id=c.utilisateur.id)
        return FileResponse(f, filename=f.name)

    @app.post("/api/projets/brief")
    def nouveau_brief(d: NouveauBrief, c: Client, s: BD) -> dict[str, Any]:
        from plateforme.projet.brief import Brief, charger_tarifs, pre_estimation

        if not c.usine and "brief.creer" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "seul l'administrateur du client dépose un brief")
        code = "BRIEF_" + uuid.uuid4().hex[:8].upper()
        brief = Brief.model_validate({"etude": code, "version": "01", "titre": d.titre, "besoin": d.besoin,
                                      "antecedents": d.antecedents, "marche": d.marche, "produits": d.produits, "attentes": d.attentes,
                                      "client": {"raison_sociale": c.organisation.nom}, "objectifs": d.objectifs,
                                      "cibles": [{"code": k, "libelle": lib} for k, lib in enumerate(d.cibles, start=1)],
                                      "pays": "CMR", "villes": d.villes, "taille": d.taille, "debut": d.debut,
                                      "echeance": d.echeance})
        if cfg.referentiel is not None:
            from plateforme.geo import referentiel as geo

            ref = geo.charger(cfg.referentiel)
            for v in brief.villes:
                try:
                    if ref.localite(v).type.value != "ville":
                        raise KeyError(v)
                except KeyError:
                    raise HTTPException(422, f"ville inconnue du référentiel : {v}") from None
        dossier = Path(str(c.organisation.id)) / code
        chemin = chemin_sur(cfg, str(dossier))
        chemin.mkdir(parents=True, exist_ok=True)
        (chemin / "brief.yaml").write_text(yaml.safe_dump(brief.model_dump(mode="json"), allow_unicode=True, sort_keys=False),
                                           encoding="utf-8")
        p = Projet(organisation_id=c.organisation.id, code=code, nom=d.titre, statut="brief", dossier=str(dossier))
        s.add(p)
        s.flush()
        audit.journaliser(s, "brief_depose", code, organisation_id=c.organisation.id, utilisateur_id=c.utilisateur.id)
        pre = pre_estimation(brief, charger_tarifs(cfg.tarifs_usine)).model_dump() if cfg.tarifs_usine else None
        return {"id": str(p.id), "code": code, "pre_estimation": pre}

    @app.get("/api/abonnement")
    def abonnement(c: Client, s: BD) -> dict[str, Any]:
        if not c.usine and "facturation.lire" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "permission insuffisante pour consulter l'abonnement")
        return {**_droits(s, c.organisation.id), "croisements_ce_mois": _croisements_du_mois(s, c.organisation.id)}

    @app.get("/api/factures")
    def factures(c: Client, s: BD) -> list[dict[str, Any]]:
        if not c.usine and "facturation.lire" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "permission insuffisante pour consulter les factures")
        q = select(Facture).order_by(Facture.emise_le)
        if not c.usine:
            q = q.where(Facture.organisation_id == c.organisation.id)
        return [{"id": str(f.id), "numero": f.numero, "montant_ht": float(f.montant_ht), "devise": f.devise, "statut": f.statut,
                 "lignes": f.lignes, "emise_le": f.emise_le.date().isoformat()} for f in s.scalars(q)]

    # -------------------------------------------------------------------------------------------- console usine
    @app.get("/api/usine/projets")
    def usine_projets(c: Usine, s: BDUsine) -> list[dict[str, Any]]:
        noms = {o.id: o.nom for o in s.scalars(select(Organisation))}
        return [{"id": str(p.id), "code": p.code, "nom": p.nom, "statut": p.statut, "organisation": noms.get(p.organisation_id, "")}
                for p in s.scalars(select(Projet).order_by(Projet.cree_le))]

    @app.get("/api/cabinet/roles")
    def cabinet_roles(c: Usine) -> list[dict[str, Any]]:
        """Catalogue des rôles du cabinet et de leurs permissions métier."""
        return [{"role": role, "permissions": sorted(perms)} for role, perms in securite.PERMISSIONS_PAR_ROLE.items()
                if role.startswith("cabinet") or role.startswith("consultant") or role in {"expert_etude", "enqueteur"}]

    @app.get("/api/cabinet/notifications")
    def cabinet_notifications(c: Usine, s: BDUsine) -> list[dict[str, Any]]:
        from plateforme.stockage.modeles import JournalAudit
        entrees = list(s.scalars(select(JournalAudit).order_by(JournalAudit.id.desc()).limit(30)))
        return [{"id": e.id, "titre": e.action.replace("_", " ").capitalize(), "texte": e.cible, "le": e.le.isoformat(timespec="seconds"), "lu": False}
                for e in entrees]

    @app.get("/api/cabinet/projets/{ident}/validation")
    def cabinet_validation_lire(ident: str, c: Usine, s: BDUsine) -> dict[str, Any]:
        p = _projet(s, ident)
        w = p.parametres.get("workflow", {})
        return {"etape": w.get("etape", "junior"), "historique": w.get("historique", []), "statut": p.statut}

    @app.post("/api/cabinet/projets/{ident}/validation")
    def cabinet_validation(ident: str, d: ValidationProjet, c: Usine, s: BDUsine) -> dict[str, Any]:
        p = _projet(s, ident)
        role = c.utilisateur.role
        courant = p.parametres.get("workflow", {}).get("etape", "junior")
        transitions = {"consultant_junior": ("junior", "senior"), "consultant_senior": ("senior", "expert"),
                       "expert_etude": ("expert", "livre"), "cabinet_admin": (courant, "livre"), "usine_admin": (courant, "livre")}
        attendu = transitions.get(role)
        if attendu is None or courant != attendu[0]:
            raise HTTPException(403, f"validation impossible pour le rôle {role} à l'étape {courant}")
        if attendu[1] == "livre":
            en_attente = [r for r in p.parametres.get("recommandations", []) if r.get("statut") == "a_valider"]
            if en_attente:
                raise HTTPException(409, f"livraison bloquée : {len(en_attente)} recommandation(s) à valider")
        historique = list(p.parametres.get("workflow", {}).get("historique", []))
        historique.append({"etape": attendu[1], "role": role, "utilisateur": c.utilisateur.nom,
                           "commentaire": d.commentaire, "version": d.version, "regle": d.regle,
                           "le": securite.maintenant().isoformat()})
        p.parametres = {**p.parametres, "workflow": {"etape": attendu[1], "historique": historique}}
        if attendu[1] == "livre":
            p.statut = "livre"
        audit.journaliser(s, "validation_projet", p.code, {"de": courant, "vers": attendu[1], "role": role}, p.organisation_id, c.utilisateur.id)
        return {"etape": attendu[1], "historique": historique, "statut": p.statut}

    @app.get("/api/cabinet/projets/{ident}/versions")
    def cabinet_versions_lire(ident: str, c: Usine, s: BDUsine) -> list[dict[str, Any]]:
        p = _projet(s, ident)
        return list(p.parametres.get("versions", []))

    @app.get("/api/cabinet/projets/{ident}/analyses")
    def analyses_lire(ident: str, c: Usine, s: BDUsine) -> list[dict[str, Any]]:
        return list(_projet(s, ident).parametres.get("analyses", []))

    @app.post("/api/cabinet/projets/{ident}/analyses")
    def analyse_creer(ident: str, d: ProcedureAnalyse, c: Usine, s: BDUsine) -> dict[str, Any]:
        p = _projet(s, ident)
        analyses = list(p.parametres.get("analyses", []))
        entree = {"id": uuid.uuid4().hex[:10], **d.model_dump(), "statut": "a_valider",
                  "auteur": c.utilisateur.nom, "le": securite.maintenant().isoformat()}
        analyses.append(entree); p.parametres = {**p.parametres, "analyses": analyses}
        audit.journaliser(s, "procedure_analyse_creee", p.code, entree, p.organisation_id, c.utilisateur.id)
        return entree

    @app.get("/api/cabinet/projets/{ident}/recommandations")
    def recommandations_lire(ident: str, c: Usine, s: BDUsine) -> list[dict[str, Any]]:
        return list(_projet(s, ident).parametres.get("recommandations", []))

    @app.post("/api/cabinet/projets/{ident}/recommandations")
    def recommandation_creer(ident: str, d: RecommandationProjet, c: Usine, s: BDUsine) -> dict[str, Any]:
        p = _projet(s, ident); items = list(p.parametres.get("recommandations", []))
        item = {"id": uuid.uuid4().hex[:10], **d.model_dump(), "statut": "a_valider", "auteur": c.utilisateur.nom, "le": securite.maintenant().isoformat(), "historique": []}
        items.append(item); p.parametres = {**p.parametres, "recommandations": items}
        audit.journaliser(s, "recommandation_creee", p.code, item, p.organisation_id, c.utilisateur.id)
        return item

    @app.post("/api/cabinet/projets/{ident}/recommandations/{rid}/decision")
    def recommandation_decider(ident: str, rid: str, d: DecisionRecommandation, c: Usine, s: BDUsine) -> dict[str, Any]:
        p = _projet(s, ident); items = list(p.parametres.get("recommandations", [])); item = next((x for x in items if x.get("id") == rid), None)
        if item is None: raise HTTPException(404, "recommandation introuvable")
        if d.decision == "rejetee" and not d.commentaire.strip(): raise HTTPException(422, "un commentaire est obligatoire pour un rejet")
        item = {**item, "statut": d.decision, "historique": [*item.get("historique", []), {"decision": d.decision, "commentaire": d.commentaire, "preuve": d.preuve, "expert": c.utilisateur.nom, "le": securite.maintenant().isoformat()}]}
        p.parametres = {**p.parametres, "recommandations": [item if x.get("id") == rid else x for x in items]}
        audit.journaliser(s, "recommandation_decidee", p.code, item, p.organisation_id, c.utilisateur.id)
        return item

    @app.post("/api/assistant")
    def assistant_question(d: QuestionAssistant, c: Client, s: BD) -> dict[str, Any]:
        """Copilote DATA'A : outils déterministes en lecture seule, chaque réponse porte ses preuves."""
        from plateforme import assistant as moteur_assistant

        p = _projet(s, d.projet) if d.projet else None
        analyses = list(p.parametres.get("analyses", [])) if p else []
        recommandations = list(p.parametres.get("recommandations", [])) if p else []
        if p and not c.usine:
            analyses = [x for x in analyses if x.get("statut") == "validee"]
            recommandations = [x for x in recommandations if x.get("statut") == "validee"]
        jeu = None
        variables = None
        quotas = None
        outil = moteur_assistant.classer(d.question)
        if p and outil == "aide":
            outil = "synthese"
        if p and p.base_analyse and outil in {"tri_plat", "suivi_quotas", "synthese"}:
            chemin_base = chemin_sur(cfg, p.base_analyse)
            if chemin_base.is_file():
                jeu = donnees.jeu(chemin_base)
                variables = donnees.variables(jeu)
                if outil in {"suivi_quotas", "synthese"} and p.dossier:
                    quotas = donnees.suivi(chemin_sur(cfg, p.dossier), jeu)
        garde = _garde(p) if p else None
        resultat = moteur_assistant.repondre(
            d.question, code=p.code if p else None, statut=p.statut if p else "",
            analyses=analyses, recommandations=recommandations, suivi=quotas, jeu=jeu, variables=variables,
            base_min=garde.base_min if garde else 30, seuil_k=garde.k if garde else 5, outil_force=outil,
        )
        redaction = "deterministe"
        if resultat["preuves"]:
            texte = moteur_assistant.rediger_localement(d.question, {
                "outil": resultat["outil"], "preuves": resultat["preuves"], "limites": resultat["limites"],
            })
            if texte:
                resultat["reponse"] = texte
                resultat["limites"] = [*resultat["limites"],
                                        "Rédaction libre par modèle local; les nombres ont été contrôlés contre les preuves.",
                                        "Relecture humaine requise avant réutilisation dans un livrable."]
                redaction = "ollama_local"
            else:
                resultat["limites"] = [*resultat["limites"],
                                        "Modèle local absent, indisponible ou réponse non vérifiable; formulation déterministe utilisée."]
        audit.journaliser(s, "assistant_question", p.code if p else "global",
                          {"question": d.question[:500], "outil": resultat["outil"], "preuves": len(resultat["preuves"]),
                           "redaction": redaction},
                          c.organisation.id, c.utilisateur.id)
        return {**resultat, "outils_disponibles": moteur_assistant.OUTILS,
                "redaction": redaction,
                "verification": {"preuves_jointes": bool(resultat["preuves"]), "lecture_seule": True,
                                 "publication_automatique": False, "nombres_verifies": redaction == "ollama_local"}}

    @app.get("/api/assistant/outils")
    def assistant_outils(c: Client) -> dict[str, Any]:
        """Registre des outils implémentés : aucun ne peut modifier un projet ou publier un rapport."""
        from plateforme import assistant as moteur_assistant

        return {"outils": [{"nom": nom, "permission": "projet.lire", "mutation": False}
                           for nom in moteur_assistant.OUTILS], "role": c.utilisateur.role}

    @app.get("/api/assistant/memoire/{ident}")
    def assistant_memoire_lire(ident: str, c: Client, s: BD) -> dict[str, Any]:
        """Mémoire contextualisée d'une étude, isolée par organisation."""
        p = _projet(s, ident)
        if p.organisation_id != c.organisation.id and not c.usine:
            raise HTTPException(404, "étude introuvable")
        memoire = list(p.parametres.get("assistant_memoire", []))
        return {"projet": p.code, "entrees": memoire}

    @app.post("/api/assistant/memoire")
    def assistant_memoire_ecrire(d: MemoAssistant, c: Client, s: BD) -> dict[str, Any]:
        p = _projet(s, d.projet)
        if p.organisation_id != c.organisation.id and not c.usine:
            raise HTTPException(404, "étude introuvable")
        if not c.usine and "projet.piloter" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "permission insuffisante pour enrichir la mémoire")
        entree = {"type": d.type, "contenu": d.contenu, "auteur": c.utilisateur.nom,
                  "le": securite.maintenant().isoformat()}
        memoire = list(p.parametres.get("assistant_memoire", [])); memoire.append(entree)
        p.parametres = {**p.parametres, "assistant_memoire": memoire[-100:]}
        audit.journaliser(s, "assistant_memoire_ajoutee", p.code, entree, p.organisation_id, c.utilisateur.id)
        return entree

    @app.get("/api/cabinet/projets/{ident}/synthese")
    def synthese_executive(ident: str, c: Usine, s: BDUsine) -> dict[str, Any]:
        p = _projet(s, ident); recommandations = [r for r in p.parametres.get("recommandations", []) if r.get("statut") == "validee"]
        analyses = [a for a in p.parametres.get("analyses", []) if a.get("statut") in {"validee", "a_valider"}]
        return {"projet": p.code, "statut": p.statut, "faits": analyses, "actions": recommandations,
                "interpretations": [r.get("constat", "") for r in recommandations],
                "risques": [r.get("risque", "") for r in recommandations if r.get("risque")],
                "limites": ["Synthèse générée uniquement à partir des éléments versionnés et validés."]}

    @app.get("/api/cabinet/projets/{ident}/qualite-terrain")
    def qualite_terrain(ident: str, c: Usine, s: BDUsine) -> dict[str, Any]:
        from plateforme.stockage.modeles import MetaFiche, Signalement
        p = _projet(s, ident); fiches = list(s.scalars(select(MetaFiche).where(MetaFiche.projet_id == p.id)))
        rapides = [f for f in fiches if f.duree_s is not None and f.duree_s < 60]
        sans_position = [f for f in fiches if f.latitude is None or f.longitude is None]
        signalements = list(s.scalars(select(Signalement).where(Signalement.projet_id == p.id)))
        positions = [(round(float(f.latitude), 4), round(float(f.longitude), 4)) for f in fiches if f.latitude is not None and f.longitude is not None]
        doublons = len(positions) - len(set(positions))
        incoherences = sum(1 for f in fiches if f.duree_s is not None and (f.duree_s <= 0 or f.duree_s > 86400))
        penalites = len(rapides) * 20 + len(sans_position) * 5 + doublons * 10 + incoherences * 10
        score = round(max(0.0, 100.0 - penalites / max(1, len(fiches))), 1)
        recommandations = []
        if rapides: recommandations.append("Controler manuellement les fiches trop rapides.")
        if doublons: recommandations.append("Verifier les doublons de position et de point d enquete.")
        if incoherences: recommandations.append("Revoir les durees ou metadonnees incoherentes.")
        return {"fiches": len(fiches), "score_global": score, "fiches_trop_rapides": len(rapides), "sans_position": len(sans_position), "doublons_probables": doublons, "incoherences": incoherences, "signalements_ouverts": len(signalements), "recommandations": recommandations}

    @app.post("/api/cabinet/projets/{ident}/versions")
    def cabinet_version_creer(ident: str, d: VersionProjet, c: Usine, s: BDUsine) -> dict[str, Any]:
        p = _projet(s, ident)
        if "projet.piloter" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "permission insuffisante pour versionner le projet")
        versions = list(p.parametres.get("versions", []))
        meme_type = [v for v in versions if v.get("type") == d.type]
        version = f"{len(meme_type) + 1:02d}"
        entree = {"type": d.type, "version": version, "statut": "brouillon", "commentaire": d.commentaire,
                  "source": d.source, "auteur": c.utilisateur.nom, "role": c.utilisateur.role,
                  "le": securite.maintenant().isoformat()}
        versions.append(entree)
        p.parametres = {**p.parametres, "versions": versions}
        audit.journaliser(s, "version_projet_creee", p.code, entree, p.organisation_id, c.utilisateur.id)
        return entree

    @app.post("/api/usine/projets/{ident}/verifier")
    def usine_verifier(ident: str, c: Usine, s: BDUsine) -> dict[str, Any]:
        from plateforme.projet import projet as pj

        p = _projet(s, ident)
        try:
            ecarts = pj.verifier(pj.charger(chemin_sur(cfg, p.dossier)))
        except (FileNotFoundError, ValueError, KeyError) as e:
            return {"coherent": False, "ecarts": [f"projet incomplet : {e}"]}
        return {"coherent": not ecarts, "ecarts": ecarts}

    def _plan_echantillonnage(cfg_: Config, p: Projet) -> tuple[Any, Any, Path]:
        from plateforme.projet import projet as pj

        if not p.dossier:
            raise HTTPException(409, "dossier de projet absent")
        dossier = chemin_sur(cfg_, p.dossier)
        try:
            pr = pj.charger(dossier)
            plan = pr.exiger_echantillonnage()
        except (FileNotFoundError, ValueError, KeyError) as e:
            raise HTTPException(409, f"projet incomplet : {e}") from e
        return pr, plan, chemin_sur(cfg_, str(Path(p.dossier) / pr.manifeste.plan_echantillonnage))

    def _vue_plan_echantillonnage(pr: Any, plan: Any) -> dict[str, Any]:
        from plateforme.echantillonnage import plan as pe
        from plateforme.projet import projet as pj

        taille_calculee = pe.taille_echantillon(plan.taille) if plan.taille is not None else None
        marge = None
        if plan.taille is not None and plan.methode is not pe.Methode.QUOTAS and plan.total() > 0:
            marge = round(pe.marge_obtenue(plan.total(), plan.taille.proportion, plan.taille.confiance, plan.taille.effet_plan), 4)
        capacites = []
        if pr.terrain is not None:
            capacites = [{**c.model_dump(), "ecart": c.ecart} for c in pe.capacite(plan, pr.terrain)]
        return {"etude": plan.etude, "version": plan.version, "methode": plan.methode.value, "variable_cible": plan.variable_cible,
                "mention": plan.mention(), "villes": plan.villes, "total": plan.total(), "par_ville": plan.par_ville(),
                "quotas": [q.model_dump() for q in plan.quotas],
                "taille": plan.taille.model_dump() if plan.taille else None, "taille_calculee": taille_calculee,
                "marge_indicative": marge, "capacites": capacites, "ecarts": pj.verifier(pr)}

    @app.get("/api/usine/projets/{ident}/echantillonnage")
    def usine_echantillonnage(ident: str, c: Usine, s: BDUsine) -> dict[str, Any]:
        pr, plan, _ = _plan_echantillonnage(cfg, _projet(s, ident))
        return _vue_plan_echantillonnage(pr, plan)

    @app.put("/api/usine/projets/{ident}/echantillonnage")
    def usine_echantillonnage_enregistrer(ident: str, d: PlanEchantillonnageEntree, c: Usine, s: BDUsine) -> dict[str, Any]:
        from pydantic import ValidationError

        from plateforme.echantillonnage import plan as pe
        from plateforme.projet import projet as pj
        from plateforme.stockage.modeles import MetaFiche

        if "projet.piloter" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "permission insuffisante pour modifier le plan d'échantillonnage")
        p = _projet(s, ident)
        pr, plan, fichier = _plan_echantillonnage(cfg, p)
        if d.version != plan.version:
            raise HTTPException(409, f"le plan est maintenant en version {plan.version} (vous avez chargé la {d.version}) : rechargez la page")
        nb_fiches = s.scalar(select(func.count()).select_from(MetaFiche).where(MetaFiche.projet_id == p.id)) or 0
        if nb_fiches:
            raise HTTPException(409, f"collecte commencée ({nb_fiches} fiche(s)) : le plan ne peut plus être modifié")
        suivante = f"{int(plan.version) + 1:02d}" if plan.version.isdigit() else f"{plan.version}.1"
        try:
            nouveau = pe.PlanEchantillonnage.model_validate({
                "etude": plan.etude, "version": suivante, "methode": d.methode, "variable_cible": plan.variable_cible,
                "taille": d.taille, "quotas": [q.model_dump() for q in d.quotas], "parametres_qualite": plan.parametres_qualite})
        except ValidationError as e:
            raise HTTPException(422, "plan invalide : " + " ; ".join(x["msg"] for x in e.errors())) from e
        pe.enregistrer(nouveau, fichier)
        audit.journaliser(s, "plan_echantillonnage_modifie", p.code,
                          {"ancienne": plan.version, "nouvelle": suivante, "total": nouveau.total(), "methode": d.methode},
                          p.organisation_id, c.utilisateur.id)
        pr = pj.charger(chemin_sur(cfg, p.dossier))
        return _vue_plan_echantillonnage(pr, pr.exiger_echantillonnage())

    def _dictionnaire_projet(cfg_: Config, p: Projet) -> tuple[Any, Path]:
        from plateforme.projet import projet as pj

        if not p.dossier:
            raise HTTPException(409, "dossier de projet absent")
        try:
            pr = pj.charger(chemin_sur(cfg_, p.dossier))
        except (FileNotFoundError, ValueError, KeyError) as e:
            raise HTTPException(409, f"projet incomplet : {e}") from e
        return pr, chemin_sur(cfg_, str(Path(p.dossier) / pr.manifeste.dictionnaire))

    def _vue_dictionnaire(s: Session, p: Projet, pr: Any) -> dict[str, Any]:
        from plateforme.projet import projet as pj
        from plateforme.stockage.modeles import MetaFiche

        nb_fiches = s.scalar(select(func.count()).select_from(MetaFiche).where(MetaFiche.projet_id == p.id)) or 0
        d = pr.dictionnaire
        return {"version": d.version, "statut": d.statut, "etude": d.etude, "langue_reference": d.langue_reference,
                "nb_fiches": nb_fiches, "modifiable": nb_fiches == 0,
                "dictionnaire": d.model_dump(mode="json"), "ecarts": pj.verifier(pr)}

    @app.get("/api/usine/projets/{ident}/dictionnaire")
    def usine_dictionnaire(ident: str, c: Usine, s: BDUsine) -> dict[str, Any]:
        p = _projet(s, ident)
        pr, _ = _dictionnaire_projet(cfg, p)
        return _vue_dictionnaire(s, p, pr)

    @app.put("/api/usine/projets/{ident}/dictionnaire")
    def usine_dictionnaire_enregistrer(ident: str, d: DictionnaireEntree, c: Usine, s: BDUsine) -> dict[str, Any]:
        import dataclasses

        from pydantic import ValidationError

        from plateforme.dictionnaire import diff, fichiers
        from plateforme.dictionnaire.modele import Dictionnaire
        from plateforme.projet import projet as pj

        if "projet.piloter" not in securite.permissions(c.utilisateur.role):
            raise HTTPException(403, "permission insuffisante pour modifier le dictionnaire")
        p = _projet(s, ident)
        pr, fichier = _dictionnaire_projet(cfg, p)
        ancien = pr.dictionnaire
        if d.version != ancien.version:
            raise HTTPException(409, f"le dictionnaire est maintenant en version {ancien.version} (vous avez chargé la {d.version}) : rechargez la page")
        vue = _vue_dictionnaire(s, p, pr)
        if not vue["modifiable"]:
            raise HTTPException(409, f"collecte commencée ({vue['nb_fiches']} fiche(s)) : le dictionnaire ne peut plus être modifié")
        suivante = f"{int(ancien.version) + 1:02d}" if ancien.version.isdigit() else f"{ancien.version}.1"
        try:
            nouveau = Dictionnaire.model_validate({**d.dictionnaire, "version": suivante, "etude": ancien.etude})
        except ValidationError as e:
            raise HTTPException(422, "dictionnaire invalide : " + " ; ".join(
                f"{'.'.join(str(x) for x in err['loc'])} : {err['msg']}" for err in e.errors()[:10])) from e
        avant = set(pj.verifier(pr))
        nouveaux = [x for x in pj.verifier(dataclasses.replace(pr, dictionnaire=nouveau)) if x not in avant]
        if nouveaux:
            raise HTTPException(422, "incohérent avec le projet : " + " ; ".join(nouveaux))
        changements = diff.comparer(ancien, nouveau)
        archive = fichier.with_name(f"{fichier.stem}.v{ancien.version}{fichier.suffix}")
        if not archive.exists():
            archive.write_bytes(fichier.read_bytes())
        fichiers.enregistrer(nouveau, fichier)
        audit.journaliser(s, "dictionnaire_modifie", p.code,
                          {"ancienne": ancien.version, "nouvelle": suivante, "changements": len(changements),
                           "recodages": sum(1 for x in changements if x.migration)},
                          p.organisation_id, c.utilisateur.id)
        pr = pj.charger(chemin_sur(cfg, p.dossier))
        return {**_vue_dictionnaire(s, p, pr),
                "changements": [{"type": x.type.value, "question": x.question, "detail": x.detail, "migration": x.migration} for x in changements]}

    @app.post("/api/usine/projets/{ident}/documents")
    def usine_documents(ident: str, c: Usine, s: BDUsine) -> dict[str, Any]:
        from plateforme.documents.produire import ProjetIncoherent, produire
        from plateforme.projet import projet as pj

        p = _projet(s, ident)
        dossier = chemin_sur(cfg, p.dossier)
        try:
            ecrits, modifiees = produire(pj.charger(dossier), dossier / "documents")
        except ProjetIncoherent as e:
            raise HTTPException(409, str(e)) from e
        existants = {x.fichier: x for x in s.scalars(select(Livrable).where(Livrable.projet_id == p.id))}
        for fichiers in ecrits.values():
            for f in fichiers:
                rel = str(Path(p.dossier) / "documents" / f.name)
                if rel not in existants:
                    s.add(Livrable(organisation_id=p.organisation_id, projet_id=p.id, nom=f.name, fichier=rel, partage_client=False))
        p.statut = "documents"
        audit.journaliser(s, "documents_generes", p.code, {"sources_modifiees": modifiees}, p.organisation_id, c.utilisateur.id)
        return {"documents": sum(len(v) for v in ecrits.values()), "sources_modifiees": modifiees}

    @app.patch("/api/usine/livrables/{ident}")
    def usine_partage(ident: str, d: Partage, c: Usine, s: BDUsine) -> dict[str, Any]:
        x = s.get(Livrable, uuid_ou_404(ident))
        if x is None:
            raise HTTPException(404, "livrable introuvable")
        x.partage_client = d.partage_client
        audit.journaliser(s, "livrable_partage" if d.partage_client else "livrable_retire", x.nom, organisation_id=x.organisation_id,
                          utilisateur_id=c.utilisateur.id)
        return {"id": str(x.id), "partage_client": x.partage_client}

    @app.get("/api/usine/organisations")
    def usine_organisations(c: Usine, s: BDUsine) -> list[dict[str, Any]]:
        return [{"id": str(o.id), "nom": o.nom, "type": o.type} for o in s.scalars(select(Organisation).order_by(Organisation.nom))]

    @app.post("/api/usine/organisations")
    def usine_nouvelle_organisation(d: NouvelleOrganisation, c: Usine, s: BDUsine) -> dict[str, Any]:
        try:
            hache = securite.hacher(d.mot_de_passe)
        except securite.MotDePasseFaible as e:
            raise HTTPException(422, str(e)) from e
        if utilisateur_par_email(s, d.admin_email) is not None:
            raise HTTPException(409, "adresse déjà utilisée")
        o = Organisation(nom=d.nom, type="client")
        s.add(o)
        s.flush()
        s.add(Utilisateur(organisation_id=o.id, email=d.admin_email.strip().lower(), nom=d.admin_nom, role="client_admin", hash_mdp=hache))
        if d.formule:
            f = s.scalar(select(Formule).where(Formule.code == d.formule))
            if f is None:
                raise HTTPException(422, "formule inconnue")
            s.add(Abonnement(organisation_id=o.id, formule_id=f.id, debut=date.today()))
        audit.journaliser(s, "organisation_creee", d.nom, organisation_id=o.id, utilisateur_id=c.utilisateur.id)
        return {"id": str(o.id), "nom": o.nom}

    @app.post("/api/usine/factures")
    def usine_facture(d: NouvelleFacture, c: Usine, s: BDUsine) -> dict[str, Any]:
        if s.get(Organisation, d.organisation_id) is None:
            raise HTTPException(404, "organisation introuvable")
        annee = date.today().year
        n = int(s.scalar(select(func.count()).select_from(Facture).where(Facture.numero.like(f"F-{annee}-%"))) or 0) + 1
        f = Facture(organisation_id=d.organisation_id, numero=f"F-{annee}-{n:04d}", lignes=[list(x) for x in d.lignes],
                    montant_ht=Decimal(str(round(sum(m for _, m in d.lignes), 2))))
        s.add(f)
        s.flush()
        audit.journaliser(s, "facture_emise", f.numero, {"montant_ht": float(f.montant_ht)}, d.organisation_id, c.utilisateur.id)
        return {"id": str(f.id), "numero": f.numero, "montant_ht": float(f.montant_ht)}

    @app.post("/api/usine/factures/{ident}/paiements")
    def usine_paiement(ident: str, d: NouveauPaiement, c: Usine, s: BDUsine) -> dict[str, Any]:
        f = s.get(Facture, uuid_ou_404(ident))
        if f is None:
            raise HTTPException(404, "facture introuvable")
        if f.statut == "annulee":
            raise HTTPException(409, "facture annulée")
        s.add(Paiement(organisation_id=f.organisation_id, facture_id=f.id, montant=Decimal(str(d.montant)), moyen=d.moyen,
                       reference=d.reference, saisi_par=c.utilisateur.id))
        s.flush()
        recu = s.scalar(select(func.coalesce(func.sum(Paiement.montant), 0)).where(Paiement.facture_id == f.id)) or Decimal(0)
        if Decimal(recu) >= f.montant_ht:
            f.statut = "payee"
        audit.journaliser(s, "paiement_enregistre", f.numero, {"montant": d.montant, "moyen": d.moyen}, f.organisation_id,
                          c.utilisateur.id)
        return {"facture": f.numero, "statut": f.statut, "recu": float(recu)}

    @app.get("/api/usine/audit")
    def usine_audit(c: Usine, s: BDUsine) -> dict[str, Any]:
        from plateforme.stockage.modeles import JournalAudit

        derniers = list(s.scalars(select(JournalAudit).order_by(JournalAudit.id.desc()).limit(50)))
        return {"chaine_integre": not audit.verifier_chaine(s), "ecarts": audit.verifier_chaine(s),
                "entrees": [{"le": e.le.isoformat(timespec="seconds"), "action": e.action, "cible": e.cible} for e in derniers]}

    # -------------------------------------------------------------------------------------------- terrain (phase 8)
    from plateforme.stockage.modeles import Mission

    app.include_router(terrain.routeur(cfg))

    @app.post("/api/usine/projets/{ident}/missions")
    def usine_missions(ident: str, c: Usine, s: BDUsine) -> dict[str, Any]:
        """Crée un code de mission par poste du plan de terrain qui n'en a pas encore. Les codes ne sont montrés qu'UNE fois
        (seule leur empreinte est conservée) : à imprimer sur l'ordre de mission."""
        from plateforme.projet import projet as pj

        p = _projet(s, ident)
        postes = [e.id for e in pj.charger(chemin_sur(cfg, p.dossier)).exiger_terrain().enqueteurs]
        existantes = {m.enqueteur for m in s.scalars(select(Mission).where(Mission.projet_id == p.id))}
        nouveaux = {}
        for poste in postes:
            if poste in existantes:
                continue
            code = terrain.nouveau_code()
            s.add(Mission(organisation_id=p.organisation_id, projet_id=p.id, enqueteur=poste, code_empreinte=terrain.empreinte_code(code)))
            nouveaux[poste] = code
        audit.journaliser(s, "missions_creees", p.code, {"postes": sorted(nouveaux)}, p.organisation_id, c.utilisateur.id)
        return {"codes": nouveaux, "deja_crees": sorted(existantes)}

    @app.get("/api/usine/projets/{ident}/missions")
    def usine_liste_missions(ident: str, c: Usine, s: BDUsine) -> list[dict[str, Any]]:
        from plateforme.stockage.modeles import MetaFiche

        p = _projet(s, ident)
        recues = dict(s.execute(select(MetaFiche.mission_id, func.count()).where(MetaFiche.projet_id == p.id)
                                .group_by(MetaFiche.mission_id)).all())
        return [{"id": str(m.id), "enqueteur": m.enqueteur, "actif": m.actif, "fiches": int(recues.get(m.id, 0))}
                for m in s.scalars(select(Mission).where(Mission.projet_id == p.id).order_by(Mission.enqueteur))]

    @app.patch("/api/usine/missions/{ident}")
    def usine_revoquer(ident: str, d: Revocation, c: Usine, s: BDUsine) -> dict[str, Any]:
        m = s.get(Mission, uuid_ou_404(ident))
        if m is None:
            raise HTTPException(404, "mission introuvable")
        m.actif = d.actif
        audit.journaliser(s, "mission_reactivee" if d.actif else "mission_revoquee", m.enqueteur, organisation_id=m.organisation_id,
                          utilisateur_id=c.utilisateur.id)
        return {"id": str(m.id), "actif": m.actif}

    # -------------------------------------------------------------------------------------------- front-end
    if cfg.web is not None and (cfg.web / "index.html").exists():
        racine_web = cfg.web.resolve()

        @app.get("/{chemin:path}", include_in_schema=False)
        def front(chemin: str) -> FileResponse:
            if chemin.startswith("api/"):
                raise HTTPException(404, "introuvable")
            f = (racine_web / chemin).resolve()
            if chemin and f.is_file() and racine_web in f.parents:
                return FileResponse(f)
            return FileResponse(racine_web / "index.html")          # application monopage : routes gérées par le front

    return app


def application() -> FastAPI:
    """Point d'entrée uvicorn (« plateforme.api.app:application », --factory) : configuration par variables d'environnement."""
    return creer_app(Config.depuis_env())
