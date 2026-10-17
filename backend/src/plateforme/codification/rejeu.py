"""Recodage complet et rejouable d'un ensemble de réponses brutes (`reconstruire_` de V11).

- Une réponse n'est codée qu'une fois, même reçue deux fois (dédoublonnage par identifiant).
- Ordre chronologique : la numérotation, les délais et les doublons de téléphone en dépendent.
- Les numéros déjà attribués sont réservés AVANT le codage : une fiche garde toujours son N°,
  et une nouvelle fiche ne reprend jamais le numéro d'une fiche supprimée.
- Décisions du superviseur (table séparée) : `REJETE` survit à tout recodage (la fiche garde son N°
  et reste dans l'historique : délais, doublons) ; un `OK` posé sur une fiche à anomalies survit tant
  que les anomalies sont les mêmes (sinon retour à `A_VERIFIER`) ; `EXCLUE` retire une réponse de test
  ou de pré-test AVANT la numérotation (elle n'est ni numérotée ni codée).
"""

from __future__ import annotations

from dataclasses import dataclass

from plateforme.codification.fiche import EtatCodification, FicheCodee, ParametresCodification, _txt, construire_fiche
from plateforme.codification.reponses import ReponseBrute, structurer
from plateforme.dictionnaire.modele import Dictionnaire, RoleIdentification

OK, A_VERIFIER, REJETE = "OK", "A_VERIFIER", "REJETE"


EXCLUE = "EXCLUE"


@dataclass(frozen=True)
class DecisionQC:
    statut: str                  # OK | REJETE | EXCLUE (réponse de test ou de pré-test : retirée avant numérotation)
    anomalies_vues: str = ""     # anomalies affichées au moment de la décision (pour un OK)
    auteur: str = ""
    motif: str = ""


def recoder(dico: Dictionnaire, reponses: list[ReponseBrute], params: ParametresCodification,
            numeros_connus: dict[str, int] | None = None, decisions: dict[str, DecisionQC] | None = None) -> list[FicheCodee]:
    numeros_connus = numeros_connus or {}
    decisions = decisions or {}
    vues: set[str] = set()
    uniques = []
    for r in reponses:
        if r.id not in vues and decisions.get(r.id, DecisionQC("")).statut != EXCLUE:
            vues.add(r.id)
            uniques.append(r)
    uniques.sort(key=lambda r: r.horodatage)

    etat = EtatCodification()
    reserves: dict[str, int] = {}
    pris: set[tuple[str, int]] = set()
    for r in uniques:
        s = numeros_connus.get(r.id)
        if not s:
            continue
        enq = _txt(structurer(dico, r.items).identification.get(RoleIdentification.ENQUETEUR)).upper()
        if (enq, s) not in pris:
            pris.add((enq, s))
            reserves[r.id] = s
            etat.sequence[enq] = max(etat.sequence.get(enq, 0), s)

    fiches = []
    for r in uniques:
        f = construire_fiche(dico, r, params, etat, seq_force=reserves.get(r.id, 0))
        d = decisions.get(r.id)
        if d is not None and d.statut == REJETE:
            f.statut = REJETE
        elif d is not None and d.statut == OK and f.statut == A_VERIFIER and d.anomalies_vues == f.valeurs["ANOMALIE"]:
            f.statut = OK
        f.valeurs["STATUTQC"] = f.statut
        f.contact[-1] = f.statut
        fiches.append(f)
    return fiches
