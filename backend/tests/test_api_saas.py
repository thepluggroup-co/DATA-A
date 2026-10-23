"""Phase 7 — API sur un VRAI PostgreSQL, rôle applicatif soumis à la RLS, jeu de démonstration fictif.

Critères (CLAUDE.md §11) : deux clients fictifs isolés ; croisement à la demande refusé sous la base minimale ; audit de
sécurité (authentification, double facteur de l'usine, CSRF, verrouillage, en-têtes, chemins, journal inaltérable).
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from pathlib import Path

import pyotp
import pytest
from fastapi.testclient import TestClient
from postgres_temporaire import dossier_binaires, serveur
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from plateforme.api.app import creer_app
from plateforme.api.contexte import Config
from plateforme.saas import demo
from plateforme.saas.serveur_demo import preparer
from plateforme.stockage.connexion import moteur

pytestmark = pytest.mark.skipif(dossier_binaires() is None, reason="binaires PostgreSQL absents")


@pytest.fixture(scope="module")
def env(tmp_path_factory: pytest.TempPathFactory) -> Iterator[tuple[Config, str]]:
    tmp = tmp_path_factory.mktemp("saas")
    with serveur(tmp / "pg") as url:
        url_app = preparer(url, tmp / "stockage")
        cfg = Config(bd_url=url_app, stockage=tmp / "stockage", cookie_securise=False, tarifs_usine=demo.DEMO / "tarifs.yaml",
                     referentiel=demo.RACINE / "reference" / "geo" / "CMR")
        yield cfg, url


def _client(cfg: Config) -> TestClient:
    return TestClient(creer_app(cfg))


def _connecter(c: TestClient, compte: str, totp: bool = True) -> dict[str, str]:
    r = c.post("/api/auth/connexion", json={"email": demo.COMPTES[compte], "mot_de_passe": demo.MDP_DEMO})
    assert r.status_code == 200, r.text
    moi = r.json()
    if compte == "usine" and totp:
        r = c.post("/api/auth/totp", json={"code": pyotp.TOTP(demo.TOTP_DEMO).now()}, headers={"X-CSRF-Token": moi["csrf"]})
        assert r.status_code == 200, r.text
        moi = r.json()
    return {"X-CSRF-Token": moi["csrf"]}


def test_deux_clients_isoles(env: tuple[Config, str]) -> None:
    cfg, _ = env
    a, b = _client(cfg), _client(cfg)
    _connecter(a, "client_a")
    _connecter(b, "client_b")
    pa, pb = a.get("/api/projets").json(), b.get("/api/projets").json()
    assert [p["code"] for p in pa] == ["DEMO_A"] and [p["code"] for p in pb] == ["DEMO_B"]
    for chemin in ("suivi", "variables", "livrables"):
        assert a.get(f"/api/projets/{pb[0]['id']}/{chemin}").status_code == 404          # projet de B invisible pour A
    liv_b = b.get(f"/api/projets/{pb[0]['id']}/livrables").json()[0]["id"]
    assert a.get(f"/api/livrables/{liv_b}").status_code == 404
    assert len(a.get("/api/factures").json()) == 1 and b.get("/api/factures").json() == []


def test_client_lecteur_consulte_sans_facturation_ni_croisement(env: tuple[Config, str]) -> None:
    cfg, _ = env
    lecteur = _client(cfg)
    identifiants = lecteur.post("/api/auth/connexion", json={
        "email": demo.COMPTES["lecteur_a"], "mot_de_passe": demo.MDP_DEMO,
    })
    assert identifiants.status_code == 200
    assert identifiants.json()["permissions"] == ["projet.lire"]
    headers = {"X-CSRF-Token": identifiants.json()["csrf"]}
    projet = lecteur.get("/api/projets").json()[0]

    assert lecteur.get(f"/api/projets/{projet['id']}/livrables").status_code == 200
    assert lecteur.get("/api/abonnement").status_code == 403
    assert lecteur.get("/api/factures").status_code == 403
    assert lecteur.post(f"/api/projets/{projet['id']}/croisements",
                        json={"ligne": "FREQACHA", "colonne": "VILLEREG"}, headers=headers).status_code == 403


def test_rls_dans_la_base_meme_sans_filtre_applicatif(env: tuple[Config, str]) -> None:
    """Défense en profondeur : avec le rôle applicatif, une requête SANS filtre ne voit que l'organisation du contexte."""
    cfg, _ = env
    m = moteur(cfg.bd_url)
    with m.begin() as c:
        assert c.execute(text("SELECT count(*) FROM projet")).scalar() == 0                # aucun contexte : rien
        org_a = c.execute(text("SELECT id FROM organisation WHERE nom = 'Client A (fictif)'")).scalar()
        c.execute(text("SELECT set_config('app.organisation_id', :o, true)"), {"o": str(org_a)})
        assert c.execute(text("SELECT code FROM projet")).scalars().all() == ["DEMO_A"]
        with pytest.raises(DBAPIError):                                                    # écriture chez B refusée
            org_b = c.execute(text("SELECT id FROM organisation WHERE nom = 'Client B (fictif)'")).scalar()
            c.execute(text("INSERT INTO projet (id, organisation_id, code, nom) VALUES (:i, :o, 'X', 'X')"),
                      {"i": uuid.uuid4(), "o": org_b})
    m.dispose()


