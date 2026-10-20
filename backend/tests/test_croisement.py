"""Croisements à la demande : garde-fous (base minimale, k-anonymat, quotas), tests de colonnes, commentaire."""

from __future__ import annotations

import pandas as pd
import pytest

from plateforme.analyse.croisement import CroisementRefuse, Demande, Garde, croiser
from plateforme.analyse.donnees import JeuDonnees, Variable


def _jeu(n_c: int = 60) -> JeuDonnees:
    # Ville 1 : 70 % de « Oui » ; ville 2 : 30 % ; ville 3 : petite (n_c fiches)
    villes = [1] * 100 + [2] * 100 + [3] * n_c
    reps = [1] * 70 + [2] * 30 + [1] * 30 + [2] * 70 + ([1, 2] * n_c)[:n_c]
    table = pd.DataFrame({"VILLE": villes, "REP": reps})
    return JeuDonnees(table, {"VILLE": Variable("VILLE", "Ville", {1.0: "Douala", 2.0: "Yaoundé", 3.0: "Bafoussam"}),
                              "REP": Variable("REP", "Réponse", {1.0: "Oui", 2.0: "Non"})})


def test_croisement_significatif_lettres_et_commentaire() -> None:
    r = croiser(_jeu(), Demande("REP", "VILLE"))
    assert r.base == 260 and r.bases_colonnes == [100, 100, 60]
    oui = r.cellules[0]
    assert round(oui[0].pct or 0, 1) == 70.0 and "B" in oui[0].lettres and "A" not in oui[1].lettres
    assert "varie selon" in r.commentaire and "V de Cramér" in r.commentaire
    assert any("non probabiliste" in a for a in r.avertissements)


def test_base_minimale_refus_et_colonne_sous_le_seuil() -> None:
    with pytest.raises(CroisementRefuse, match="sous la base minimale"):
        croiser(_jeu(), Demande("REP", "VILLE", filtre="VILLE == 3"), Garde(base_min=100))
    r = croiser(_jeu(n_c=10), Demande("REP", "VILLE"), Garde(base_min=30, k=3))
    assert r.cellules[0][2].pct is None and r.cellules[0][2].effectif == 5              # effectifs seuls
    assert any("sous la base minimale" in a for a in r.avertissements)


def test_k_anonymat_masque_et_refus() -> None:
    r = croiser(_jeu(n_c=6), Demande("REP", "VILLE"), Garde(base_min=5, k=5))
    assert r.cellules[0][2].effectif is None and r.cellules[0][2].pct is None           # 3 répondants : masqué
    petit = JeuDonnees(pd.DataFrame({"VILLE": [1, 1, 2, 2], "REP": [1, 2, 1, 2]}), _jeu().variables)
    with pytest.raises(CroisementRefuse, match="isolerait"):
        croiser(petit, Demande("REP", "VILLE"), Garde(base_min=1, k=5))


def test_demande_invalide_refusee() -> None:
    for d in (Demande("INCONNUE", "VILLE"), Demande("REP", "REP"), Demande("REP", "VILLE", filtre="import os")):
        with pytest.raises(CroisementRefuse):
            croiser(_jeu(), d)


def test_aucun_ecart_commentaire_descriptif() -> None:
    table = pd.DataFrame({"VILLE": [1] * 50 + [2] * 50, "REP": [1, 2] * 50})
    r = croiser(JeuDonnees(table, _jeu().variables), Demande("REP", "VILLE"))
    assert "descriptives" in r.commentaire and all(not c.lettres for li in r.cellules for c in li)
