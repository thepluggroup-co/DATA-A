"""API de la console usine : chaque route rend ce que rend la ligne de commande, sans donnée personnelle dans le JSON."""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import pytest
from conftest import PROJET_EDM
from fastapi.testclient import TestClient
from tableur_fictif import ecrire

from plateforme.api.app import app
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.terrain.plan import PlanTerrain

PROJET = PROJET_EDM.name
client = TestClient(app)


@pytest.fixture(scope="module")
def tableur(tmp_path_factory: pytest.TempPathFactory, dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> bytes:
    return ecrire(dico_edm, terrain_edm, tmp_path_factory.mktemp("fictif") / "REPONSES_FICTIVES.xlsx").read_bytes()


def _envoi(tableur: bytes) -> dict[str, tuple[str, bytes, str]]:
    return {"tableur": ("REPONSES_FICTIVES.xlsx", tableur, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}


def test_projets_et_resume() -> None:
    r = client.get("/api/projets")
    assert r.status_code == 200
    p = next(x for x in r.json() if x["id"] == PROJET)
    # 56 variables de questionnaire ; 67 colonnes de masque (= colonnesMasque_ de V11, avec identification, ANOMALIE, STATUTQC)
    assert (p["questions"], p["variables"], p["colonnes_masque"]) == (42, 56, 67)
    assert (p["postes"], p["reserves"], p["objectif_total"], p["quota_total"]) == (8, 3, 500, 500)
    assert [v["prefixe"] for v in p["villes"]] == ["DLA", "YDE", "BAF"]


def test_projet_inconnu_ou_chemin_refuse() -> None:
    assert client.get("/api/projets/inconnu").status_code == 404
    assert client.get("/api/projets/..%2Freference").status_code == 404
    assert client.get("/api/projets/edm_cameroun/dictionnaire/diff", params={"ancienne": "../dictionnaire.yaml"}).status_code == 404


def test_dictionnaire_diagnostic_et_diff() -> None:
    d = client.get(f"/api/projets/{PROJET}/dictionnaire").json()
    assert d["version"] == "03" and len(d["questions"]) == 42 and d["questions"][0]["code"] == "VOUSETES"
    assert sum(d["nb_variables"].values()) == 56
    diag = client.get(f"/api/projets/{PROJET}/dictionnaire/diagnostic").json()
    assert diag["blocages"] == 0 and diag["chemin_sans_cible"] is None
    assert client.get(f"/api/projets/{PROJET}/dictionnaire/versions").json() == ["dictionnaire_v2.yaml"]
    df = client.get(f"/api/projets/{PROJET}/dictionnaire/diff", params={"ancienne": "dictionnaire_v2.yaml"}).json()
    assert df["nouvelle"] == "03" and df["ecarts"]
    attendu = (PROJET_EDM / "versions" / "DIFF_V2_V03.md").read_text(encoding="utf-8")
    assert df["texte"].strip() == attendu.strip()


def test_generations_zip() -> None:
    r = client.get(f"/api/projets/{PROJET}/dictionnaire/generations.zip")
    assert r.status_code == 200
    noms = set(zipfile.ZipFile(io.BytesIO(r.content)).namelist())
    assert {"etiquetage.sps", "livre_de_codes.xlsx", "parametrage.xlsx", "diagnostic_formulaire.md"} <= noms


def test_terrain_et_quotas() -> None:
    t = client.get(f"/api/projets/{PROJET}/terrain").json()
    assert [q["total"] for q in t["quotas"]] == [85, 85, 100, 100, 130]
    assert t["quotas"][4]["villes"] == {"DOUALA": 50, "YAOUNDE": 50, "BAFOUSSAM": 30}


def test_liens_personnels() -> None:
    modele = "https://docs.google.com/forms/d/e/ABC/viewform?usp=pp_url&entry.1=ENQ1&entry.2=Douala"
    r = client.post(f"/api/projets/{PROJET}/deploiement/liens", json={"modele": modele, "enqueteur": "ENQ1", "villes": ["Douala"]})
    assert r.status_code == 200
    par_id = {x["id"]: x for x in r.json()}
    assert par_id["ENQ4"]["lien"].endswith("entry.1=ENQ4&entry.2=Yaound%C3%A9")
    assert par_id["ENQ1"]["qr_png"].startswith("data:image/png;base64,")
    mauvais = client.post(f"/api/projets/{PROJET}/deploiement/liens", json={"modele": modele, "enqueteur": "ENQ9", "villes": ["Douala"]})
    assert mauvais.status_code == 422


def test_suivi_complet_sans_donnee_personnelle(tableur: bytes) -> None:
    r = client.post(f"/api/projets/{PROJET}/suivi", files=_envoi(tableur))
    assert r.status_code == 200, r.text
    s = r.json()
    # 8 postes titulaires × 4 jours × 6 fiches, mais ENQ7 ne démarre qu'à J2 : les fiches restent comptées (le plan ne les rejette pas)
    assert s["reponses"] == s["fiches"] == 8 * 4 * 6
    assert s["jour"] == "2026-10-08"
    assert s["note_de_base"]["collectees"] == s["fiches"]
    assert s["tableau_de_bord"]["total"]["cumul"] == sum(li["cumul"] for li in s["tableau_de_bord"]["lignes"])
    assert {li["id"] for li in s["tableau_de_bord"]["lignes"]} >= {f"ENQ{i}" for i in range(1, 9)}
    assert [c["code"] for c in s["suivi_cibles"]["quotas"]] == [1, 2, 3, 4, 5]
    assert s["rapport"]["jour"] == "2026-10-08" and s["rapport"]["partiel"] is False
    assert s["statut"] is not None
    assert "signales" in s["effet_enqueteur"]
    texte = json.dumps(s, ensure_ascii=False)
    assert "600000" not in texte, "un téléphone de répondant est sorti dans le JSON"
    assert "Quartier fictif" not in texte


def test_suivi_provisoire_a_une_heure_donnee(tableur: bytes) -> None:
    s = client.post(f"/api/projets/{PROJET}/suivi", files=_envoi(tableur), data={"maintenant": "2026-10-06T10:00"}).json()
    assert s["jour"] == "2026-10-06" and s["rapport"]["partiel"] is True
    assert s["fiches"] < 8 * 4 * 6


def test_tableur_invalide() -> None:
    from openpyxl import Workbook
    wb = Workbook()
    assert wb.active is not None
    wb.active.title = "Form Responses 1"
    wb.active.append(["rien", "ici"])
    tampon = io.BytesIO()
    wb.save(tampon)
    r = client.post(f"/api/projets/{PROJET}/suivi", files=_envoi(tampon.getvalue()))
    assert r.status_code == 422 and "en-tête" in r.json()["detail"]
    r = client.post(f"/api/projets/{PROJET}/suivi", files=_envoi(tampon.getvalue()), data={"onglet": "Feuille 9"})
    assert r.status_code == 422 and "onglet" in r.json()["detail"]


def test_archives_suivi_et_base(tableur: bytes, tmp_path: Path) -> None:
    r = client.post(f"/api/projets/{PROJET}/suivi/livrables.zip", files=_envoi(tableur))
    assert r.status_code == 200
    noms = set(zipfile.ZipFile(io.BytesIO(r.content)).namelist())
    assert {"TABLEAU_DE_BORD.xlsx", "TRI_A_PLAT.xlsx", "RAPPORT_2026-10-08.xlsx", "EFFET_ENQUETEUR.xlsx"} <= noms
    r = client.post(f"/api/projets/{PROJET}/base.zip", files=_envoi(tableur))
    assert r.status_code == 200
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert {"BASE_ANALYSE.sav", "BASE_ANALYSE.csv", "NOTE_DE_BASE.txt", "CONTACTS/CONTACTS.xlsx"} <= set(z.namelist())
    assert "600000" not in z.read("BASE_ANALYSE.csv").decode("utf-8"), "la base d'analyse ne doit pas contenir de téléphone"


def test_decisions_appliquees(tableur: bytes) -> None:
    s = client.post(f"/api/projets/{PROJET}/suivi", files=_envoi(tableur)).json()
    premiere = s["tableau_de_bord"]["lignes"][0]["id"]
    assert premiere
    numfiche = "DLA-ENQ1-001"
    dec = f"{numfiche}: {{statut: REJETE, motif: test}}\n".encode()
    s2 = client.post(f"/api/projets/{PROJET}/suivi", files={**_envoi(tableur), "decisions": ("d.yaml", dec, "text/yaml")}).json()
    assert s2["qualite"]["statuts"].get("REJETE", 0) == s["qualite"]["statuts"].get("REJETE", 0) + 1
    inconnu = client.post(f"/api/projets/{PROJET}/suivi",
                          files={**_envoi(tableur), "decisions": ("d.yaml", b"XXX-999: {statut: OK}\n", "text/yaml")})
    assert inconnu.status_code == 422 and "XXX-999" in inconnu.json()["detail"]


def test_api_inconnue_et_sante() -> None:
    assert client.get("/api/nexiste-pas").status_code == 404
    assert client.get("/api/sante").json()["authentification"] is False
