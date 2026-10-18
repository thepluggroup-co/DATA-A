"""Tests d'intégration de la synchronisation sur un VRAI PostgreSQL (serveur temporaire).

Critère du prompt (synchronisation) : chaque fiche porte un identifiant unique ; le serveur n'insère jamais
deux fois la même fiche ; une fiche envoyée ne peut être ni perdue ni comptée deux fois ; bilan consultable ;
toute erreur est journalisée.
"""

from __future__ import annotations

import random
import threading
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from postgres_temporaire import dossier_binaires, serveur
from sqlalchemy import Engine, func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from test_codification_oracle import ENQUETEURS_TEST, _items_aleatoires

from plateforme.codification.fiche import ParametresCodification
from plateforme.codification.reponses import ItemReponse, ReponseBrute
from plateforme.dictionnaire.modele import Dictionnaire
from plateforme.stockage import synchro
from plateforme.stockage.connexion import fabrique_sessions, migrer, moteur
from plateforme.stockage.modeles import Base, JournalSync, NumeroFiche, ReponseBruteBD
from plateforme.terrain.plan import PlanTerrain

pytestmark = pytest.mark.skipif(dossier_binaires() is None, reason="binaires PostgreSQL absents (voir tests/postgres_temporaire.py)")


@pytest.fixture(scope="module")
def bd(tmp_path_factory: pytest.TempPathFactory) -> Iterator[Engine]:
    with serveur(tmp_path_factory.mktemp("pg")) as url:
        migrer(url)
        m = moteur(url)
        yield m
        m.dispose()


@pytest.fixture
def session(bd: Engine) -> Iterator[Session]:
    with fabrique_sessions(bd)() as s:
        yield s


@pytest.fixture
def params(terrain_edm: PlanTerrain) -> ParametresCodification:
    return ParametresCodification(villes=terrain_edm.villes_masque(), enqueteurs=ENQUETEURS_TEST)


def _reponses(dico: Dictionnaire, n: int, graine: int) -> list[ReponseBrute]:
    rnd, t, out = random.Random(graine), datetime(2026, 10, 5, 8, tzinfo=UTC), []
    for i in range(n):
        t += timedelta(minutes=rnd.choice([4, 9, 15]))
        items = tuple(ItemReponse(x["titre"], x["rep"], tuple(x["lignes"]) if x["lignes"] else None)
                      for x in _items_aleatoires(dico, rnd, ["", "694388296", "677000001"]))
        out.append(ReponseBrute(f"appareil-{graine}-{i:03d}", t, items, "test"))
    return out


def _compter(s: Session, p: object) -> int:
    return s.scalar(select(func.count()).select_from(ReponseBruteBD).where(ReponseBruteBD.projet_id == p.id)) or 0  # type: ignore[attr-defined]


def test_migration_conforme_au_modele(bd: Engine) -> None:
    """Le schéma créé par la migration correspond exactement aux modèles (aucun écart détecté par Alembic)."""
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    with bd.connect() as c:
        ecarts = compare_metadata(MigrationContext.configure(c), Base.metadata)
    assert [e for e in ecarts if not (isinstance(e, tuple) and e[0] in ("add_constraint", "remove_constraint"))] == []


def test_reponse_brute_et_numero_immuables(session: Session, dico_edm: Dictionnaire, params: ParametresCodification) -> None:
    p = synchro.projet(session, "THE PLUG", "IMMUABLE")
    synchro.recevoir(session, p, _reponses(dico_edm, 2, 1))
    synchro.coder(session, p, dico_edm, params)
    session.commit()
    for requete in ("UPDATE reponse_brute SET source = 'x'", "DELETE FROM reponse_brute",
                    "UPDATE numero_fiche SET sequence = sequence + 1", "DELETE FROM numero_fiche"):
        with pytest.raises(DBAPIError, match=r"immuable|ni modifié ni supprimé"):
            session.execute(text(requete))
        session.rollback()


def test_50_fiches_coupure_en_plein_envoi_puis_relance(bd: Engine, dico_edm: Dictionnaire) -> None:
    """Critère de la phase 8 rejoué côté serveur : 50 fiches, coupure en plein envoi, relance → 50 fiches, aucun doublon."""
    reps = _reponses(dico_edm, 50, 2)
    fabrique = fabrique_sessions(bd)
    with fabrique() as s:
        p = synchro.projet(s, "THE PLUG", "COUPURE")
        s.commit()
    with fabrique() as s:                        # 1er envoi : 20 fiches validées, puis 15 perdues (coupure avant validation)
        synchro.recevoir(s, p, reps[:20])
        s.commit()
        synchro.recevoir(s, p, reps[20:35])
        s.rollback()
    with fabrique() as s:                        # relance de TOUT le lot, deux fois
        r1 = synchro.recevoir(s, p, reps)
        r2 = synchro.recevoir(s, p, reps)
        s.commit()
        assert (r1.nouvelles, r1.deja_recues, r2.nouvelles, r2.deja_recues) == (30, 20, 0, 50)
        assert _compter(s, p) == 50


