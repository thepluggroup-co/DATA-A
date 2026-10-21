from __future__ import annotations

import json

import pandas as pd

from plateforme import assistant
from plateforme.analyse.donnees import JeuDonnees, Variable
from plateforme.assistant import classer, repondre


def test_intentions_routees_vers_des_outils_bornes() -> None:
    assert classer("Résume l'état de cette étude") == "etat_etude"
    assert classer("Où en sont les quotas par ville ?") == "suivi_quotas"
    assert classer("Donne un tri à plat") == "tri_plat"
    assert classer("Rédige une synthèse des priorités") == "synthese"
    assert classer("Bonjour") == "aide"


def test_etat_reponse_fondee_sur_les_validations() -> None:
    resultat = repondre("Résume le statut de l'étude", code="DEMO_A", statut="terrain",
                        analyses=[{"statut": "validee", "titre": "Profil"}, {"statut": "a_valider", "titre": "Quotas"}],
                        recommandations=[{"statut": "validee"}])
    assert "1 analyse(s) validée(s)" in resultat["reponse"]
    assert "Quotas" in resultat["reponse"]
    assert resultat["outil"] == "etat_etude"
    assert any(p["source"] == "analyses.en_attente" and p["valeur"] == "1" for p in resultat["preuves"])


def test_suivi_quotas_produit_des_preuves_par_cible_et_ville() -> None:
    suivi = {"total_realise": 12, "total_quota": 30,
             "lignes": [{"cible": "Ménages", "ville": "Douala", "realise": 12, "quota": 30}]}
    resultat = repondre("Où en sont les quotas par ville ?", code="DEMO_A", suivi=suivi)
    assert "12 fiches réalisées sur 30 prévues" in resultat["reponse"]
    assert resultat["preuves"][-1] == {"source": "quota.Ménages.Douala", "valeur": "12/30"}


def test_tri_plat_masque_les_modalites_sous_le_seuil() -> None:
    table = pd.DataFrame({"PROFIL": [1] * 36 + [2] * 3 + [3]})
    jeu = JeuDonnees(table, {"PROFIL": Variable("PROFIL", "Profil répondant", {1: "Ménage", 2: "Entreprise", 3: "Autre"})})
    resultat = repondre("Donne le tri à plat de Profil répondant", code="DEMO_A", jeu=jeu,
                        variables=[{"nom": "PROFIL", "libelle": "Profil répondant"}], base_min=30, seuil_k=5)
    assert "Ménage : 36 (90.0 %)" in resultat["reponse"]
    assert "Entreprise" not in resultat["reponse"] and "Autre" not in resultat["reponse"]
    assert "4 réponse(s)" in resultat["reponse"] and any("inférieur à 5" in x for x in resultat["limites"])


def test_tri_plat_refuse_base_insuffisante() -> None:
    table = pd.DataFrame({"PROFIL": [1] * 10 + [2] * 10})
    jeu = JeuDonnees(table, {"PROFIL": Variable("PROFIL", "Profil", {1: "Ménage", 2: "Entreprise"})})
    resultat = repondre("Fréquence du profil", jeu=jeu, variables=[{"nom": "PROFIL", "libelle": "Profil"}], base_min=30)
    assert "inférieure au seuil de 30" in resultat["reponse"]


def test_ollama_local_redige_uniquement_depuis_les_preuves(monkeypatch) -> None:
    faits = {"outil": "suivi_quotas", "preuves": [{"source": "suivi.total", "valeur": "271/300"}]}
    contenu = json.dumps({"reponse": "L'étude a réalisé 271 fiches sur 300 prévues."})

    class Reponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self, _limite):
            return json.dumps({"message": {"content": contenu}}).encode()

    class Ouverture:
        def open(self, requete, timeout):
            assert requete.full_url.startswith("http://127.0.0.1:11434/")
            assert timeout == 30
            corps = json.loads(requete.data)
            assert "271/300" in corps["messages"][1]["content"]
            return Reponse()

    monkeypatch.setenv("DATAA_OLLAMA_MODEL", "modele-test")
    monkeypatch.setattr(assistant, "build_opener", lambda *_args: Ouverture())
    assert assistant.rediger_localement("Résume le suivi", faits) == "L'étude a réalisé 271 fiches sur 300 prévues."


def test_ollama_rejette_un_nombre_sans_preuve(monkeypatch) -> None:
    contenu = json.dumps({"reponse": "L'étude compte 999 répondants."})

    class Reponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self, _limite):
            return json.dumps({"message": {"content": contenu}}).encode()

    class Ouverture:
        def open(self, *_args, **_kwargs):
            return Reponse()

    monkeypatch.setenv("DATAA_OLLAMA_MODEL", "modele-test")
    monkeypatch.setattr(assistant, "build_opener", lambda *_args: Ouverture())
    assert assistant.rediger_localement("Résume", {"preuves": [{"valeur": "271/300"}]}) is None


def test_ollama_refuse_un_hote_distant(monkeypatch) -> None:
    monkeypatch.setenv("DATAA_OLLAMA_MODEL", "modele-test")
    monkeypatch.setenv("DATAA_OLLAMA_URL", "https://llm.example.test")
    assert assistant.rediger_localement("Résume", {"preuves": ["fait"]}) is None


def test_ollama_desactive_sans_modele(monkeypatch) -> None:
    monkeypatch.delenv("DATAA_OLLAMA_MODEL", raising=False)
    assert assistant.rediger_localement("Résume", {"preuves": ["fait"]}) is None
