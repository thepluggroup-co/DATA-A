"""Jeu de démonstration ENTIÈREMENT FICTIF : une usine (TOTP), deux clients isolés (A et B), leurs projets bâtis sur le
projet fictif « 3 villes » (phase 6), des bases d'analyse SYNTHÉTIQUES (réponses tirées au hasard, graine fixe, aucune
personne réelle), des formules d'abonnement aux montants fictifs et une facture.

Identifiants : adresses en « .invalid » (domaine réservé, RFC 2606) ; mots de passe et secret TOTP de démonstration,
publiés ici, donc à ne JAMAIS utiliser hors démonstration.
"""

from __future__ import annotations

import random
import shutil
import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

import yaml
from sqlalchemy.orm import Session

from plateforme.api import audit, securite
from plateforme.projet import projet as pj
from plateforme.stockage.modeles import Abonnement, Facture, Formule, Livrable, Organisation, Projet, Utilisateur

RACINE = Path(__file__).resolve().parents[4]
DEMO = RACINE / "projets" / "demo_3_villes"
MDP_DEMO = "Demo-DATAA-2026"                      # démonstration uniquement
TOTP_DEMO = "JBSWY3DPEHPK3PXP"                    # secret TOTP de démonstration (exemple RFC, public)
CODE_MISSION_DEMO = "DEMO-ENQ1-A2026-FICTIF"   # mission de dÃ©monstration (poste ENQ1 du client A), publique
COMPTES = {"usine": "usine@demo.invalid", "client_a": "admin@client-a.demo.invalid", "lecteur_a": "lecteur@client-a.demo.invalid",
           "client_b": "admin@client-b.demo.invalid"}

FORMULES = [
    {"code": "acces_credits", "nom": "Accès + crédits d'études", "type": "acces_credits",
     "prix": {"abonnement_mensuel": 150000, "credit_par_fiche": 2500, "fictif": True},
     "droits": {"projets": 10, "villes": 10, "utilisateurs": 5, "croisements_par_mois": 50, "formats": ["docx", "pdf", "pptx", "xlsx", "sav"]}},
    {"code": "forfait", "nom": "À l'étude (forfait)", "type": "forfait",
     "prix": {"devis": "calculé depuis les plans (marge des tarifs)", "fictif": True},
     "droits": {"projets": 1, "villes": 5, "utilisateurs": 2, "croisements_par_mois": 3, "formats": ["docx", "pdf", "xlsx"]}},
    {"code": "barometre", "nom": "Baromètre (vagues récurrentes)", "type": "barometre",
     "prix": {"par_vague": 1200000, "fictif": True},
     "droits": {"projets": 4, "villes": 10, "utilisateurs": 5, "croisements_par_mois": 100, "formats": ["docx", "pdf", "pptx", "xlsx", "sav"]}},
]


@dataclass(frozen=True)
class Demo:
    organisations: dict[str, uuid.UUID]
    projets: dict[str, uuid.UUID]


def base_synthetique(dossier_projet: Path, chemin_sav: Path, graine: int, taux: float = 0.9) -> int:
    """Base d'analyse synthétique : pour chaque quota cible × ville, `taux` × quota fiches, réponses tirées au hasard
    dans les modalités du dictionnaire (graine fixe). Aucune donnée réelle ; étiquettes reprises du dictionnaire."""
    import pandas as pd
    import pyreadstat

    p = pj.charger(dossier_projet)
    pe, t, d = p.exiger_echantillonnage(), p.exiger_terrain(), p.dictionnaire
    hasard = random.Random(graine)
    qv = next(q for q in d.questions if q.prerempli == "ville")
    autres = [q for q in d.questions if q.type.value == "choix_unique" and q.code not in (pe.variable_cible, qv.code)]
    lignes: list[dict[str, object]] = []
    for q in pe.quotas:
        for v in t.villes:
            for _ in range(round(q.villes[v.id] * taux)):
                ligne: dict[str, object] = {"NUMFICHE": f"{v.prefixe}-DEMO-{len(lignes) + 1:04d}", pe.variable_cible: q.code, qv.code: v.code}
                for x in autres:
                    codes = [m.code for m in x.modalites]
                    poids = [1 + (k * (q.code + v.code)) % 3 for k in range(len(codes))]   # profils différents par cible et ville
                    ligne[x.code] = hasard.choices(codes, weights=poids)[0]
                lignes.append(ligne)
    df = pd.DataFrame(lignes)
    etiquettes: dict[str, str | None] = {"NUMFICHE": "N° de fiche", qv.code: d.texte(qv.libelles)}
    valeurs = {}
    for x in [*autres, qv, *(q for q in d.questions if q.code == pe.variable_cible)]:
        etiquettes[x.code] = d.texte(x.libelles)
        valeurs[x.code] = {float(m.code): d.texte(m.libelles) for m in x.modalites}
    chemin_sav.parent.mkdir(parents=True, exist_ok=True)
    pyreadstat.write_sav(df, str(chemin_sav), file_label="BASE SYNTHETIQUE DE DEMONSTRATION (fictive)",
                         column_labels=etiquettes, variable_value_labels=valeurs)
    return len(df)