def test_suivi_agrege_et_croisement_avec_garde_fous(env: tuple[Config, str]) -> None:
    cfg, _ = env
    a = _client(cfg)
    h = _connecter(a, "client_a")
    pid = a.get("/api/projets").json()[0]["id"]
    outils = a.get("/api/assistant/outils").json()["outils"]
    assert {x["nom"] for x in outils} == {"etat_etude", "suivi_quotas", "tri_plat", "synthese", "aide"}
    assert all(x["mutation"] is False for x in outils)
    s = a.get(f"/api/projets/{pid}/suivi").json()
    assert s["total_quota"] == 300 and s["total_realise"] == sum(li["realise"] for li in s["lignes"]) == 271   # 90 % par case, arrondi
    assert "non probabiliste" in s["mention"]
    assert all(set(li) == {"cible", "ville", "quota", "realise", "taux"} for li in s["lignes"])          # agrégats seulement
    noms = {v["nom"] for v in a.get(f"/api/projets/{pid}/variables").json()}
    assert {"VOUSETES", "VILLEREG", "FREQACHA"} <= noms and "NUMFICHE" not in noms
    r = a.post(f"/api/projets/{pid}/croisements", json={"ligne": "FREQACHA", "colonne": "VILLEREG"}, headers=h)
    assert r.status_code == 200 and r.json()["base"] == 271 and any("non probabiliste" in x for x in r.json()["avertissements"])
    export = a.get(f"/api/projets/{pid}/croisements/{r.json()['id']}/export")
    assert export.status_code == 200 and export.content[:2] == b"PK"
    # sous la base minimale : refusé et journalisé
    r = a.post(f"/api/projets/{pid}/croisements", json={"ligne": "FREQACHA", "colonne": "VOUSETES",
                                                         "filtre": "VILLEREG == 3 and VOUSETES == 2"}, headers=h)
    assert r.status_code == 422 and r.json()["refuse"] and "base minimale" in r.json()["motif"]
    for corps in ({"ligne": "NUMFICHE", "colonne": "VILLEREG"}, {"ligne": "FREQACHA", "colonne": "VILLEREG", "filtre": "__import__('os')"}):
        assert a.post(f"/api/projets/{pid}/croisements", json=corps, headers=h).status_code == 422


