"""Colonnes du masque de dépouillement (ordre SPSS), générées depuis le dictionnaire.

Reproduit `colonnesMasque_()` de V11 : variables administratives, puis une ou plusieurs
colonnes par question, puis les variables de contrôle qualité.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion


@dataclass(frozen=True)
class Ville:
    """Ville d'enquête (décision D-005 : la « zone » de V11 est la ville)."""

    code: int
    id: str
    libelle: str
    prefixe: str


@dataclass(frozen=True)
class Colonne:
    section: str
    code: str
    label: str
    spss: str
    mesure: str | None = None
    valeurs: tuple[tuple[int, str], ...] | None = None
    groupe: str | None = None

    def est_numerique(self) -> bool:
        return self.spss.startswith("F")


SECTION_ADMIN = "Administratif"
SECTION_CONTROLE = "Contrôle qualité"


def colonnes_administratives(villes: list[Ville], dico: Dictionnaire) -> list[Colonne]:
    nr = dico.codes_speciaux.non_reponse
    lib_nr = dico.texte(dico.codes_speciaux.libelles[nr])
    zones = (*tuple((v.code, v.libelle) for v in villes), (nr, "Enquêteur inconnu"))
    return [
        Colonne(SECTION_ADMIN, "NUMFICHE", "N° de fiche", "A20"),
        Colonne(SECTION_ADMIN, "CODEENQU", "Identifiant enquêteur", "A6"),
        Colonne(SECTION_ADMIN, "CODEZONE", "Zone d'étude", "F2.0", "NOMINAL", zones),
        Colonne(SECTION_ADMIN, "QUARTIER", "Quartier / zone", "A60"),
        Colonne(SECTION_ADMIN, "SITEENQU", "Site précis / repère", "A80"),
        Colonne(SECTION_ADMIN, "DATEENQU", "Date de l'enquête", "SDATE10"),
        Colonne(SECTION_ADMIN, "HEUREENQ", "Heure de soumission", "A5"),
        Colonne(SECTION_ADMIN, "DELAIPRE", "Minutes depuis la fiche précédente du même enquêteur", "F4.0", "SCALE"),
        Colonne(SECTION_ADMIN, "ACCRECON", "Accepte d'être recontacté à des fins commerciales", "F2.0", "NOMINAL",
                ((1, "Oui"), (2, "Non"), (nr, lib_nr))),
    ]


def colonnes_controle() -> list[Colonne]:
    return [
        Colonne(SECTION_CONTROLE, "ANOMALIE", "Anomalies détectées automatiquement", "A200"),
        Colonne(SECTION_CONTROLE, "STATUTQC", "Statut contrôle qualité", "A10"),
    ]


def colonnes_questions(dico: Dictionnaire) -> list[Colonne]:
    nr = dico.codes_speciaux.non_reponse
    lib_nr = dico.texte(dico.codes_speciaux.libelles[nr])
    cols: list[Colonne] = []
    for q in dico.questions:
        section = dico.texte(dico.section(q.section).libelles)
        titre = dico.titre_question(q)
        mods = tuple((m.code, dico.texte(m.libelles)) for m in q.modalites)
        if q.type is TypeQuestion.CHOIX_UNIQUE:
            valeurs = mods + (((q.autre.code, dico.texte(q.autre.libelles)),) if q.autre else ()) + ((nr, lib_nr),)
            cols.append(Colonne(section, q.code, titre, "F2.0", q.mesure.value if q.mesure else None, valeurs))
            if q.autre:
                cols.append(Colonne(section, q.autre.variable, f"{titre} - {dico.texte(q.autre.libelles)} (précisez)",
                                    f"A{q.autre.longueur}"))
        elif q.type is TypeQuestion.CHOIX_MULTIPLE:
            base = f"Q{q.numero}. {dico.texte(q.libelles)}"
            binaires = tuple((c, dico.texte(t)) for c, t in sorted(dico.libelles_choix_multiple.items(), reverse=True))
            for m in q.modalites:
                assert m.variable is not None  # garanti par la validation du modèle
                cols.append(Colonne(section, m.variable, f"{base} - {dico.texte(m.libelles)}", "F2.0", "NOMINAL",
                                    (*binaires, (nr, lib_nr)), q.code))
        elif q.type is TypeQuestion.GRILLE:
            base = re.sub(r"\s*\?$", "", titre)
            for li in q.lignes:
                cols.append(Colonne(section, li.variable, f"{base} - {dico.texte(li.libelles)}", "F2.0",
                                    q.mesure.value if q.mesure else None, (*mods, (nr, lib_nr))))
        elif q.type is TypeQuestion.NUMERIQUE:
            cols.append(Colonne(section, q.code, titre, "F8.2", q.mesure.value if q.mesure else "SCALE"))
        elif q.type is TypeQuestion.DATE:
            cols.append(Colonne(section, q.code, titre, "SDATE10"))
        else:
            cols.append(Colonne(section, q.code, titre, f"A{q.longueur}"))
    return cols


def colonnes_masque(dico: Dictionnaire, villes: list[Ville]) -> list[Colonne]:
    """Toutes les colonnes du masque, dans l'ordre SPSS."""
    return colonnes_administratives(villes, dico) + colonnes_questions(dico) + colonnes_controle()