def _copier_projet(stockage: Path, org: uuid.UUID, code: str) -> str:
    rel = Path(str(org)) / code
    cible = stockage / rel
    if cible.exists():
        shutil.rmtree(cible)
    shutil.copytree(DEMO, cible, ignore=shutil.ignore_patterns("documents"))
    m = yaml.safe_load((cible / "projet.yaml").read_text(encoding="utf-8"))
    m["referentiel"] = str(RACINE / "reference" / "geo" / "CMR")
    m["gabarit_chronogramme"] = str(RACINE / "reference" / "gabarits" / "chronogramme_etude.yaml")
    (cible / "projet.yaml").write_text(yaml.safe_dump(m, allow_unicode=True, sort_keys=False), encoding="utf-8")
    cab = yaml.safe_load((cible / "cabinet.yaml").read_text(encoding="utf-8"))
    cab["logo"] = str(RACINE / "reference" / "charte" / "data_a" / "logo_data_a.png")
    (cible / "cabinet.yaml").write_text(yaml.safe_dump(cab, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return str(rel)


def semer(s: Session, stockage: Path) -> Demo:
    """À exécuter avec le rôle propriétaire (hors RLS), sur une base migrée et vide."""
    hache = securite.hacher(MDP_DEMO)
    usine = Organisation(nom="THE PLUG — usine (démonstration)", type="usine")
    a, b = Organisation(nom="Client A (fictif)", type="client"), Organisation(nom="Client B (fictif)", type="client")
    s.add_all([usine, a, b])
    s.flush()
    s.add_all([Utilisateur(organisation_id=usine.id, email=COMPTES["usine"], nom="Opérateur usine (démo)", role="usine_admin",
                           hash_mdp=hache, totp_secret=TOTP_DEMO),
               Utilisateur(organisation_id=a.id, email=COMPTES["client_a"], nom="Administrateur A (démo)", role="client_admin", hash_mdp=hache),
               Utilisateur(organisation_id=a.id, email=COMPTES["lecteur_a"], nom="Lecteur A (démo)", role="client_lecteur", hash_mdp=hache),
               Utilisateur(organisation_id=b.id, email=COMPTES["client_b"], nom="Administrateur B (démo)", role="client_admin", hash_mdp=hache)])
    formules = {f["code"]: Formule(**f) for f in FORMULES}
    s.add_all(formules.values())
    s.flush()
    s.add_all([Abonnement(organisation_id=a.id, formule_id=formules["acces_credits"].id, debut=date.today()),
               Abonnement(organisation_id=b.id, formule_id=formules["forfait"].id, debut=date.today())])
    projets = {}
    for org, code, graine, base_min in ((a, "DEMO_A", 2026, 30), (b, "DEMO_B", 2027, 30)):
        rel = _copier_projet(stockage, org.id, code)
        sav = Path(rel) / "base" / "BASE_ANALYSE_DEMO.sav"
        base_synthetique(stockage / rel, stockage / sav, graine)
        p = Projet(organisation_id=org.id, code=code, nom=f"Achats de fournitures scolaires — {org.nom}", statut="livre",
                   dossier=rel, base_analyse=str(sav), parametres={"garde": {"base_min": base_min, "k": 5}})
        s.add(p)
        s.flush()
        s.add(Livrable(organisation_id=org.id, projet_id=p.id, nom="BASE_ANALYSE_DEMO.sav", fichier=str(sav), partage_client=True))
        projets[code] = p.id
    from plateforme.api.terrain import empreinte_code
    from plateforme.stockage.modeles import Mission

    s.add(Mission(organisation_id=a.id, projet_id=projets["DEMO_A"], enqueteur="ENQ1", code_empreinte=empreinte_code(CODE_MISSION_DEMO)))
    s.add(Facture(organisation_id=a.id, numero=f"F-{date.today().year}-0001", lignes=[["Abonnement Accès + crédits (fictif)", 150000]],
                  montant_ht=Decimal("150000")))
    audit.journaliser(s, "demo_initialisee", "jeu de démonstration fictif")
    return Demo({"usine": usine.id, "client_a": a.id, "client_b": b.id}, projets)
