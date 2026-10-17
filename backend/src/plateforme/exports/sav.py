"""Export SPSS `.sav` natif, relu et vérifié après écriture.

Garde-fous issus du terrain (CLAUDE.md, section 5) :
- pas de CSV à réimporter : le .sav porte lui-même étiquettes, valeurs manquantes, mesures et formats ;
- aucune chaîne tronquée : la largeur d'une variable texte est au moins celle de sa plus longue valeur ;
- limites SPSS contrôlées avant écriture (generateurs/spss.py) ;
- le fichier écrit est RELU et comparé à ce qui devait être écrit ; tout écart lève une erreur ;
- les ensembles de réponses multiples, que `pyreadstat` n'écrit pas (paramètres de `write_sav`
  vérifiés : aucun pour MRSETS), sont fournis dans une syntaxe d'accompagnement sans chemin ;
- les coordonnées des répondants ne sont jamais dans le .sav (fichier CONTACTS séparé).
"""

from __future__ import annotations

import datetime as dt
import math
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from plateforme.codification.fiche import FicheCodee
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.exports.tableaux import NomDeFichierInvalide, verifier_nom
from plateforme.generateurs.masque import Colonne
from plateforme.generateurs.spss import SyntaxeInvalide, ensembles_multiples, verifier_limites


class ExportInvalide(RuntimeError):
    """Le fichier relu ne correspond pas à ce qui devait être écrit."""


@dataclass(frozen=True)
class ResultatExport:
    chemin: Path
    lignes: int
    variables: int
    syntaxe_mrsets: Path | None


def _largeur(c: Colonne, valeurs: list[Any]) -> int:
    declaree = int(c.spss[1:]) if c.spss[1:].isdigit() else 1
    plus_longue = max((len(str(v).encode("utf-8")) for v in valeurs if v not in (None, "")), default=1)
    return max(declaree, plus_longue)


def _valeur(c: Colonne, v: Any) -> Any:
    if c.spss.startswith("F"):
        return math.nan if v in ("", None) else float(v)
    if c.spss.startswith(("SDATE", "DATE", "EDATE", "ADATE")):
        return dt.date.fromisoformat(str(v)) if v else None
    return "" if v is None else str(v)


def _lignes_de_80_octets(texte: str) -> list[str]:
    """Découpe en lignes de 80 octets UTF-8 au plus (un « é » compte pour 2 octets)."""
    largeur = 80
    while largeur > 10:
        lignes = textwrap.wrap(texte, width=largeur)
        if all(len(li.encode("utf-8")) <= 80 for li in lignes):
            return lignes
        largeur -= 5
    raise ExportInvalide("note impossible à découper en lignes de 80 octets")


def syntaxe_mrsets(dico: Dictionnaire) -> str:
    ens = ensembles_multiples(dico)
    L = ["* Encoding: UTF-8.", f"* {dico.etude} — ensembles de réponses multiples (non stockés dans le .sav).",
         "* À exécuter sur le .sav ouvert : aucune lecture de fichier, aucun chemin.",
         f"DISPLAY DICTIONARY /VARIABLES={' '.join(e.variables[0] for e in ens)}.", "", "MRSETS"]
    for e in ens:
        nom_label = e.label.replace("'", "''")
        L.append(f"  /MDGROUP NAME={e.nom} LABEL='{nom_label}'")
        L.append(f"    CATEGORYLABELS=VARLABELS VALUE=1 VARIABLES={' '.join(e.variables)}")
    L += [f"  /DISPLAY NAME=[{' '.join(e.nom for e in ens)}].", ""]
    return "\n".join(L)


