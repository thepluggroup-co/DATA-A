"""Ligne de commande : `plateforme dictionnaire | base | analyse | suivi | deploiement …`."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

from plateforme.dictionnaire import diagnostic, diff, fichiers
from plateforme.generateurs import excel, formulaire, masque, spss, tri_a_plat
from plateforme.terrain import plan as plan_terrain


def _valider(args: argparse.Namespace) -> int:
    dico = fichiers.charger(args.dictionnaire)
    nb = sum(len(q.variables()) for q in dico.questions)
    print(f"✔ {dico.etude} version {dico.version} : {len(dico.questions)} questions, {nb} variables de questionnaire, "
          f"{len(dico.regles_coherence)} règle(s) de cohérence")
    return 0


def _generer(args: argparse.Namespace) -> int:
    dico = fichiers.charger(args.dictionnaire)
    terrain = plan_terrain.charger(args.plan_terrain)
    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    cols = masque.colonnes_masque(dico, terrain.villes_masque())
    (sortie / "colonnes_masque.json").write_text(json.dumps([asdict(c) for c in cols], ensure_ascii=False, indent=1), "utf-8")
    (sortie / "etiquetage.sps").write_text(spss.syntaxe_etiquetage(dico, cols), encoding="utf-8")
    excel.livre_de_codes(cols, sortie / "livre_de_codes.xlsx")
    excel.parametrage(dico, cols, sortie / "parametrage.xlsx")
    excel.tri_a_plat(tri_a_plat.gabarit(dico, cols), [v.libelle for v in terrain.villes], sortie / "tri_a_plat_gabarit.xlsx")
    plan = formulaire.plan_formulaire(dico, [e.id for e in terrain.enqueteurs])
    req = formulaire.requetes_google_forms(plan)
    (sortie / "google_forms_requetes.json").write_text(json.dumps({"requests": req.requetes}, ensure_ascii=False, indent=1), "utf-8")
    (sortie / "google_forms_actions_apps_script.txt").write_text("\n".join(req.actions_apps_script) + "\n", "utf-8")
    diag = diagnostic.diagnostiquer(dico, plan)
    (sortie / "diagnostic_formulaire.md").write_text(_rapport_diagnostic(diag), encoding="utf-8")
    print(f"{len(cols)} colonnes de masque, {len(req.requetes)} requêtes Google Forms → {sortie}")
    print(f"Diagnostic du formulaire généré : {diag.verdict()}")
    return 0 if not diag.blocages else 1


def _rapport_diagnostic(diag: diagnostic.Diagnostic) -> str:
    lignes = ["# Diagnostic formulaire ↔ dictionnaire", "", diag.verdict(), "", "| Élément | État | Détail |", "|---|---|---|"]
    lignes += [f"| {li.element.replace('|', '/')} | {li.statut} | {li.detail.replace('|', '/')} |" for li in diag.lignes]
    return "\n".join(lignes) + "\n"


def _diff(args: argparse.Namespace) -> int:
    a, b = fichiers.charger(args.ancien), fichiers.charger(args.nouveau)
    texte = diff.rapport_texte(a, b, diff.comparer(a, b))
    if args.sortie:
        Path(args.sortie).write_text(texte, encoding="utf-8")
    print(texte)
    return 0


def _importer_apps_script(args: argparse.Namespace) -> int:
    from plateforme.imports import apps_script
    oracle = apps_script.executer_oracle(args.script)
    dico = apps_script.vers_dictionnaire(oracle, args.etude, args.version, source=Path(args.script).name)
    fichiers.enregistrer(dico, args.sortie, entete=f"Importé de {Path(args.script).name} — à relire avant validation.")
    print(f"✔ {len(dico.questions)} questions → {args.sortie}")
    return 0


def _importer_livre(args: argparse.Namespace) -> int:
    from plateforme.imports import livre_de_codes
    ref = fichiers.charger(args.reference)
    res = livre_de_codes.depuis_livre_de_codes(livre_de_codes.lire_csv(args.csv), ref.etude, args.version,
                                               source=Path(args.csv).name, reference=ref)
    fichiers.enregistrer(res.dictionnaire, args.sortie, entete=f"Importé de {Path(args.csv).name}.")
    for a in res.avertissements:
        print("⚠", a)
    print(f"✔ {len(res.dictionnaire.questions)} questions → {args.sortie}")
    return 0


def _importer_pdf(args: argparse.Namespace) -> int:
    from plateforme.imports import pdf
    ref = fichiers.charger(args.reference)
    res = pdf.depuis_pdf(args.pdf, version=args.version, reference=ref)
    fichiers.enregistrer(res.dictionnaire, args.sortie,
                         entete=f"BROUILLON importé de {Path(args.pdf).name} : revue humaine obligatoire avant validation.")
    for a in res.avertissements:
        print("⚠", a)
    print(f"✔ brouillon de {len(res.dictionnaire.questions)} questions → {args.sortie}")
    return 0


class DecisionsInconnues(ValueError):
    """Le fichier de décisions cite des fiches absentes du tableur."""


def _charger_base(args: argparse.Namespace) -> tuple[Any, Any, list[Any], list[Any], dict[str, Any]]:
    """Tableur de réponses + décisions -> (dictionnaire, plan de terrain, réponses, fiches codées, décisions)."""
    import yaml

    from plateforme.codification.fiche import ParametresCodification
    from plateforme.codification.rejeu import DecisionQC, recoder
    from plateforme.imports.reponses_tableur import lire_onglet, lire_reponses

    dico = fichiers.charger(args.dictionnaire)
    terrain = plan_terrain.charger(args.plan_terrain)
    params = ParametresCodification(villes=terrain.villes_masque(), enqueteurs={e.id: e.ville or "" for e in terrain.enqueteurs},
                                    seuil_delai_min=terrain.seuil_delai_min, fuseau=terrain.fuseau)
    reponses = lire_reponses(lire_onglet(args.tableur, args.onglet), dico, fuseau=terrain.fuseau, source=Path(args.tableur).name)
    fiches = recoder(dico, reponses, params)
    decisions: dict[str, DecisionQC] = {}
    if args.decisions:
        # Clé : identifiant de réponse, ou N° de fiche. Les EXCLUE (tests) sont appliquées d'abord : elles changent
        # la numérotation ; les N° des autres décisions sont donc lus APRÈS exclusion.
        brutes = yaml.safe_load(Path(args.decisions).read_text(encoding="utf-8")) or {}
        ids = {r.id for r in reponses}

        def decision(d: dict[str, str]) -> DecisionQC:
            return DecisionQC(d["statut"], anomalies_vues=d.get("anomalies_vues", ""), motif=d.get("motif", ""))

        decisions = {k: decision(d) for k, d in brutes.items() if k in ids}
        fiches = recoder(dico, reponses, params, decisions=decisions)
        par_num = {f.numfiche: f.id_reponse for f in fiches}
        inconnus = sorted(k for k in brutes if k not in ids and k not in par_num)
        if inconnus:
            raise DecisionsInconnues("fiches inconnues dans les décisions : " + ", ".join(inconnus))
        decisions |= {par_num[k]: decision(d) for k, d in brutes.items() if k in par_num}
        fiches = recoder(dico, reponses, params, decisions=decisions)
    return dico, terrain, reponses, fiches, decisions


def _coder_base(args: argparse.Namespace) -> int:
    from plateforme.codification.qualite import ParametresBase, base_analyse
    from plateforme.exports.sav import exporter_sav
    from plateforme.exports.tableaux import exporter_contacts, exporter_csv, exporter_masque

    try:
        dico, terrain, reponses, fiches, decisions = _charger_base(args)
    except DecisionsInconnues as e:
        print("✘", e)
        return 1
    retenues, note = base_analyse(dico, fiches, ParametresBase(), decisions)
    sortie = Path(args.sortie)
    cols = masque.colonnes_masque(dico, terrain.villes_masque())
    exporter_masque(cols, fiches, sortie / "MASQUE_DEPOUILLEMENT.xlsx")
    res = exporter_sav(dico, cols, retenues, sortie / "BASE_ANALYSE.sav", libelle_fichier=dico.etude, note=note.texte())
    exporter_csv(cols, retenues, sortie / "BASE_ANALYSE.csv")
    exporter_contacts(fiches, sortie / "CONTACTS.xlsx")
    (sortie / "NOTE_DE_BASE.txt").write_text(note.texte() + "\n", encoding="utf-8")
    print(f"{len(reponses)} réponses lues, {len(fiches)} fiches codées. {note.texte()}")
    print(f"✔ .sav relu et vérifié : {res.chemin.name} ({res.lignes} lignes, {res.variables} variables) → {sortie}")
    print("⚠ CONTACTS.xlsx contient des données personnelles : ne pas le joindre à la base d'analyse ni le versionner.")
    return 0


def _jeux_analyse(args: argparse.Namespace) -> tuple[Any, Any, Any, Any, dict[str, str]]:
    """(plan d'analyse, note de base, jeu de collecte, jeu d'analyse, formats SPSS du masque) depuis le tableur."""
    from plateforme.analyse import plan as plan_analyse
    from plateforme.analyse.controle import variables_controle
    from plateforme.codification.qualite import ParametresBase, base_analyse
    from plateforme.codification.rejeu import HORS_COMPTAGE

    dico, terrain, _, fiches, decisions = _charger_base(args)
    pa = plan_analyse.charger(args.plan_analyse)
    retenues, note = base_analyse(dico, fiches, ParametresBase(), decisions)
    controles = variables_controle(dico, fiches, terrain.jours, decisions=decisions)
    cols = masque.colonnes_masque(dico, terrain.villes_masque())
    valides = [f for f in fiches if f.statut not in HORS_COMPTAGE]
    collecte = plan_analyse.jeu_depuis_fiches(cols, valides, pa, controles=controles)
    analyse = plan_analyse.jeu_depuis_fiches(cols, retenues, pa, controles=controles)
    return pa, note, collecte, analyse, {c.code: c.spss for c in cols if not c.spss.startswith("A")}


def _analyse_base(args: argparse.Namespace) -> int:
    """Bases SPSS d'analyse depuis le tableur : collecte (fiches valides, FILTRE_QUAL) et analyse (fiches retenues),
    avec variables de contrôle de la plateforme et variables dérivées du plan d'analyse."""
    from plateforme.analyse.exports import exporter_sav_jeu

    try:
        pa, note, collecte, analyse, formats = _jeux_analyse(args)
    except DecisionsInconnues as e:
        print("✘", e)
        return 1
    sortie = Path(args.sortie)
    for nom, jd, texte in (("BASE_COLLECTE.sav", collecte, f"Base de collecte : {len(collecte.table)} fiches valides. {note.texte()}"),
                           ("BASE_ANALYSE_DERIVEES.sav", analyse, note.texte())):
        chemin = exporter_sav_jeu(jd, sortie / nom, formats=formats, libelle_fichier=nom.removesuffix(".sav"), note=texte)
        print(f"✔ .sav relu et vérifié : {chemin.name} ({len(jd.table)} lignes, {len(jd.table.columns)} variables)")
    print(f"{len(pa.derivations)} variables dérivées du plan d'analyse. {note.texte()}")
    return 0


