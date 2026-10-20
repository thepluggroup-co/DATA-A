"""Phase 8 — API de l'application enquêteur sur un VRAI PostgreSQL (rôle applicatif soumis à la RLS).

Critère : 50 fiches saisies hors connexion, synchronisées sans perte ni doublon. Ici, côté serveur : un lot de 50 fiches
est reçu, codé et numéroté ; son renvoi (coupure en plein envoi, double clic) ne crée aucun doublon.
"""

from __future__ import annotations

import base64
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pyotp
import pytest
from fastapi.testclient import TestClient
from postgres_temporaire import dossier_binaires, serveur
from sqlalchemy import text

from plateforme.api.app import creer_app
from plateforme.api.contexte import Config
from plateforme.saas import demo
from plateforme.saas.serveur_demo import preparer
from plateforme.stockage.connexion import moteur

pytestmark = pytest.mark.skipif(dossier_binaires() is None, reason="binaires PostgreSQL absents")
JPEG_MINIMAL = base64.b64encode(b"\xff\xd8\xff\xe0" + b"\x00" * 200 + b"\xff\xd9").decode()


@pytest.fixture(scope="module")
def env(tmp_path_factory: pytest.TempPathFactory) -> Iterator[tuple[Config, str]]:
    tmp = tmp_path_factory.mktemp("terrain")
    with serveur(tmp / "pg") as url:
        url_app = preparer(url, tmp / "stockage")
        yield Config(bd_url=url_app, stockage=tmp / "stockage", cookie_securise=False), url


def _activer(c: TestClient) -> dict[str, str]:
    r = c.post("/api/terrain/activation", json={"code": demo.CODE_MISSION_DEMO})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['jeton']}"}


def _fiche(formulaire: dict[str, Any], k: int, enqueteur: str | None = None) -> dict[str, Any]:
    """Fiche remplie comme sur le téléphone : valeurs fixes (enquêteur, ville), première ou k-ième modalité, textes."""
    items = []
    for ch in formulaire["champs"]:
        if ch["type"] == "fixe":
            v: Any = enqueteur if (enqueteur and ch["cle"] == "enqueteur") else ch["valeur_fixe"]
        elif ch["options"]:
            v = ch["options"][k % len(ch["options"])]["valeur"]
            if ch["type"] == "choix_multiple":
                v = [v]
        elif ch["type"] == "texte":
            v = f"Quartier fictif {k}" if ch["cle"] == "quartier" else ""
        else:
            v = None
        items.append({"titre": ch["titre"], "valeur": v})
    fin = datetime(2026, 11, 13, 8, 0, tzinfo=UTC) + timedelta(minutes=12 * k)
    return {"id": str(uuid.uuid4()), "debut": (fin - timedelta(minutes=9)).isoformat(), "fin": fin.isoformat(), "items": items,
            "position": {"latitude": 4.0510564, "longitude": 9.7678687, "precision_m": 25}}


def test_activation_mission_et_formulaire(env: tuple[Config, str]) -> None:
    c = TestClient(creer_app(env[0]))
    assert c.post("/api/terrain/activation", json={"code": "FAUX-CODE-0000"}).status_code == 401
    assert c.get("/api/terrain/mission").status_code == 401                                   # sans jeton
    m = c.get("/api/terrain/mission", headers=_activer(c)).json()
    assert (m["enqueteur"], m["ville"]["libelle"]) == ("ENQ1", "Douala")
    champs = {ch["cle"]: ch for ch in m["formulaire"]["champs"]}
    assert champs["enqueteur"]["valeur_fixe"] == "ENQ1" and champs["VILLEREG"]["valeur_fixe"] == "Douala"
    assert champs["VOUSETES"]["obligatoire"] and [q["cible"] for q in m["quotas"]] == ["Parent d'élève", "Enseignant", "Librairie / revendeur"]
    assert m["zones"] and "contrôle qualité" in m["mention_gps"]


