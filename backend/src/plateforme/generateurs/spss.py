"""Syntaxe SPSS d'étiquetage, générée depuis les colonnes du masque.

Garde-fous issus du terrain (CLAUDE.md, section 5) :
- aucun `CD`, `GET FILE` ni chemin absolu : la syntaxe s'applique au jeu de données ACTIF ;
- le jeu actif est vérifié en tête (`DISPLAY DICTIONARY` sur la première et la dernière
  variable : SPSS s'arrête en erreur si l'une manque, au lieu d'étiqueter le mauvais fichier) ;
- longueurs vérifiées AVANT génération : un dépassement lève une erreur au lieu d'être
  tronqué silencieusement par SPSS.
"""

from __future__ import annotations

from dataclasses import dataclass

from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion
from plateforme.generateurs.masque import Colonne

# Limites IBM SPSS Statistics, en octets UTF-8 (documentation IBM, à revérifier à chaque version majeure).
LIMITE_NOM_VARIABLE = 64
LIMITE_ETIQUETTE_VARIABLE = 256
LIMITE_ETIQUETTE_VALEUR = 120
LIMITE_NOM_ENSEMBLE = 64


class SyntaxeInvalide(ValueError):
    """Une étiquette ou un nom dépasse une limite SPSS."""


@dataclass(frozen=True)
class EnsembleMultiple:
    nom: str
    label: str
    variables: tuple[str, ...]


def _octets(texte: str) -> int:
    return len(texte.encode("utf-8"))


def _q(texte: str) -> str:
    """Chaîne SPSS entre apostrophes (apostrophe doublée)."""
    return "'" + texte.replace("'", "''") + "'"


def _liste(noms: list[str], par_ligne: int = 8) -> list[str]:
    return ["  " + " ".join(noms[i:i + par_ligne]) for i in range(0, len(noms), par_ligne)]


def ensembles_multiples(dico: Dictionnaire) -> list[EnsembleMultiple]:
    return [EnsembleMultiple(f"${q.code}", dico.titre_question(q), tuple(q.variables()))
            for q in dico.questions if q.type is TypeQuestion.CHOIX_MULTIPLE]


def verifier_limites(colonnes: list[Colonne], ensembles: list[EnsembleMultiple]) -> list[str]:
    """Liste des dépassements de limites SPSS (vide si tout est conforme)."""
    erreurs: list[str] = []
    for c in colonnes:
        if _octets(c.code) > LIMITE_NOM_VARIABLE:
            erreurs.append(f"{c.code} : nom de variable trop long")
        if _octets(c.label) > LIMITE_ETIQUETTE_VARIABLE:
            erreurs.append(f"{c.code} : étiquette de variable de {_octets(c.label)} octets (> {LIMITE_ETIQUETTE_VARIABLE})")
        for code, lib in c.valeurs or ():
            if _octets(lib) > LIMITE_ETIQUETTE_VALEUR:
                erreurs.append(f"{c.code}={code} : étiquette de valeur de {_octets(lib)} octets (> {LIMITE_ETIQUETTE_VALEUR})")
    for e in ensembles:
        if _octets(e.nom) > LIMITE_NOM_ENSEMBLE:
            erreurs.append(f"{e.nom} : nom d'ensemble de réponses multiples trop long")
        if _octets(e.label) > LIMITE_ETIQUETTE_VARIABLE:
            erreurs.append(f"{e.nom} : étiquette d'ensemble trop longue")
    return erreurs


def syntaxe_etiquetage(dico: Dictionnaire, colonnes: list[Colonne]) -> str:
    """Syntaxe .sps (UTF-8) : formats, étiquettes, valeurs manquantes, niveaux de mesure, ensembles multiples."""
    ensembles = ensembles_multiples(dico)
    erreurs = verifier_limites(colonnes, ensembles)
    if erreurs:
        raise SyntaxeInvalide("; ".join(erreurs))
    speciaux = sorted(dico.codes_speciaux.tous())
    L: list[str] = [
        "* Encoding: UTF-8.",
        "* " + "=" * 74 + ".",
        f"* {dico.etude} — dictionnaire version {dico.version}.",
        "* Étiquetage du jeu de données ACTIF : aucune lecture ni écriture de fichier, aucun chemin.",
        f"* {len(colonnes)} variables, de {colonnes[0].code} à {colonnes[-1].code}. Fichier généré : ne pas modifier à la main.",
        "* " + "=" * 74 + ".",
        "",
        "* Contrôle du jeu actif : erreur immédiate si ces variables n'existent pas.",
        f"DISPLAY DICTIONARY /VARIABLES={colonnes[0].code} {colonnes[-1].code}.",
        "",
    ]
    numeriques = [c for c in colonnes if c.est_numerique()]
    if numeriques:
        L.append("FORMATS")
        L += [f"  {c.code} ({c.spss})" for c in numeriques]
        L[-1] += "."
        L.append("")
    L.append("VARIABLE LABELS")
    L += [("  " if i == 0 else "  / ") + f"{c.code} {_q(c.label)}" for i, c in enumerate(colonnes)]
    L[-1] += "."
    L.append("")
    etiquetees = [c for c in colonnes if c.valeurs]
    if etiquetees:
        L.append("VALUE LABELS")
        for i, c in enumerate(etiquetees):
            L.append(("  " if i == 0 else "  / ") + c.code)
            L += [f"    {code} {_q(lib)}" for code, lib in c.valeurs or ()]
        L[-1] += "."
        L.append("")
    codees = [c.code for c in etiquetees]
    if codees:
        L.append("MISSING VALUES")
        L += _liste(codees)
        L[-1] += f" ({', '.join(str(s) for s in speciaux)})."
        L.append("")
    for mesure in ("NOMINAL", "ORDINAL", "SCALE"):
        noms = [c.code for c in colonnes if (c.mesure or ("NOMINAL" if not c.est_numerique() else None)) == mesure]
        if noms:
            L.append("VARIABLE LEVEL")
            L += _liste(noms)
            L[-1] += f" ({mesure})."
    if ensembles:
        L += ["", "MRSETS"]
        for e in ensembles:
            L.append(f"  /MDGROUP NAME={e.nom} LABEL={_q(e.label)}")
            L.append("    CATEGORYLABELS=VARLABELS VALUE=1 VARIABLES=")
            L += ["  " + ligne for ligne in _liste(list(e.variables))]
        L.append(f"  /DISPLAY NAME=[{' '.join(e.nom for e in ensembles)}].")
    L += ["", "EXECUTE.", ""]
    return "\n".join(L)
