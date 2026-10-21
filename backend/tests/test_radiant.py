from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pandas as pd
import pytest

from plateforme.analyse.donnees import JeuDonnees, Variable
from plateforme.analyse.radiant import EchangeRadiantInvalide, exporter_paquet, importer_retour


@pytest.fixture
def jeu() -> JeuDonnees:
    table = pd.DataFrame({"ID_CASE": [1, 2], "NUMENQUE": [1, 2], "VOUSETES": [1, 2], "LATITUDE": [4.0, 5.0],
                          "TELREP": [690000001, 690000002], "LIBRE": ["Texte privé", "Autre texte"]})
    variables = {"ID_CASE": Variable("ID_CASE"), "NUMENQUE": Variable("NUMENQUE"),
                 "VOUSETES": Variable("VOUSETES", "Profil", {1: "Ménage", 2: "Entreprise"}),
                 "LATITUDE": Variable("LATITUDE", "Latitude GPS"), "TELREP": Variable("TELREP"),
                 "LIBRE": Variable("LIBRE", "Verbatim")}
    return JeuDonnees(table, variables, description="jeu fictif")


def test_paquet_anonymise_versionne_et_deterministe(jeu: JeuDonnees, tmp_path: Path) -> None:
    premier = exporter_paquet(jeu, tmp_path / "premier.zip")
    second = exporter_paquet(jeu, tmp_path / "second.zip")
    assert premier.version == second.version and premier.empreinte == second.empreinte
    with zipfile.ZipFile(premier.chemin) as archive:
        manifeste = json.loads(archive.read("MANIFESTE.json"))
        csv = archive.read("donnees.csv").decode("utf-8")
        assert manifeste["lignes"] == 2 and manifeste["variables"] == ["VOUSETES"]
        assert "ID_CASE" not in csv and "NUMENQUE" not in csv and "LATITUDE" not in csv
        assert "TELREP" not in csv and "LIBRE" not in csv and "Texte privé" not in csv
        assert b"radiant::radiant()" in archive.read("ouvrir_radiant.R")


def test_retour_lie_a_la_source_et_reste_a_valider(jeu: JeuDonnees, tmp_path: Path) -> None:
    paquet = exporter_paquet(jeu, tmp_path / "radiant.zip")
    retour = tmp_path / "retour.json"
    retour.write_text(json.dumps({"schema": 1, "source_sha256": paquet.empreinte, "resultats": [{
        "titre": "Profil des répondants", "methode": "fréquences", "variables": ["VOUSETES"],
        "resultat": "Deux groupes observés", "code_r": "table(VOUSETES)", "limites": ["Base fictive, n=2"]}]}), encoding="utf-8")
    sortie = importer_retour(paquet.chemin, retour, tmp_path / "proposition.json")
    resultat = json.loads(sortie.read_text(encoding="utf-8"))
    assert resultat["statut"] == resultat["resultats"][0]["statut"] == "a_valider"
    assert resultat["resultats"][0]["source_sha256"] == paquet.empreinte


def test_retour_refuse_une_autre_version_et_une_variable_inconnue(jeu: JeuDonnees, tmp_path: Path) -> None:
    paquet = exporter_paquet(jeu, tmp_path / "radiant.zip")
    retour = tmp_path / "retour.json"
    base = {"schema": 1, "source_sha256": paquet.empreinte, "resultats": [{
        "titre": "Résultat", "methode": "test", "variables": ["ID_CASE"], "resultat": "1",
        "code_r": "summary(x)", "limites": []}]}
    retour.write_text(json.dumps(base), encoding="utf-8")
    with pytest.raises(EchangeRadiantInvalide, match="variable absente"):
        importer_retour(paquet.chemin, retour, tmp_path / "sortie.json")
    base["source_sha256"] = "0" * 64
    retour.write_text(json.dumps(base), encoding="utf-8")
    with pytest.raises(EchangeRadiantInvalide, match="non rattaché"):
        importer_retour(paquet.chemin, retour, tmp_path / "sortie.json")


def test_retour_refuse_un_paquet_altere(jeu: JeuDonnees, tmp_path: Path) -> None:
    paquet = exporter_paquet(jeu, tmp_path / "radiant.zip")
    retour = tmp_path / "retour.json"
    retour.write_text(json.dumps({"schema": 1, "source_sha256": paquet.empreinte, "resultats": []}), encoding="utf-8")
    altere = tmp_path / "altere.zip"
    with zipfile.ZipFile(paquet.chemin) as source, zipfile.ZipFile(altere, "w") as cible:
        for nom in source.namelist():
            contenu = source.read(nom)
            if nom == "donnees.csv":
                contenu += b"2\n"
            cible.writestr(nom, contenu)
    with pytest.raises(EchangeRadiantInvalide, match="altéré"):
        importer_retour(altere, retour, tmp_path / "sortie.json")
