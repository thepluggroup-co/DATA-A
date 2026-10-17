"""La codification reproduit `construireLigne_` de V11 à l'identique (67 valeurs + ligne de contact).

Fiches générées au hasard avec une graine fixe (reproductible), puis passées dans V11 (Node) et dans
le moteur Python avec le même état partagé (numérotation, délais, téléphones).
"""

from __future__ import annotations

import json
import random
import shutil
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from conftest import SCRIPT_V11

from plateforme.codification.fiche import EtatCodification, ParametresCodification, construire_fiche
from plateforme.codification.reponses import ItemReponse, ReponseBrute
from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion
from plateforme.generateurs.masque import colonnes_masque
from plateforme.terrain.plan import PlanTerrain

ORACLE = Path(__file__).with_name("oracle_codification.js")


# Enquêteurs du test, indépendants de l'état du terrain réel : ENQ9 et ENQ10 volontairement SANS ville
# (anomalie ZONE_ENQ_NON_PARAMETREE), ENQ99 absent (ENQUETEUR_INCONNU).
ENQUETEURS_TEST = {"ENQ1": "DOUALA", "ENQ2": "DOUALA", "ENQ3": "DOUALA", "ENQ4": "YAOUNDE", "ENQ5": "YAOUNDE",
                   "ENQ6": "YAOUNDE", "ENQ7": "BAFOUSSAM", "ENQ8": "BAFOUSSAM", "ENQ9": "", "ENQ10": ""}


def _params(terrain: PlanTerrain) -> ParametresCodification:
    return ParametresCodification(villes=terrain.villes_masque(), enqueteurs=ENQUETEURS_TEST)


def _items_aleatoires(dico: Dictionnaire, rnd: random.Random, tels: list[str]) -> list[dict[str, Any]]:
    """Une fiche au format V11 : [{titre, rep, lignes}]."""
    langue = rnd.choice(["fr", "fr", "fr", "en"])
    items: list[dict[str, Any]] = []
    ident = {d.role.value: d for d in dico.identification}
    enq = rnd.choice(["ENQ1", "ENQ2", "ENQ4", "ENQ7", "ENQ8", "ENQ9", "ENQ10", "enq3", "ENQ99", "", "ENQ5"])
    valeurs_ident = {
        "enqueteur": enq, "quartier": rnd.choice(["Makepe", " Bastos ", "", "Akwa  Nord"]), "site": rnd.choice(["Marché A", ""]),
        "nom": rnd.choice(["Client test", ""]), "telephone": rnd.choice(tels),
        "email": rnd.choice(["", "test@exemple.cm"]), "accord_recontact": rnd.choice(["Oui", "Non", "Yes", "No", "", "Peut-être"]),
    }
    for role, val in valeurs_ident.items():
        if rnd.random() < 0.95:
            items.append({"titre": ident[role].libelles["fr"], "rep": val, "lignes": None})
    vide = rnd.random() < 0.05
    for q in dico.questions:
        if vide and q.prerempli is None:
            continue
        titre = dico.titre_question(q, langue)
        lib = [m.libelles.get(langue, m.libelles["fr"]) for m in q.modalites]
        saute = rnd.random() < 0.08
        if q.type is TypeQuestion.CHOIX_UNIQUE:
            choix = rnd.choice([*lib, *lib, *lib, "Réponse inconnue", "  " + rnd.choice(lib).upper() + " "] +
                               [a for m in q.modalites for a in m.alias])
            rep: Any = "" if saute else choix
        elif q.type is TypeQuestion.CHOIX_MULTIPLE:
            rep = [] if saute else rnd.sample(lib, rnd.randint(1, len(lib))) + (["Inconnu"] if rnd.random() < 0.05 else [])
        elif q.type is TypeQuestion.GRILLE:
            lignes = [li.libelles.get(langue, li.libelles["fr"]) for li in q.lignes]
            rnd.shuffle(lignes)
            rep = [rnd.choice([*lib, "", "?"]) for _ in lignes]
            items.append({"titre": titre, "rep": [] if saute else rep, "lignes": lignes})
            continue
        else:
            rep = rnd.choice(["", "Plus de stock", "  idée  "])
        items.append({"titre": titre, "rep": rep, "lignes": None})
        if langue == "en" and rnd.random() < 0.3:                      # version française laissée vide (formulaire bilingue)
            items.append({"titre": dico.titre_question(q, "fr"), "rep": "" if q.type is not TypeQuestion.CHOIX_MULTIPLE else [],
                          "lignes": None})
    rnd.shuffle(items)
    return items