def exporter_sav(dico: Dictionnaire, colonnes: list[Colonne], fiches: list[FicheCodee], chemin: str | Path,
                 libelle_fichier: str = "", note: str = "") -> ResultatExport:
    import pandas as pd
    import pyreadstat

    chemin = Path(chemin)
    try:
        verifier_nom(chemin, ".sav")
    except NomDeFichierInvalide as e:
        raise ExportInvalide(str(e)) from e
    erreurs = verifier_limites(colonnes, ensembles_multiples(dico))
    if erreurs:
        raise SyntaxeInvalide("; ".join(erreurs))
    brutes = {c.code: [f.valeurs.get(c.code, "") for f in fiches] for c in colonnes}
    donnees = {c.code: [_valeur(c, v) for v in brutes[c.code]] for c in colonnes}
    formats = {c.code: (f"A{_largeur(c, brutes[c.code])}" if c.spss.startswith("A") else c.spss) for c in colonnes}
    df = pd.DataFrame(donnees, columns=[c.code for c in colonnes])
    for c in colonnes:
        if c.spss.startswith("F"):
            df[c.code] = df[c.code].astype("float64")
    speciaux = sorted(dico.codes_speciaux.tous())
    etiquettes = {c.code: {float(k): lib for k, lib in c.valeurs} for c in colonnes if c.valeurs}
    manquants: dict[str, list[Any]] = {c.code: [float(s) for s in speciaux] for c in colonnes if c.valeurs}
    mesures = {c.code: (c.mesure or ("nominal" if not c.est_numerique() else "scale")).lower() for c in colonnes}
    chemin.parent.mkdir(parents=True, exist_ok=True)
    notes = _lignes_de_80_octets(note) or None             # format SPSS : lignes de document de 80 OCTETS au plus
    pyreadstat.write_sav(df, str(chemin), file_label=libelle_fichier[:64], note=notes,
                         column_labels={c.code: c.label for c in colonnes}, variable_value_labels=etiquettes,
                         missing_ranges=manquants, variable_measure=mesures, variable_format=formats)
    verifier_sav(chemin, colonnes, donnees, formats, etiquettes, speciaux)
    mrsets = None
    if ensembles_multiples(dico):
        mrsets = chemin.with_name(chemin.stem + "_ENSEMBLES_MULTIPLES.sps")
        mrsets.write_text(syntaxe_mrsets(dico), encoding="utf-8")
    return ResultatExport(chemin, len(fiches), len(colonnes), mrsets)


def verifier_sav(chemin: Path, colonnes: list[Colonne], donnees: dict[str, list[Any]], formats: dict[str, str],
                 etiquettes: dict[str, dict[float, str]], speciaux: list[int]) -> None:
    """Relit le .sav et compare tout ce qui devait y être écrit ; lève ExportInvalide à la première différence."""
    import pyreadstat

    df, meta = pyreadstat.read_sav(str(chemin), user_missing=True)
    pb: list[str] = []
    if list(df.columns) != [c.code for c in colonnes]:
        pb.append("ordre ou liste des variables")
    if len(df) != len(next(iter(donnees.values()), [])):
        pb.append(f"{len(df)} lignes relues")
    for c in colonnes:
        if meta.column_names_to_labels.get(c.code) != c.label:
            pb.append(f"{c.code} : étiquette de variable")
        relu_fmt = str(meta.original_variable_types.get(c.code))
        if formats[c.code].startswith("A"):
            # pyreadstat ajuste la largeur stockée aux données (A255 si tous les textes font moins de 255 octets) :
            # seule une largeur INFÉRIEURE au plus long texte serait une troncature.
            plus_longue = max((len(str(v).encode("utf-8")) for v in donnees[c.code] if v), default=0)
            if not relu_fmt.startswith("A") or int(relu_fmt[1:]) < plus_longue:
                pb.append(f"{c.code} : format {relu_fmt} trop étroit pour un texte de {plus_longue} octets")
        elif relu_fmt != formats[c.code]:
            pb.append(f"{c.code} : format {relu_fmt} au lieu de {formats[c.code]}")
        if c.code in etiquettes:
            relues = {float(k): v for k, v in (meta.variable_value_labels.get(c.code) or {}).items()}
            if relues != etiquettes[c.code]:
                pb.append(f"{c.code} : étiquettes de valeurs")
            # pyreadstat relit chaque valeur manquante discrète comme une plage {"lo": x, "hi": x}
            manq = sorted(float(r["lo"]) if isinstance(r, dict) else float(str(r)) for r in meta.missing_ranges.get(c.code, []))
            if manq != [float(s) for s in speciaux]:
                pb.append(f"{c.code} : valeurs manquantes {manq}")
        for i, (attendu, relu) in enumerate(zip(donnees[c.code], df[c.code].tolist(), strict=True)):
            vide_a = attendu in ("", None) or (isinstance(attendu, float) and math.isnan(attendu))
            vide_r = relu in ("", None) or (isinstance(relu, float) and math.isnan(relu))
            if not (vide_a and vide_r) and attendu != relu:
                pb.append(f"{c.code} : valeur de la ligne {i + 1} modifiée à l'écriture (troncature ?)")
                break
    if pb:
        raise ExportInvalide(f"{chemin.name} : " + " ; ".join(pb[:20]))
