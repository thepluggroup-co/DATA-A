"""Référentiel géographique (M3) : répertoire administratif HDX versionné et localités saisies avec leur source."""

from __future__ import annotations

from pathlib import Path

import pytest
from conftest import REFERENCE
from pydantic import ValidationError

from plateforme.cli import main
from plateforme.geo import referentiel
from plateforme.geo.referentiel import Localite, Referentiel, UniteAdmin

CMR = REFERENCE / "geo" / "CMR"


@pytest.fixture(scope="module")
def ref() -> Referentiel:
    return referentiel.charger(CMR)


def test_niveaux_administratifs_du_cameroun(ref: Referentiel) -> None:
    """CLAUDE.md §M3 : 10 régions et 58 départements ; arrondissements vérifiés à la source (HDX COD-AB : 360)."""
    effectifs = {n: sum(1 for u in ref.unites if u.niveau == n) for n in range(4)}
    assert effectifs == {0: 1, 1: 10, 2: 58, 3: 360}
    assert {u.nom for u in ref.unites if u.niveau == 1} == {"Adamaoua", "Centre", "Est", "Extrême-Nord", "Littoral", "Nord",
                                                           "Nord-Ouest", "Ouest", "Sud", "Sud-Ouest"}
    assert "Licence" in (CMR / "SOURCE.md").read_text(encoding="utf-8")


def test_villes_rattachees_et_quartiers_de_l_organisation_edm(ref: Referentiel) -> None:
    assert [u.nom for u in ref.chemin_admin(ref.localite("DOUALA").pcode)] == ["Cameroun", "Littoral", "Wouri"]
    assert [u.nom for u in ref.chemin_admin(ref.localite("DSCHANG").pcode)] == ["Cameroun", "Ouest", "Menoua", "Dschang"]
    assert len(ref.enfants("DOUALA")) == 18 and len(ref.enfants("YAOUNDE")) == 13 and len(ref.enfants("BAFOUSSAM")) == 8
    assert ref.ville_de("BAFOUSSAM.MARCHE_A").id == "BAFOUSSAM"
    assert [loc.id for loc in ref.chercher("bonaberi")] == ["DOUALA.BONABERI"]                       # graphie de la source
    assert {loc.id for loc in ref.chercher("Centre administratif")} == {"YAOUNDE.CENTRE_ADMINISTRATIF", "BAFOUSSAM.CENTRE_ADMINISTRATIF"}
    assert all(loc.source for loc in ref.localites)


def _ref(**changement: object) -> Referentiel:
    unites = [UniteAdmin(niveau=0, pcode="CM", nom="Cameroun"), UniteAdmin(niveau=1, pcode="CM005", nom="Littoral", parent="CM")]
    locs = [Localite(id="DOUALA", type="ville", nom="Douala", pcode="CM005", source="essai"),
            Localite(id="DOUALA.AKWA", type="quartier", nom="Akwa", parent="DOUALA", source="essai")]
    donnees: dict[str, object] = {"pays": "CMR", "niveaux": {0: "pays", 1: "région"}, "unites": unites, "localites": locs}
    donnees.update(changement)
    return Referentiel.model_validate(donnees)


@pytest.mark.parametrize("changement, message", [
    ({"localites": [Localite(id="DOUALA", type="ville", nom="Douala", pcode="CM999", source="essai")]}, "P-code inconnu"),
    ({"localites": [Localite(id="DOUALA", type="ville", nom="Douala", source="essai")]}, "unité administrative"),
    ({"localites": [Localite(id="DOUALA", type="ville", nom="Douala", pcode="CM005", source="essai"),
                    Localite(id="YAOUNDE.AKWA", type="quartier", nom="Akwa", parent="DOUALA", source="essai")]}, "commencer par"),
    ({"localites": [Localite(id="AKWA", type="quartier", nom="Akwa", parent="DOUALA", source="essai")]}, "absent"),
    ({"unites": [UniteAdmin(niveau=0, pcode="CM", nom="Cameroun"), UniteAdmin(niveau=1, pcode="CM005", nom="Littoral", parent="XX")]}, "parent"),
])
def test_referentiel_incoherent_refuse(changement: dict[str, object], message: str) -> None:
    assert _ref().localite("DOUALA.AKWA").nom == "Akwa"
    with pytest.raises(ValidationError, match=message):
        _ref(**changement)


def test_localite_sans_source_refusee() -> None:
    with pytest.raises(ValidationError):
        Localite(id="DOUALA.X", type="quartier", nom="X", parent="DOUALA", source="")


def test_ligne_de_commande(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["geo", "verifier", str(CMR)]) == 0
    assert "429 unités administratives" in capsys.readouterr().out
    (tmp_path / "localites.yaml").write_text("pays: CMR\nniveaux: {0: pays}\nlocalites: []\n", encoding="utf-8")
    (tmp_path / "admin.csv").write_text("niveau,pcode,nom,nom_en,parent\n0,CM,Cameroun,Cameroon,\n0,CM,Cameroun,Cameroon,\n", encoding="utf-8")
    assert main(["geo", "verifier", str(tmp_path)]) == 1
