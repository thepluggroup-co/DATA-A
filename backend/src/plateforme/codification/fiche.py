"""Fiche codifiée complète (`construireLigne_` de V11) : numéro, variables administratives, anomalies, statut, contact.

Le N° de fiche `<préfixe ville>-<enquêteur>-<NNN>` est attribué une fois : un numéro déjà attribué
(`seq_force`) est conservé tel quel lors d'un recodage. Les coordonnées du répondant sortent dans une
ligne CONTACT séparée, jamais dans les variables d'analyse.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from zoneinfo import ZoneInfo

from plateforme.codification.coder import ValeurCodee, coder_questions
from plateforme.codification.reponses import ReponseBrute, ReponseStructuree, Valeur, structurer
from plateforme.dictionnaire.modele import Dictionnaire, Question, RoleIdentification
from plateforme.generateurs.masque import Colonne, Ville
from plateforme.noyau.textes import cle, normaliser

R = RoleIdentification

ENTETE_CONTACTS = ("N° FICHE", "DATE", "HEURE", "ENQUÊTEUR", "VILLE", "QUARTIER / ZONE", "SITE PRÉCIS",
                   "NOM / RAISON SOCIALE", "PROFIL (Q1)", "TÉLÉPHONE", "E-MAIL", "ACCORD RECONTACT",
                   "PRODUITS ACHETÉS (Q9)", "MARQUE PRINCIPALE (Q12)", "MONTANT MOYEN (Q8)", "CANAL DE CONTACT PRÉFÉRÉ (Q33)",
                   "STATUT QC")
# Questions reprises dans la ligne CONTACT de V11 (codes de variables, pour ne pas dépendre des numéros)
QUESTIONS_CONTACT = ("VOUSETES", "PRODACHE", "MAACPLSO", "MONMOYAC", "CACOPREF")


@dataclass(frozen=True)
class ParametresCodification:
    villes: list[Ville]
    enqueteurs: dict[str, str]            # ENQ1 -> id de ville, ou "" si non paramétrée
    seuil_delai_min: int = 6
    fuseau: str = "Africa/Douala"
    indicatif_pays: str = "237"


@dataclass
class EtatCodification:
    """État partagé entre fiches, dans l'ordre chronologique (numérotation, délais, téléphones vus)."""

    sequence: dict[str, int] = field(default_factory=dict)
    derniere: dict[str, int] = field(default_factory=dict)     # enquêteur -> horodatage en ms
    telephones: set[str] = field(default_factory=set)


@dataclass
class FicheCodee:
    id_reponse: str
    numfiche: str
    valeurs: dict[str, ValeurCodee]
    anomalies: list[str]
    statut: str
    contact: list[str]

    def ligne(self, colonnes: list[Colonne]) -> list[ValeurCodee]:
        return [self.valeurs.get(c.code, "") for c in colonnes]


def _txt(x: Valeur) -> str:
    if isinstance(x, list | tuple):
        return ", ".join(str(y) for y in x if y)
    return normaliser(x)


def _arrondi_js(x: float) -> int:
    """Math.round de JavaScript (0,5 arrondi vers le haut), différent de round() de Python."""
    return math.floor(x + 0.5)


def _libelle_reference(dico: Dictionnaire, q: Question | None, texte: str) -> str:
    """Libellé de la langue de référence pour une réponse saisie dans une autre langue (`fr_` de V11)."""
    if q is None:
        return texte
    k = cle(texte)
    for m in q.modalites:
        if cle(m.libelles.get(dico.langue_reference, "")) == k:
            return texte
    for m in q.modalites:
        if any(cle(t) == k for lg, t in m.libelles.items() if lg != dico.langue_reference):
            return m.libelles[dico.langue_reference]
    return texte


def _reponse_contact(dico: Dictionnaire, structure: ReponseStructuree, code: str) -> str:
    q = next((x for x in dico.questions if x.code == code), None)
    if q is None or q.numero not in structure.questions:
        return ""
    v = structure.questions[q.numero].valeur
    if isinstance(v, list | tuple):
        return ", ".join(_libelle_reference(dico, q, str(y)) for y in v if y)
    return normaliser(_libelle_reference(dico, q, normaliser(v)))