def test_assistant_utilise_des_outils_reels_et_fournit_les_preuves(env: tuple[Config, str], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATAA_OLLAMA_MODEL", raising=False)
    cfg, _ = env
    a = _client(cfg)
    h = _connecter(a, "client_a")
    pid = a.get("/api/projets").json()[0]["id"]

    etat = a.post("/api/assistant", json={"question": "Résume l'état et les validations", "projet": pid}, headers=h)
    assert etat.status_code == 200, etat.text
    assert etat.json()["outil"] == "etat_etude"
    assert etat.json()["redaction"] == "deterministe"
    assert etat.json()["preuves"] and etat.json()["verification"]["lecture_seule"]

    quotas = a.post("/api/assistant", json={"question": "Où en sont les quotas par ville ?", "projet": pid}, headers=h)
    assert quotas.status_code == 200, quotas.text
    assert quotas.json()["outil"] == "suivi_quotas" and "271 fiches réalisées sur 300 prévues" in quotas.json()["reponse"]
    assert any(p["source"].startswith("quota.") for p in quotas.json()["preuves"])

    tri = a.post("/api/assistant", json={"question": "Donne le tri à plat de Vous êtes", "projet": pid}, headers=h)
    assert tri.status_code == 200, tri.text
    assert tri.json()["outil"] == "tri_plat" and "base valide 271" in tri.json()["reponse"]
    assert tri.json()["verification"]["publication_automatique"] is False

    synthese = a.post("/api/assistant", json={"question": "Rédige une synthèse des priorités", "projet": pid}, headers=h)
    assert synthese.status_code == 200, synthese.text
    assert synthese.json()["outil"] == "synthese" and synthese.json()["preuves"]
    assert synthese.json()["redaction"] == "deterministe"

    b = _client(cfg)
    hb = _connecter(b, "client_b")
    interdit = b.post("/api/assistant", json={"question": "Résume l'état", "projet": pid}, headers=hb)
    assert interdit.status_code == 404


def test_plafond_de_croisements_de_la_formule(env: tuple[Config, str]) -> None:
    cfg, _ = env
    b = _client(cfg)
    h = _connecter(b, "client_b")
    pid = b.get("/api/projets").json()[0]["id"]
    codes = [b.post(f"/api/projets/{pid}/croisements", json={"ligne": "FREQACHA", "colonne": "VILLEREG"}, headers=h).status_code
             for _ in range(4)]
    assert codes == [200, 200, 200, 403]                                                  # forfait : 3 par mois
    assert b.get("/api/abonnement").json()["croisements_ce_mois"] == 3


def test_csrf_double_facteur_et_roles(env: tuple[Config, str]) -> None:
    cfg, _ = env
    a = _client(cfg)
    h = _connecter(a, "client_a")
    pid = a.get("/api/projets").json()[0]["id"]
    assert a.post(f"/api/projets/{pid}/croisements", json={"ligne": "FREQACHA", "colonne": "VILLEREG"}).status_code == 403
    assert a.post(f"/api/projets/{pid}/croisements", json={"ligne": "FREQACHA", "colonne": "VILLEREG"},
                  headers={"X-CSRF-Token": "faux"}).status_code == 403
    assert a.get("/api/usine/projets").status_code == 403                                 # un client n'entre pas à l'usine
    assert h
    u = _client(cfg)
    hu = _connecter(u, "usine", totp=False)
    assert u.get("/api/usine/projets").status_code == 401                                 # usine sans second facteur
    assert u.post("/api/auth/totp", json={"code": "000000"}, headers=hu).status_code == 401
    hu = _connecter(u, "usine")
    assert {p["code"] for p in u.get("/api/usine/projets").json()} == {"DEMO_A", "DEMO_B"}


def test_verrouillage_apres_echecs(env: tuple[Config, str]) -> None:
    cfg, _ = env
    c = _client(cfg)
    for _ in range(5):
        assert c.post("/api/auth/connexion", json={"email": demo.COMPTES["client_b"], "mot_de_passe": "mauvais"}).status_code == 401
    assert c.post("/api/auth/connexion", json={"email": demo.COMPTES["client_b"], "mot_de_passe": demo.MDP_DEMO}).status_code == 429
    m = moteur(env[1])                                                                    # propriétaire : déblocage pour la suite
    with m.begin() as cx:
        cx.execute(text("UPDATE utilisateur SET bloque_jusqu = NULL, echecs = 0"))
    m.dispose()


def test_usine_documents_partage_facture_paiement_et_audit(env: tuple[Config, str]) -> None:
    cfg, url = env
    u, a = _client(cfg), _client(cfg)
    hu, _ = _connecter(u, "usine"), _connecter(a, "client_a")
    projets = {p["code"]: p for p in u.get("/api/usine/projets").json()}
    pid = projets["DEMO_A"]["id"]
    assert u.post(f"/api/usine/projets/{pid}/verifier", headers=hu).json() == {"coherent": True, "ecarts": []}
    r = u.post(f"/api/usine/projets/{pid}/documents", headers=hu)
    assert r.status_code == 200 and r.json()["documents"] >= 15
    livs = u.get(f"/api/projets/{pid}/livrables").json()
    badges = next(x for x in livs if x["nom"] == "BADGES.docx")
    assert all(x["nom"] != "BADGES.docx" for x in a.get(f"/api/projets/{pid}/livrables").json())    # pas encore partagé
    assert u.patch(f"/api/usine/livrables/{badges['id']}", json={"partage_client": True}, headers=hu).status_code == 200
    assert a.get(f"/api/livrables/{badges['id']}").status_code == 200
    org_a = next(o["id"] for o in u.get("/api/usine/organisations").json() if o["nom"] == "Client A (fictif)")
    f = u.post("/api/usine/factures", json={"organisation_id": org_a, "lignes": [["Étude (fictive)", 1000000]]}, headers=hu).json()
    assert u.post(f"/api/usine/factures/{f['id']}/paiements", json={"montant": 400000, "moyen": "mobile_money"}, headers=hu).json()["statut"] == "emise"
    assert u.post(f"/api/usine/factures/{f['id']}/paiements", json={"montant": 600000, "moyen": "virement"}, headers=hu).json()["statut"] == "payee"
    assert {x["statut"] for x in a.get("/api/factures").json()} == {"emise", "payee"}
    journal = u.get("/api/usine/audit").json()
    assert journal["chaine_integre"] and {"paiement_enregistre", "livrable_partage", "documents_generes"} <= {e["action"] for e in journal["entrees"]}
    m = moteur(url)
    with m.begin() as cx, pytest.raises(DBAPIError, match="inaltérable"):
        cx.execute(text("DELETE FROM journal_audit"))
    m.dispose()


def test_nouveau_client_et_brief(env: tuple[Config, str]) -> None:
    cfg, _ = env
    u = _client(cfg)
    hu = _connecter(u, "usine")
    faible = {"nom": "Client C (fictif)", "admin_email": "c@client-c.demo.invalid", "admin_nom": "C", "mot_de_passe": "court"}
    assert u.post("/api/usine/organisations", json=faible, headers=hu).status_code == 422
    ok = {**faible, "mot_de_passe": "Mot-de-passe-C-2026", "formule": "forfait"}
    assert u.post("/api/usine/organisations", json=ok, headers=hu).status_code == 200
    c = TestClient(creer_app(cfg))
    r = c.post("/api/auth/connexion", json={"email": "c@client-c.demo.invalid", "mot_de_passe": "Mot-de-passe-C-2026"})
    h = {"X-CSRF-Token": r.json()["csrf"]}
    brief = {"titre": "Étude fictive C", "besoin": "Comprendre les achats (fictif)", "objectifs": ["Mesurer la fréquence"],
             "cibles": ["Ménages", "Revendeurs"], "villes": ["DOUALA", "YAOUNDE"], "taille": 200, "debut": "2026-11-02",
             "echeance": "2026-12-18"}
    r = c.post("/api/projets/brief", json=brief, headers=h)
    assert r.status_code == 200 and r.json()["pre_estimation"]["par_ville"] == {"DOUALA": 100, "YAOUNDE": 100}
    assert c.post("/api/projets/brief", json={**brief, "villes": ["ATLANTIS"]}, headers=h).status_code == 422   # jamais de ville inventée
    assert [p["statut"] for p in c.get("/api/projets").json()] == ["brief"]
    assert any(p["code"].startswith("BRIEF_") for p in u.get("/api/usine/projets").json())


def test_en_tetes_et_chemins(env: tuple[Config, str], tmp_path: Path) -> None:
    from fastapi import HTTPException

    from plateforme.api.contexte import chemin_sur

    cfg, _ = env
    r = _client(cfg).get("/api/moi")
    assert r.status_code == 401
    for cle in ("Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"):
        assert cle in r.headers
    assert r.headers["Cache-Control"] == "no-store"
    with pytest.raises(HTTPException):
        chemin_sur(cfg, "../../etc/passwd")
    assert chemin_sur(cfg, "x/y.docx").is_relative_to(cfg.stockage.resolve())


def test_transactions_validees_avant_la_reponse() -> None:
    """Toute dépendance de base de données se ferme AVANT l'envoi de la réponse (scope « function ») : sinon la
    validation suivrait la réponse (relecture trop tôt, échec de validation masqué derrière un 200)."""
    from fastapi.routing import APIRoute

    from plateforme.api.contexte import bd_auth

    app = creer_app(Config(bd_url="postgresql+psycopg://x@127.0.0.1:1/x", stockage=Path(".")))
    noms_bd = {"_bd", "_bd_usine", bd_auth.__name__}
    vues = 0

    def parcourir(dependant: object) -> None:
        nonlocal vues
        for s in getattr(dependant, "dependencies", []):
            if getattr(s.call, "__name__", "") in noms_bd:
                vues += 1
                assert s.scope == "function", getattr(s.call, "__name__", "")
            parcourir(s)

    for route in app.routes:
        if isinstance(route, APIRoute):
            parcourir(route.dependant)
    assert vues >= 20


def test_nettoyage_epargne_un_serveur_vivant(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Le nettoyage des orphelins ne touche jamais un dossier dont le processus propriétaire vit encore (défaut trouvé
    le 19/10/2026 : la fin des tests arrêtait la démonstration ouverte par le fondateur)."""
    import os
    import tempfile

    from plateforme.outils import postgres_temporaire as pt

    monkeypatch.setattr(tempfile, "gettempdir", lambda: str(tmp_path))
    vivant, mort = tmp_path / f"{pt.PREFIXE_DEMO}vivant", tmp_path / f"{pt.PREFIXE_DEMO}mort"
    vivant.mkdir()
    mort.mkdir()
    pt.marquer_proprietaire(vivant)
    (mort / pt.FICHIER_PROPRIETAIRE).write_text("999999999", encoding="ascii")          # aucun processus de ce numéro
    pt.arreter_orphelins()
    assert vivant.exists() and not mort.exists()
    assert pt.processus_vivant(os.getpid()) and not pt.processus_vivant(999999999)


def test_usine_plan_echantillonnage_lecture_ecriture(env: tuple[Config, str]) -> None:
    cfg, _ = env
    u, a = _client(cfg), _client(cfg)
    hu, _ = _connecter(u, "usine"), _connecter(a, "client_a")
    pid = next(p["id"] for p in u.get("/api/usine/projets").json() if p["code"] == "DEMO_A")
    assert a.get(f"/api/usine/projets/{pid}/echantillonnage").status_code == 403          # un client n'entre pas à l'usine
    plan = u.get(f"/api/usine/projets/{pid}/echantillonnage").json()
    assert plan["total"] > 0 and plan["villes"] and plan["quotas"] and plan["ecarts"] == []
    corps = {"version": plan["version"], "methode": plan["methode"], "taille": plan["taille"], "quotas": plan["quotas"]}
    # nombre négatif : refusé par le modèle du domaine, rien n'est écrit
    mauvais = {**corps, "quotas": [{**plan["quotas"][0], "villes": {v: -1 for v in plan["villes"]}}, *plan["quotas"][1:]]}
    assert u.put(f"/api/usine/projets/{pid}/echantillonnage", json=mauvais, headers=hu).status_code == 422
    assert u.get(f"/api/usine/projets/{pid}/echantillonnage").json()["version"] == plan["version"]
    # déplacement d'un quota d'une ville à l'autre : total inchangé, version incrémentée
    q0 = dict(plan["quotas"][0])
    v1, v2 = plan["villes"][0], plan["villes"][1]
    assert q0["villes"][v1] > 0
    q0["villes"] = {**q0["villes"], v1: q0["villes"][v1] - 1, v2: q0["villes"][v2] + 1}
    r = u.put(f"/api/usine/projets/{pid}/echantillonnage", json={**corps, "quotas": [q0, *plan["quotas"][1:]]}, headers=hu)
    assert r.status_code == 200, r.text
    nouveau = r.json()
    assert nouveau["total"] == plan["total"] and nouveau["version"] != plan["version"]
    assert nouveau["par_ville"][v1] == plan["par_ville"][v1] - 1
    # version périmée : refus
    assert u.put(f"/api/usine/projets/{pid}/echantillonnage", json=corps, headers=hu).status_code == 409
