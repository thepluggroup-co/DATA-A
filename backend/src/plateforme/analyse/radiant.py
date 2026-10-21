"""Échange versionné avec Radiant, sans transfert de contacts ni validation automatique des résultats."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pandas.api.types import is_numeric_dtype

from plateforme.analyse.donnees import JeuDonnees

EXCLUES = {"NUMFICHE", "ID_CASE", "NUMENQUE", "CODEENQU", "IDREPONSE"}
TERMES_PERSONNELS = {"ADRESSE", "CONTACT", "COURRIEL", "EMAIL", "GPS", "LATITUDE", "LONGITUDE", "NOM",
                    "PRENOM", "TELEPHONE", "TEL", "WHATSAPP"}
PREFIXES_PERSONNELS = ("TEL", "PHONE", "GPS", "LATITUDE", "LONGITUDE", "CONTACT", "COURRIEL", "EMAIL",
                       "ADRESSE", "PRENOM", "NOMREP", "NOMENQ")


class EchangeRadiantInvalide(ValueError):
    """Paquet ou retour Radiant invalide, non rattachable à la base source."""


@dataclass(frozen=True)
class PaquetRadiant:
    chemin: Path
    version: str
    empreinte: str
    lignes: int
    variables: tuple[str, ...]


def _exportable(nom: str, label: str) -> bool:
    nom_normalise = nom.upper()
    if nom_normalise in EXCLUES or nom_normalise.startswith(PREFIXES_PERSONNELS):
        return False
    texte = unicodedata.normalize("NFKD", f"{nom} {label}").encode("ascii", "ignore").decode().upper()
    tokens = set(re.sub(r"[^A-Z0-9]+", " ", texte).split())
    return not tokens.intersection(TERMES_PERSONNELS)


def _fichiers(jd: JeuDonnees) -> tuple[bytes, bytes, list[str]]:
    colonnes = [nom for nom in jd.table.columns if nom in jd.variables and is_numeric_dtype(jd.table[nom].dtype)
                and _exportable(nom, jd.variables[nom].label)]
    if not colonnes:
        raise EchangeRadiantInvalide("aucune variable numérique exportable après exclusion des identifiants et champs personnels")
    table = jd.table.loc[:, colonnes]
    csv = table.to_csv(index=False, na_rep="", lineterminator="\n", float_format="%.15g").encode("utf-8")
    dictionnaire = {
        nom: {"libelle": jd.variables[nom].label, "mesure": jd.variables[nom].mesure,
              "modalites": {str(code): libelle for code, libelle in sorted(jd.variables[nom].valeurs.items())},
              "manquants": sorted(jd.variables[nom].manquants)}
        for nom in colonnes
    }
    codebook = json.dumps(dictionnaire, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return csv, codebook, colonnes


def exporter_paquet(jd: JeuDonnees, chemin: str | Path) -> PaquetRadiant:
    """Écrit un paquet immuable par empreinte : CSV analytique, dictionnaire, script R et gabarit de retour."""
    csv, codebook, colonnes = _fichiers(jd)
    empreinte = hashlib.sha256(csv + b"\0" + codebook).hexdigest()
    version = empreinte[:16]
    manifeste = json.dumps({"schema": 1, "outil": "Radiant", "version": version, "sha256": empreinte,
                            "lignes": len(jd.table), "variables": colonnes,
                            "exclusions": sorted(EXCLUES), "texte_libre": "non exporté"},
                           ensure_ascii=False, indent=2).encode("utf-8")
    retour = json.dumps({"schema": 1, "source_sha256": empreinte, "resultats": []}, ensure_ascii=False, indent=2).encode("utf-8")
    script = ("# Paquet DATA'A pour analyse locale avec Radiant.\n"
              "# Le CSV ne contient que des variables numériques analytiques.\n"
              "donnees <- read.csv('donnees.csv', check.names = FALSE, na.strings = c(''))\n"
              "print(dim(donnees))\n"
              "print(names(donnees))\n"
              "radiant::radiant()\n").encode()
    guide = ("# Échange DATA'A ↔ Radiant\n\n"
             f"Version source : `{version}` (SHA-256 `{empreinte}`).\n\n"
             "1. Décompresser ce paquet dans un dossier local autorisé.\n"
             "2. Ouvrir `ouvrir_radiant.R` dans R avec Radiant installé; charger `donnees.csv` dans Radiant.\n"
             "3. Exporter les résultats revus par l’analyste et renseigner `retour_radiant.json`.\n"
             "4. Dans DATA'A, valider le retour avec `plateforme analyse radiant-retour`; il sera marqué `a_valider`.\n\n"
             "Les retours ne modifient jamais les données ni le rapport. Ne pas ajouter de données personnelles au retour.\n").encode()
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    contenu = {"donnees.csv": csv, "dictionnaire.json": codebook, "MANIFESTE.json": manifeste,
               "ouvrir_radiant.R": script, "retour_radiant.json": retour, "LISEZMOI.md": guide}
    with zipfile.ZipFile(chemin, "w") as paquet:
        for nom, donnees in contenu.items():
            entree = zipfile.ZipInfo(nom, date_time=(2026, 1, 1, 0, 0, 0))
            entree.compress_type = zipfile.ZIP_DEFLATED
            paquet.writestr(entree, donnees)
    return PaquetRadiant(chemin, version, empreinte, len(jd.table), tuple(colonnes))


def importer_retour(paquet: str | Path, retour: str | Path, sortie: str | Path) -> Path:
    """Valide le rattachement au paquet et écrit une proposition; aucun résultat n'est approuvé automatiquement."""
    try:
        with zipfile.ZipFile(paquet) as archive:
            manifeste = json.loads(archive.read("MANIFESTE.json"))
            codebook = archive.read("dictionnaire.json")
            table = archive.read("donnees.csv")
            variables = set(json.loads(codebook))
        donnees = json.loads(Path(retour).read_text(encoding="utf-8"))
    except (OSError, KeyError, json.JSONDecodeError, zipfile.BadZipFile) as e:
        raise EchangeRadiantInvalide(f"paquet ou retour illisible : {e}") from e
    if not isinstance(manifeste, dict) or not isinstance(donnees, dict):
        raise EchangeRadiantInvalide("manifeste ou retour : objet JSON attendu")
    empreinte = manifeste.get("sha256")
    empreinte_recalculee = hashlib.sha256(table + b"\0" + codebook).hexdigest()
    if empreinte != empreinte_recalculee:
        raise EchangeRadiantInvalide("paquet Radiant altéré : empreinte des données/dictionnaire invalide")
    if donnees.get("schema") != 1 or donnees.get("source_sha256") != empreinte:
        raise EchangeRadiantInvalide("retour non rattaché à cette version de la base Radiant")
    resultats = donnees.get("resultats")
    if not isinstance(resultats, list) or len(resultats) > 100:
        raise EchangeRadiantInvalide("le retour doit contenir au plus 100 résultats")
    requis = {"titre", "methode", "variables", "resultat", "code_r", "limites"}
    normalises: list[dict[str, Any]] = []
    for i, resultat in enumerate(resultats, start=1):
        if not isinstance(resultat, dict) or set(resultat) != requis:
            raise EchangeRadiantInvalide(f"résultat {i} : champs attendus {sorted(requis)}")
        if not all(isinstance(resultat[k], str) and resultat[k].strip() for k in ("titre", "methode", "resultat", "code_r")):
            raise EchangeRadiantInvalide(f"résultat {i} : titre, méthode, résultat et code R sont obligatoires")
        noms = resultat["variables"]
        limites = resultat["limites"]
        if (not isinstance(noms, list) or not noms or any(not isinstance(n, str) for n in noms) or
            not set(noms) <= variables or not isinstance(limites, list) or
            any(not isinstance(x, str) or len(x) > 1000 for x in limites)):
            raise EchangeRadiantInvalide(f"résultat {i} : variable absente du dictionnaire ou limites invalides")
        if any(len(resultat[k]) > limite for k, limite in (("titre", 300), ("methode", 120), ("resultat", 10_000), ("code_r", 30_000))):
            raise EchangeRadiantInvalide(f"résultat {i} : champ trop long")
        normalises.append({**resultat, "statut": "a_valider", "source_sha256": empreinte})
    chemin = Path(sortie)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps({"schema": 1, "source_sha256": empreinte, "outil": "Radiant",
                                  "statut": "a_valider", "resultats": normalises}, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    return chemin