def test_envois_simultanes(bd: Engine, dico_edm: Dictionnaire) -> None:
    """Deux appareils renvoient en même temps les mêmes fiches : la contrainte d'unicité garde 40 fiches, pas 80."""
    reps = _reponses(dico_edm, 40, 3)
    fabrique = fabrique_sessions(bd)
    with fabrique() as s:
        p = synchro.projet(s, "THE PLUG", "SIMULTANE")
        s.commit()
    erreurs: list[BaseException] = []

    def envoyer() -> None:
        try:
            with fabrique() as s:
                synchro.recevoir(s, p, reps)
                s.commit()
        except BaseException as e:
            erreurs.append(e)

    fils = [threading.Thread(target=envoyer) for _ in range(4)]
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    assert erreurs == []
    with fabrique() as s:
        assert _compter(s, p) == 40


def test_renvoi_modifie_refuse_et_journalise(session: Session, dico_edm: Dictionnaire) -> None:
    p = synchro.projet(session, "THE PLUG", "CONFLIT")
    r = _reponses(dico_edm, 1, 4)[0]
    synchro.recevoir(session, p, [r])
    falsifiee = ReponseBrute(r.id, r.horodatage, (*r.items, ItemReponse("Q42. Une suggestion / attente (facultatif)", "ajout")))
    res = synchro.recevoir(session, p, [falsifiee])
    session.commit()
    assert (res.nouvelles, res.conflits) == (0, [r.id])
    assert session.scalar(select(ReponseBruteBD.empreinte).where(ReponseBruteBD.id_externe == r.id)) == synchro.empreinte(r)
    erreurs = session.scalars(select(JournalSync.message).where(JournalSync.projet_id == p.id, JournalSync.niveau == "ERREUR")).all()
    assert any(r.id in m for m in erreurs)


def test_codage_numeros_decisions_et_bilan(session: Session, dico_edm: Dictionnaire, params: ParametresCodification) -> None:
    p = synchro.projet(session, "THE PLUG", "CODAGE")
    reps = _reponses(dico_edm, 30, 5)
    synchro.recevoir(session, p, reps[1:])
    premier = {f.id_reponse: f.numfiche for f in synchro.coder(session, p, dico_edm, params).fiches}
    session.commit()
    # Recoder ne change aucun N° ; une réponse plus ancienne arrivée en retard prend le N° suivant de son enquêteur
    synchro.recevoir(session, p, reps[:1])
    second = synchro.coder(session, p, dico_edm, params)
    session.commit()
    assert {i: n for i, n in ((f.id_reponse, f.numfiche) for f in second.fiches) if i in premier} == premier
    assert second.nouveaux_numeros == 1
    # Décisions : REJETE survit au recodage ; EXCLUE retire la fiche sans libérer son N°
    vise, exclu = reps[3].id, reps[4].id
    synchro.decider(session, p, vise, "REJETE", motif="rappel non concluant", auteur="superviseur")
    synchro.decider(session, p, exclu, "EXCLUE", motif="essai du formulaire", auteur="superviseur")
    troisieme = {f.id_reponse: f for f in synchro.coder(session, p, dico_edm, params).fiches}
    session.commit()
    assert troisieme[vise].statut == "REJETE" and exclu not in troisieme
    nb_numeros = session.scalar(select(func.count()).select_from(NumeroFiche).where(NumeroFiche.projet_id == p.id))
    assert nb_numeros == 30, "un N° attribué n'est jamais libéré"
    b = synchro.bilan(session, p, ids_source={r.id for r in reps} | {"jamais-recue"})
    assert (b.reponses, b.fiches, b.exclues, b.reponses_sans_fiche) == (30, 29, 1, 0)
    assert b.absentes_de_la_base == ["jamais-recue"] and not b.sain
    assert synchro.bilan(session, p, ids_source={r.id for r in reps}).sain


MASQUE = Path(__file__).resolve().parents[2] / "reference" / "prive" / "donnees" / "EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL__7_.xlsx"


@pytest.mark.skipif(not MASQUE.exists(), reason="données réelles absentes (reference/prive/, hors Git)")
def test_donnees_reelles_en_base(session: Session, dico_edm: Dictionnaire, terrain_edm: PlanTerrain) -> None:
    """Les 451 réponses réelles passent par la base : 446 fiches valides identiques à V11, 427 retenues."""
    from donnees_reelles import charger

    from plateforme.codification.qualite import ParametresBase, base_analyse
    from plateforme.imports.reponses_tableur import lire_onglet, lire_reponses
    reel = charger(dico_edm, terrain_edm)
    reps = lire_reponses(lire_onglet(MASQUE, "Form Responses 1"), dico_edm)
    params = ParametresCodification(villes=terrain_edm.villes_masque(), enqueteurs={e.id: e.ville or "" for e in terrain_edm.enqueteurs})
    p = synchro.projet(session, "THE PLUG", "EDM_REEL")
    assert synchro.recevoir(session, p, reps).nouvelles == 451
    ids_fiches = {f.id_reponse for f in reel.fiches}
    for r in reps:
        if r.id not in ids_fiches:
            synchro.decider(session, p, r.id, "EXCLUE", motif="réponse de test du 03/10")
    for i in reel.rejetees:
        synchro.decider(session, p, i, "REJETE", motif="fiche vide (FICHES_SUPPRIMEES)")
    fiches = synchro.coder(session, p, dico_edm, params).fiches
    session.commit()
    valides = sorted(f.numfiche for f in fiches if f.statut != "REJETE")
    assert valides == sorted(r["NUMFICHE"] for r in reel.masque)
    _, note = base_analyse(dico_edm, fiches, ParametresBase(), synchro.decisions_courantes(session, p))
    assert (note.valides, note.retenues) == (446, 427)
    assert synchro.bilan(session, p, ids_source={r.id for r in reps}).sain