def _oracle(terrain: PlanTerrain, fiches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    node = shutil.which("node")
    if node is None:
        pytest.fail("Node.js est requis pour l'oracle V11")
    entree = {"script": str(SCRIPT_V11), "enqueteurs": ENQUETEURS_TEST, "seuilDelai": 6,
              "fiches": fiches}
    res = subprocess.run([node, str(ORACLE)], input=json.dumps(entree).encode("utf-8"), capture_output=True, check=False)
    assert res.returncode == 0, res.stderr.decode("utf-8", "replace")
    sortie: list[dict[str, Any]] = json.loads(res.stdout.decode("utf-8"))
    return sortie


def _reponse(i: int, f: dict[str, Any]) -> ReponseBrute:
    items = tuple(ItemReponse(x["titre"], x["rep"], tuple(x["lignes"]) if x["lignes"] is not None else None) for x in f["liste"])
    return ReponseBrute(id=f"R{i}", horodatage=datetime.fromtimestamp(f["horodatage"] / 1000, UTC), items=items)


@pytest.mark.parametrize("graine", [1, 2, 3, 4, 5])
def test_identique_a_v11(graine: int, dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> None:
    rnd = random.Random(graine)
    tels = ["", "", "694 38 82 96", "+237694388296", "237 677000001", "677000001", "699.11.22.33", "abc"]
    t = datetime(2026, 10, 5, 7, 50, tzinfo=UTC)
    fiches = []
    for _ in range(120):
        t += timedelta(seconds=rnd.choice([30, 150, 210, 330, 360, 389, 390, 400, 900, 3600, 14 * 3600]))
        fiches.append({"liste": _items_aleatoires(dico_edm, rnd, tels), "horodatage": int(t.timestamp() * 1000)})
    attendu = _oracle(terrain_edm, fiches)
    cols = colonnes_masque(dico_edm, terrain_edm.villes_masque())
    etat = EtatCodification()
    params = _params(terrain_edm)
    for i, (f, a) in enumerate(zip(fiches, attendu, strict=True)):
        fiche = construire_fiche(dico_edm, _reponse(i, f), params, etat)
        obtenu = fiche.ligne(cols)
        ecarts = {c.code: (o, e) for c, o, e in zip(cols, obtenu, a["ligne"], strict=True) if o != e}
        assert ecarts == {}, f"fiche {i} : {ecarts}"
        assert fiche.contact == a["contact"], f"fiche {i} (contact)"


def test_toutes_les_anomalies_sont_couvertes(dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> None:
    """Le jeu aléatoire déclenche chaque anomalie au moins une fois (sinon le test d'identité ne prouve rien)."""
    rnd = random.Random(1)
    tels = ["", "", "694 38 82 96", "+237694388296", "237 677000001", "677000001", "699.11.22.33", "abc"]
    t = datetime(2026, 10, 5, 7, 50, tzinfo=UTC)
    etat, params, vues = EtatCodification(), _params(terrain_edm), set()
    for i in range(600):
        t += timedelta(seconds=rnd.choice([30, 150, 210, 330, 360, 389, 390, 400, 900, 3600, 14 * 3600]))
        f = {"liste": _items_aleatoires(dico_edm, rnd, tels), "horodatage": int(t.timestamp() * 1000)}
        vues |= {a.split(":")[0] for a in construire_fiche(dico_edm, _reponse(i, f), params, etat).anomalies}
    assert vues >= {"CODE_INCONNU", "ENQUETEUR_INCONNU", "ZONE_ENQ_NON_PARAMETREE", "VILLE_DIFFERENTE_ZONE", "TEL_DOUBLON",
                    "DELAI_COURT", "FICHE_VIDE", "Q1_VIDE", "INCOHERENCE_Q35_Q38", "INCOHERENCE_Q7_Q37", "INCOHERENCE_Q23",
                    "INCOHERENCE_Q25_Q26"}, vues
