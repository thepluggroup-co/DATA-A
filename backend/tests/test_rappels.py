"""Rappels de contrôle : priorités, au moins un contrôle aléatoire par enquêteur, reproductibilité."""

from __future__ import annotations

from plateforme.codification.fiche import FicheCodee
from plateforme.codification.qualite import COPIE
from plateforme.controle.rappels import tirer_rappels


def _f(i: int, enq: str, anomalie: str = "", statut: str = "OK", tel: str = "690000000") -> FicheCodee:
    contact = [""] * 17
    contact[9] = tel
    return FicheCodee(f"R{i}", f"DLA-{enq}-{i:03d}", {"CODEENQU": enq, "ANOMALIE": anomalie}, [], statut, contact)


def test_priorites_et_controle_aleatoire() -> None:
    fiches = [_f(1, "ENQ1", "DELAI_COURT", "A_VERIFIER"), _f(2, "ENQ1"), _f(3, "ENQ1"), _f(4, "ENQ1", "TEL_DOUBLON", "A_VERIFIER"),
              _f(5, "ENQ1"), _f(6, "ENQ1"),
              _f(7, "ENQ2"), _f(8, "ENQ2", tel=""),                       # sans téléphone : jamais tiré
              _f(9, "ENQ2", statut="REJETE"), _f(10, "ENQ2", statut="ANNULEE"),
              _f(11, "ENQ3"), _f(12, "ENQ3")]
    rappels = tirer_rappels(fiches, n_par_enqueteur=3, graine=42, doublons={"R11": COPIE})
    enq1 = [r for r in rappels if r.enqueteur == "ENQ1"]
    assert [r.priorite for r in enq1] == [2, 2, 0]
    assert {r.numfiche for r in enq1[:2]} == {"DLA-ENQ1-001", "DLA-ENQ1-004"}
    assert [r.numfiche for r in rappels if r.enqueteur == "ENQ2"] == ["DLA-ENQ2-007"]
    assert next((r.numfiche, r.priorite) for r in rappels if r.enqueteur == "ENQ3") == ("DLA-ENQ3-011", 3)
    assert tirer_rappels(fiches, 3, 42, {"R11": COPIE}) == rappels, "tirage non reproductible"