def test_cinquante_fiches_sans_perte_ni_doublon(env: tuple[Config, str]) -> None:
    cfg, url = env
    c = TestClient(creer_app(cfg))
    h = _activer(c)
    formulaire = c.get("/api/terrain/mission", headers=h).json()["formulaire"]
    fiches = [_fiche(formulaire, k) for k in range(50)]
    fiches[0]["photo_jpeg"] = JPEG_MINIMAL
    premier = c.post("/api/terrain/fiches", json={"fiches": fiches[:30]}, headers=h).json()
    assert (premier["nouvelles"], premier["refusees"]) == (30, [])
    # coupure en plein envoi : le téléphone renvoie TOUT (les 30 déjà reçues + les 20 restantes)
    second = c.post("/api/terrain/fiches", json={"fiches": fiches}, headers=h).json()
    assert (second["nouvelles"], second["deja_recues"], second["refusees"]) == (20, 30, [])
    assert sorted(second["acceptees"]) == sorted(f["id"] for f in fiches)
    m = moteur(url)
    with m.connect() as cx:
        assert cx.execute(text("SELECT count(*), count(DISTINCT id_externe) FROM reponse_brute WHERE source = 'APPLI:ENQ1'")).one() == (50, 50)
        numeros = cx.execute(text("SELECT numfiche FROM fiche_codee ORDER BY numfiche")).scalars().all()
        assert len(numeros) == 50 and numeros[0] == "DLA-ENQ1-001" and numeros[-1] == "DLA-ENQ1-050"
        n, duree, lat = cx.execute(text("SELECT count(*), min(duree_s), max(latitude) FROM meta_fiche")).one()
        assert (n, duree, float(lat)) == (50, 540, 4.0511)                                    # position arrondie à ~11 m
        assert cx.execute(text("SELECT count(*) FROM photo")).scalar() == 1
        assert "latitude" not in str(cx.execute(text("SELECT valeurs FROM fiche_codee LIMIT 1")).scalar())    # GPS hors des réponses
    m.dispose()
    assert c.get("/api/terrain/mission", headers=h).json()["mes_fiches"]["total"] == 50


def test_refus_autre_poste_contenu_modifie_photo_invalide_et_revocation(env: tuple[Config, str]) -> None:
    cfg, _ = env
    c = TestClient(creer_app(cfg))
    h = _activer(c)
    formulaire = c.get("/api/terrain/mission", headers=h).json()["formulaire"]
    autre = _fiche(formulaire, 1, enqueteur="ENQ2")
    r = c.post("/api/terrain/fiches", json={"fiches": [autre]}, headers=h).json()
    assert r["nouvelles"] == 0 and "mission" in r["refusees"][0]["motif"]
    f = _fiche(formulaire, 2)
    assert c.post("/api/terrain/fiches", json={"fiches": [f]}, headers=h).json()["nouvelles"] == 1
    f["items"][-1]["valeur"] = "contenu modifié après envoi"
    r = c.post("/api/terrain/fiches", json={"fiches": [f]}, headers=h).json()
    assert r["nouvelles"] == 0 and "immuable" in r["refusees"][0]["motif"]
    g = _fiche(formulaire, 3)
    g["photo_jpeg"] = base64.b64encode(b"pas une image").decode()
    r = c.post("/api/terrain/fiches", json={"fiches": [g]}, headers=h).json()
    assert r["nouvelles"] == 1 and "photo" in r["refusees"][0]["motif"]
    assert c.post("/api/terrain/signalements", json={"type": "refus", "texte": "Refus de répondre (fictif)"}, headers=h).status_code == 200
    # téléphone perdu : l'usine révoque la mission
    u = TestClient(creer_app(cfg))
    jeton = u.post("/api/auth/connexion", json={"email": demo.COMPTES["usine"], "mot_de_passe": demo.MDP_DEMO}).json()["csrf"]
    hu = {"X-CSRF-Token": u.post("/api/auth/totp", json={"code": pyotp.TOTP(demo.TOTP_DEMO).now()},
                                 headers={"X-CSRF-Token": jeton}).json()["csrf"]}
    pid = next(p["id"] for p in u.get("/api/usine/projets").json() if p["code"] == "DEMO_A")
    missions = u.get(f"/api/usine/projets/{pid}/missions").json()
    enq1 = next(x for x in missions if x["enqueteur"] == "ENQ1")
    assert enq1["fiches"] >= 52
    nouveaux = u.post(f"/api/usine/projets/{pid}/missions", headers=hu).json()
    assert "ENQ1" not in nouveaux["codes"] and len(nouveaux["codes"]) == 7 and all(len(x) == 24 for x in nouveaux["codes"].values())
    rev = u.patch(f"/api/usine/missions/{enq1["id"]}", json={"actif": False}, headers=hu)
    assert rev.status_code == 200 and rev.json()["actif"] is False, rev.text
    assert c.get("/api/terrain/mission", headers=h).status_code == 403
    assert c.post("/api/terrain/activation", json={"code": demo.CODE_MISSION_DEMO}).status_code == 401