def _analyse_resultats(args: argparse.Namespace) -> int:
    """Tableaux du plan d'analyse sur la base d'analyse : classeur Excel + syntaxe SPSS équivalente (sans chemin)."""
    from plateforme.analyse.exports import exporter_excel, exporter_syntaxe
    from plateforme.analyse.tableaux import TableauInvalide, produire

    try:
        pa, note, _, analyse, _ = _jeux_analyse(args)
        resultats = produire(pa.tableaux, analyse)
    except (DecisionsInconnues, TableauInvalide) as e:
        print("✘", e)
        return 1
    if not resultats:
        print("✘ le plan d'analyse ne déclare aucun tableau (section « tableaux »)")
        return 1
    sortie = Path(args.sortie)
    xlsx = exporter_excel(resultats, analyse, sortie / "RESULTATS.xlsx")
    sps = exporter_syntaxe(resultats, sortie / "RESULTATS.sps", base_attendue=len(analyse.table), nom_base="BASE_ANALYSE_DERIVEES.sav")
    print(f"✔ {len(resultats)} tableaux : {xlsx.name}, {sps.name} → {sortie}")
    print(note.texte())
    return 0


def _suivi(args: argparse.Namespace) -> int:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from plateforme.suivi.livrables import charger_quotas, produire

    try:
        dico, terrain, _, fiches, decisions = _charger_base(args)
    except DecisionsInconnues as e:
        print("✘", e)
        return 1
    tz = ZoneInfo(terrain.fuseau)
    maintenant = datetime.fromisoformat(args.maintenant).replace(tzinfo=tz) if args.maintenant else datetime.now(tz)
    jour = args.jour or maintenant.strftime("%Y-%m-%d")
    ecrits = produire(dico, fiches, terrain, charger_quotas(args.plan_echantillonnage, terrain), decisions, jour, maintenant,
                      Path(args.sortie), args.graine)
    for nom, chemin in ecrits.items():
        print(f"✔ {nom} : {chemin}")
    print("⚠ RAPPELS_*.xlsx contient des téléphones : données personnelles, à ne pas diffuser ni versionner.")
    return 0