def construire_fiche(dico: Dictionnaire, reponse: ReponseBrute, params: ParametresCodification, etat: EtatCodification,
                     seq_force: int = 0) -> FicheCodee:
    structure = structurer(dico, reponse.items)
    codage = coder_questions(dico, structure)
    v, anomalies = codage.valeurs, list(codage.anomalies)
    nr = dico.codes_speciaux.non_reponse
    ident = structure.identification
    enq = _txt(ident.get(R.ENQUETEUR)).upper()

    ville: Ville | None = None
    question_ville = next((q for q in dico.questions if q.prerempli == "ville"), None)
    if enq not in params.enqueteurs:
        anomalies.append("ENQUETEUR_INCONNU")
    else:
        ville = next((x for x in params.villes if x.id == params.enqueteurs[enq]), None)
        if ville is None:                                       # enquêteur connu mais ville non saisie
            code_ville = v.get(question_ville.code) if question_ville else None
            ville = next((x for x in params.villes if x.code == code_ville), None)
            anomalies.append("ZONE_ENQ_NON_PARAMETREE")

    seq = seq_force if seq_force > 0 else etat.sequence.get(enq, 0) + 1
    etat.sequence[enq] = max(etat.sequence.get(enq, 0), seq)
    v["NUMFICHE"] = f"{ville.prefixe if ville else 'XXX'}-{enq or 'SANSID'}-{seq:03d}"
    v["CODEENQU"] = enq
    v["CODEZONE"] = ville.code if ville else nr
    v["QUARTIER"] = _txt(ident.get(R.QUARTIER))
    v["SITEENQU"] = _txt(ident.get(R.SITE))
    accord = _txt(ident.get(R.ACCORD_RECONTACT))
    v["ACCRECON"] = 1 if re.fullmatch(r"oui|yes", cle(accord)) else 2 if re.fullmatch(r"non|no", cle(accord)) else nr

    tel = _txt(ident.get(R.TELEPHONE))
    tel_cle = re.sub(r"\D", "", tel)
    tel_cle = tel_cle[len(params.indicatif_pays):] if tel_cle.startswith(params.indicatif_pays) else tel_cle
    if tel_cle:
        if tel_cle in etat.telephones:
            anomalies.append("TEL_DOUBLON")
        etat.telephones.add(tel_cle)

    local = reponse.horodatage.astimezone(ZoneInfo(params.fuseau))
    jour = local.strftime("%Y-%m-%d")
    v["DATEENQU"] = jour
    v["HEUREENQ"] = local.strftime("%H:%M")
    v["DELAIPRE"] = ""
    t = int(reponse.horodatage.timestamp() * 1000)
    prec = etat.derniere.get(enq)
    if prec is not None and datetime.fromtimestamp(prec / 1000, ZoneInfo(params.fuseau)).strftime("%Y-%m-%d") == jour:
        delai = _arrondi_js((t - prec) / 60000)
        if delai >= 0:
            v["DELAIPRE"] = delai
            if delai < params.seuil_delai_min:
                anomalies.append("DELAI_COURT")
    etat.derniere[enq] = max(prec or 0, t)
    if ville is not None and question_ville is not None:
        vr = v.get(question_ville.code)
        if vr != nr and vr != ville.code:
            anomalies.append("VILLE_DIFFERENTE_ZONE")

    v["ANOMALIE"] = " | ".join(anomalies)
    statut = "A_VERIFIER" if anomalies else "OK"
    v["STATUTQC"] = statut
    contact = [str(v["NUMFICHE"]), jour, str(v["HEUREENQ"]), enq, ville.libelle if ville else "", str(v["QUARTIER"]),
               str(v["SITEENQU"]), _txt(ident.get(R.NOM))] + [""] * 9
    contact[8] = _reponse_contact(dico, structure, QUESTIONS_CONTACT[0])
    contact[9], contact[10], contact[11] = tel, _txt(ident.get(R.EMAIL)), accord or "NR"
    contact[12:16] = [_reponse_contact(dico, structure, c) for c in QUESTIONS_CONTACT[1:]]
    contact[16] = statut
    return FicheCodee(reponse.id, str(v["NUMFICHE"]), v, anomalies, statut, contact)
