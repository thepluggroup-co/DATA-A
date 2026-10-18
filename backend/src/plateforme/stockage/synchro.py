"""Synchronisation idempotente et auto-réparatrice (`synchroniser_` de V11, porté par la base de données).

- `recevoir` : insère des réponses brutes. Une réponse déjà reçue (même identifiant, même contenu) est
  ignorée ; un renvoi MODIFIÉ sous le même identifiant est refusé et journalisé en ERREUR (la réponse
  brute est immuable). L'unicité est garantie par une contrainte de la base, même en cas d'envois
  simultanés ou d'une coupure en plein envoi suivie d'une relance.
- `coder` : recode tout le projet dans UNE transaction (tout ou rien) ; les N° des nouvelles fiches sont
  inscrits au registre, ceux déjà attribués ne changent jamais.
- `decider` : enregistre une décision du superviseur (historique, la dernière fait foi).
- `bilan` : état de la synchronisation (équivalent de l'onglet SANTE_SYNC de V11).
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from plateforme.codification.fiche import FicheCodee, ParametresCodification
from plateforme.codification.rejeu import EXCLUE, DecisionQC, recoder
from plateforme.codification.reponses import ItemReponse, ReponseBrute
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.stockage.modeles import (
    Contact,
    DecisionQCBD,
    FicheCodeeBD,
    JournalSync,
    NumeroFiche,
    Organisation,
    Projet,
    ReponseBruteBD,
)

INFO, ALERTE, ERREUR = "INFO", "ALERTE", "ERREUR"


def _items_json(r: ReponseBrute) -> list[dict[str, Any]]:
    return [{"titre": i.titre, "valeur": i.valeur, "lignes": list(i.lignes) if i.lignes is not None else None} for i in r.items]


def empreinte(r: ReponseBrute) -> str:
    """SHA-256 du contenu canonique (horodatage + éléments) : deux envois identiques ont la même empreinte."""
    contenu = json.dumps({"h": r.horodatage.isoformat(), "items": _items_json(r)}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(contenu.encode("utf-8")).hexdigest()


def journaliser(session: Session, projet: Projet | None, source: str, niveau: str, message: str) -> None:
    session.add(JournalSync(organisation_id=projet.organisation_id if projet else None, projet_id=projet.id if projet else None,
                            source=source, niveau=niveau, message=message[:5000]))


def projet(session: Session, organisation: str, code: str, nom: str = "") -> Projet:
    """Organisation et projet (créés s'ils n'existent pas)."""
    org = session.scalar(select(Organisation).where(Organisation.nom == organisation))
    if org is None:
        org = Organisation(nom=organisation)
        session.add(org)
        session.flush()
    p = session.scalar(select(Projet).where(Projet.organisation_id == org.id, Projet.code == code))
    if p is None:
        p = Projet(organisation_id=org.id, code=code, nom=nom or code)
        session.add(p)
        session.flush()
    return p


@dataclass
class ResultatReception:
    nouvelles: int = 0
    deja_recues: int = 0
    conflits: list[str] = field(default_factory=list)


def recevoir(session: Session, p: Projet, reponses: list[ReponseBrute], source: str = "") -> ResultatReception:
    res = ResultatReception()
    ids = [r.id for r in reponses]
    connues = dict(session.execute(select(ReponseBruteBD.id_externe, ReponseBruteBD.empreinte)
                                   .where(ReponseBruteBD.projet_id == p.id, ReponseBruteBD.id_externe.in_(ids))).all())
    vues: dict[str, str] = {}
    for r in reponses:
        e = empreinte(r)
        deja = connues.get(r.id) or vues.get(r.id)
        if deja is not None:
            if deja == e:
                res.deja_recues += 1
            else:
                res.conflits.append(r.id)
            continue
        ligne = session.execute(
            insert(ReponseBruteBD).values(id=uuid.uuid4(), organisation_id=p.organisation_id, projet_id=p.id, id_externe=r.id,
                                          source=source or r.source, horodatage=r.horodatage, items=_items_json(r), empreinte=e)
            .on_conflict_do_nothing(constraint="uq_reponse_par_projet").returning(ReponseBruteBD.id)).first()
        if ligne is None:                       # insérée entre-temps par un envoi concurrent
            res.deja_recues += 1
        else:
            res.nouvelles += 1
        vues[r.id] = e
    if res.conflits:
        journaliser(session, p, source or "RECEPTION", ERREUR,
                    f"{len(res.conflits)} réponse(s) renvoyée(s) avec un contenu DIFFÉRENT sous le même identifiant : refusées "
                    f"(réponse brute immuable). Identifiants : {', '.join(res.conflits[:20])}")
    journaliser(session, p, source or "RECEPTION", INFO,
                f"{res.nouvelles} nouvelle(s), {res.deja_recues} déjà reçue(s), {len(res.conflits)} conflit(s)")
    return res


def _depuis_bd(r: ReponseBruteBD) -> ReponseBrute:
    items = tuple(ItemReponse(i["titre"], i["valeur"], tuple(i["lignes"]) if i["lignes"] is not None else None) for i in r.items)
    return ReponseBrute(r.id_externe, r.horodatage, items, r.source)


def decisions_courantes(session: Session, p: Projet) -> dict[str, DecisionQC]:
    """Dernière décision par réponse (identifiant externe)."""
    lignes = session.execute(select(ReponseBruteBD.id_externe, DecisionQCBD)
                             .join(DecisionQCBD, DecisionQCBD.reponse_id == ReponseBruteBD.id)
                             .where(DecisionQCBD.projet_id == p.id).order_by(DecisionQCBD.decide_le, DecisionQCBD.id)).all()
    return {ide: DecisionQC(d.statut, d.anomalies_vues, d.auteur, d.motif) for ide, d in lignes}


@dataclass
class ResultatCodage:
    fiches: list[FicheCodee]
    nouveaux_numeros: int


def coder(session: Session, p: Projet, dico: Dictionnaire, params: ParametresCodification) -> ResultatCodage:
    """Recode tout le projet ; à appeler dans une transaction (le contexte `with session.begin()` de l'appelant)."""
    brutes = session.scalars(select(ReponseBruteBD).where(ReponseBruteBD.projet_id == p.id).order_by(ReponseBruteBD.horodatage)).all()
    ids_bd = {r.id_externe: r.id for r in brutes}
    numeros = dict(session.execute(select(ReponseBruteBD.id_externe, NumeroFiche.sequence)
                                   .join(NumeroFiche, NumeroFiche.reponse_id == ReponseBruteBD.id)
                                   .where(NumeroFiche.projet_id == p.id)).all())
    decisions = decisions_courantes(session, p)
    prises = dict(session.execute(select(NumeroFiche.enqueteur, func.max(NumeroFiche.sequence))
                                  .where(NumeroFiche.projet_id == p.id).group_by(NumeroFiche.enqueteur)).all())
    fiches = recoder(dico, [_depuis_bd(r) for r in brutes], params, numeros_connus=numeros, decisions=decisions,
                     sequences_prises=prises)
    nouveaux = 0
    for f in fiches:
        rid = ids_bd[f.id_reponse]
        if f.id_reponse not in numeros:
            session.add(NumeroFiche(reponse_id=rid, organisation_id=p.organisation_id, projet_id=p.id,
                                    enqueteur=str(f.valeurs["CODEENQU"]), sequence=int(f.numfiche.rsplit("-", 1)[1])))
            nouveaux += 1
        valeurs = {"numfiche": f.numfiche, "valeurs": f.valeurs, "anomalies": f.anomalies, "statut": f.statut,
                   "version_dictionnaire": dico.version, "codee_le": func.now()}
        session.execute(insert(FicheCodeeBD).values(reponse_id=rid, organisation_id=p.organisation_id, projet_id=p.id, **valeurs)
                        .on_conflict_do_update(index_elements=["reponse_id"], set_=valeurs))
        session.execute(insert(Contact).values(reponse_id=rid, organisation_id=p.organisation_id, projet_id=p.id, ligne=f.contact)
                        .on_conflict_do_update(index_elements=["reponse_id"], set_={"ligne": f.contact}))
    exclues = [ids_bd[i] for i, d in decisions.items() if d.statut == EXCLUE and i in ids_bd]
    if exclues:
        session.execute(delete(FicheCodeeBD).where(FicheCodeeBD.reponse_id.in_(exclues)))
        session.execute(delete(Contact).where(Contact.reponse_id.in_(exclues)))
    session.flush()
    journaliser(session, p, "CODAGE", INFO, f"{len(fiches)} fiche(s) codée(s) (dictionnaire {dico.version}), "
                                            f"{nouveaux} nouveau(x) N°, {len(exclues)} réponse(s) exclue(s)")
    return ResultatCodage(fiches, nouveaux)


def decider(session: Session, p: Projet, id_externe: str, statut: str, motif: str = "", auteur: str = "",
            anomalies_vues: str = "") -> None:
    rid = session.scalar(select(ReponseBruteBD.id).where(ReponseBruteBD.projet_id == p.id, ReponseBruteBD.id_externe == id_externe))
    if rid is None:
        raise KeyError(f"réponse inconnue : {id_externe}")
    session.add(DecisionQCBD(organisation_id=p.organisation_id, projet_id=p.id, reponse_id=rid, statut=statut,
                             anomalies_vues=anomalies_vues, motif=motif, auteur=auteur))
    journaliser(session, p, "DECISION", INFO, f"{statut} sur {id_externe} par {auteur or '?'} : {motif}")


@dataclass
class Bilan:
    reponses: int
    fiches: int
    reponses_sans_fiche: int
    exclues: int
    statuts: dict[str, int]
    absentes_de_la_base: list[str]
    derniere_operation: datetime | None
    dernieres_erreurs: list[str]

    @property
    def sain(self) -> bool:
        return self.reponses_sans_fiche == 0 and not self.absentes_de_la_base

    def texte(self) -> str:
        etat = "✔ synchronisé" if self.sain else "✘ écarts à corriger"
        return (f"{etat} : {self.reponses} réponse(s), {self.fiches} fiche(s), {self.exclues} exclue(s), "
                f"{self.reponses_sans_fiche} réponse(s) sans fiche, {len(self.absentes_de_la_base)} réponse(s) de la source absente(s) ; "
                f"statuts {self.statuts}")


def bilan(session: Session, p: Projet, ids_source: set[str] | None = None) -> Bilan:
    nb_reponses = session.scalar(select(func.count()).select_from(ReponseBruteBD).where(ReponseBruteBD.projet_id == p.id)) or 0
    nb_fiches = session.scalar(select(func.count()).select_from(FicheCodeeBD).where(FicheCodeeBD.projet_id == p.id)) or 0
    exclues = sum(1 for d in decisions_courantes(session, p).values() if d.statut == EXCLUE)
    statuts = dict(session.execute(select(FicheCodeeBD.statut, func.count()).where(FicheCodeeBD.projet_id == p.id)
                                   .group_by(FicheCodeeBD.statut)).all())
    absentes: list[str] = []
    if ids_source is not None:
        en_base = set(session.scalars(select(ReponseBruteBD.id_externe).where(ReponseBruteBD.projet_id == p.id)))
        absentes = sorted(ids_source - en_base)
    derniere = session.scalar(select(func.max(JournalSync.le)).where(JournalSync.projet_id == p.id))
    erreurs = list(session.scalars(select(JournalSync.message).where(JournalSync.projet_id == p.id, JournalSync.niveau == ERREUR)
                                   .order_by(JournalSync.le.desc()).limit(5)))
    return Bilan(nb_reponses, nb_fiches, nb_reponses - nb_fiches - exclues, exclues, statuts, absentes, derniere, erreurs)