def _liens(args: argparse.Namespace) -> int:
    from openpyxl import Workbook

    from plateforme.deploiement.liens import analyser_modele, lien, qr_code

    terrain = plan_terrain.charger(args.plan_terrain)
    villes = {v.id: v.libelle for v in terrain.villes}
    modele = analyser_modele(args.modele, args.enqueteur, args.ville)
    sortie = Path(args.sortie)
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "LIENS"
    ws.append(["ENQ_ID", "VILLE", "RÔLE", "LIEN_PERSONNEL", "QR CODE"])
    for e in terrain.enqueteurs:
        url = lien(modele, e.id, villes.get(e.ville or ""))
        png = qr_code(url, sortie / "qr" / f"{e.id}.png")
        ws.append([e.id, e.ville or "(à saisir)", e.role.value, url, str(png.relative_to(sortie))])
    sortie.mkdir(parents=True, exist_ok=True)
    wb.save(sortie / "LIENS_PERSONNELS.xlsx")
    print(f"✔ {len(terrain.enqueteurs)} liens et QR codes → {sortie}")
    return 0


def main(argv: list[str] | None = None) -> int:
    for flux in (sys.stdout, sys.stderr):          # console Windows en cp1252 : ✔ ⚠ ✘ → et accents
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")
    p = argparse.ArgumentParser(prog="plateforme")
    sous = p.add_subparsers(dest="domaine", required=True)
    d = sous.add_parser("dictionnaire").add_subparsers(dest="action", required=True)
    v = d.add_parser("valider", help="valide un dictionnaire YAML")
    v.add_argument("dictionnaire")
    v.set_defaults(f=_valider)
    g = d.add_parser("generer", help="génère masque, SPSS, Excel, formulaire et diagnostic")
    g.add_argument("dictionnaire")
    g.add_argument("--plan-terrain", required=True)
    g.add_argument("--sortie", required=True)
    g.set_defaults(f=_generer)
    df = d.add_parser("diff", help="rapport de différences entre deux versions")
    df.add_argument("ancien")
    df.add_argument("nouveau")
    df.add_argument("--sortie")
    df.set_defaults(f=_diff)
    ia = d.add_parser("importer-apps-script", help="importe le dictionnaire d'un script EDM (.gs) via Node")
    ia.add_argument("script")
    ia.add_argument("--etude", required=True)
    ia.add_argument("--version", required=True)
    ia.add_argument("--sortie", required=True)
    ia.set_defaults(f=_importer_apps_script)
    il = d.add_parser("importer-livre-de-codes", help="importe un onglet DICTIONNAIRE exporté en CSV (;)")
    il.add_argument("csv")
    il.add_argument("--reference", required=True)
    il.add_argument("--version", required=True)
    il.add_argument("--sortie", required=True)
    il.set_defaults(f=_importer_livre)
    ip = d.add_parser("importer-pdf", help="extrait un brouillon de dictionnaire d'un questionnaire PDF")
    ip.add_argument("pdf")
    ip.add_argument("--reference", required=True)
    ip.add_argument("--version", required=True)
    ip.add_argument("--sortie", required=True)
    ip.set_defaults(f=_importer_pdf)
    b = sous.add_parser("base").add_subparsers(dest="action", required=True)
    bc = b.add_parser("coder", help="code un tableur de réponses Google et produit masque, .sav, CSV, CONTACTS et note de base")
    bc.add_argument("tableur", help="export .xlsx du classeur de réponses")
    bc.add_argument("--onglet", default="Form Responses 1")
    bc.add_argument("--dictionnaire", required=True)
    bc.add_argument("--plan-terrain", required=True)
    bc.add_argument("--decisions", help="YAML {N° de fiche: {statut: OK|REJETE|ANNULEE|EXCLUE, motif: …}}")
    bc.add_argument("--sortie", required=True)
    bc.set_defaults(f=_coder_base)
    an = sous.add_parser("analyse").add_subparsers(dest="action", required=True)
    ab = an.add_parser("base", help="bases SPSS de collecte et d'analyse, variables dérivées du plan d'analyse comprises")
    ab.add_argument("tableur")
    ab.add_argument("--onglet", default="Form Responses 1")
    ab.add_argument("--dictionnaire", required=True)
    ab.add_argument("--plan-terrain", required=True)
    ab.add_argument("--plan-analyse", required=True)
    ab.add_argument("--decisions")
    ab.add_argument("--sortie", required=True)
    ab.set_defaults(f=_analyse_base)
    ar = an.add_parser("resultats", help="tableaux du plan d'analyse : classeur Excel et syntaxe SPSS équivalente")
    for nom, options in (("tableur", {}), ("--onglet", {"default": "Form Responses 1"}), ("--dictionnaire", {"required": True}),
                         ("--plan-terrain", {"required": True}), ("--plan-analyse", {"required": True}), ("--decisions", {}),
                         ("--sortie", {"required": True})):
        ar.add_argument(nom, **options)
    ar.set_defaults(f=_analyse_resultats)
    su = sous.add_parser("suivi").add_subparsers(dest="action", required=True)
    sp = su.add_parser("produire", help="tableau de bord, rapport journalier, état des enquêteurs, effet enquêteur, rappels")
    sp.add_argument("tableur")
    sp.add_argument("--onglet", default="Form Responses 1")
    sp.add_argument("--dictionnaire", required=True)
    sp.add_argument("--plan-terrain", required=True)
    sp.add_argument("--plan-echantillonnage", required=True)
    sp.add_argument("--decisions")
    sp.add_argument("--jour", help="jour du rapport (aaaa-mm-jj), par défaut aujourd'hui")
    sp.add_argument("--maintenant", help="heure de référence (aaaa-mm-jjThh:mm) ; avant 18 h le rapport du jour est PROVISOIRE")
    sp.add_argument("--graine", type=int, default=0, help="graine du tirage des rappels (publiée avec la liste)")
    sp.add_argument("--sortie", required=True)
    sp.set_defaults(f=_suivi)
    dp = sous.add_parser("deploiement").add_subparsers(dest="action", required=True)
    dl = dp.add_parser("liens", help="liens personnels pré-remplis et QR codes depuis UN lien modèle de Google Forms")
    dl.add_argument("--modele", required=True, help="lien pré-rempli copié dans Google Forms (« Obtenir le lien prérempli »)")
    dl.add_argument("--enqueteur", required=True, help="identifiant choisi dans le modèle (ex. ENQ1)")
    dl.add_argument("--ville", required=True, action="append", help="ville choisie dans le modèle (répéter pour chaque langue)")
    dl.add_argument("--plan-terrain", required=True)
    dl.add_argument("--sortie", required=True)
    dl.set_defaults(f=_liens)
    args = p.parse_args(argv)
    code: int = args.f(args)
    return code


if __name__ == "__main__":
    sys.exit(main())
