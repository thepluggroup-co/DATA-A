"""Documents de gestion de l'étude : cahier des charges (M0), chronogramme (M5), organisation du terrain (M9), fiche
profil des paiements et devis (M13). Tout est lu dans les sources du projet ; rien n'est ressaisi."""

from __future__ import annotations

from datetime import timedelta
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from plateforme.analyse.rapport.rendus import charte_par_defaut
from plateforme.documents.commun import date_fr, enregistrer, montant, nouveau, tableau, titre
from plateforme.finances.paiements import devis, fiche
from plateforme.projet.brief import pre_estimation
from plateforme.projet.projet import Projet
from plateforme.terrain.chronogramme import Chronogramme

FONCTIONS_CHRONO = {"expert": "Expert", "appui_1": "Appui 1", "appui_2": "Appui 2", "superviseurs": "Superviseurs",
                    "enqueteurs": "Enquêteurs"}


def _logo(p: Projet) -> Path | None:
    return p.chemin(p.cabinet.logo) if p.cabinet.logo else None


def _entete_xlsx(ws: object, valeurs: list[str]) -> None:
    c = charte_par_defaut()
    ws.append(valeurs)  # type: ignore[attr-defined]
    for cellule in ws[ws.max_row]:  # type: ignore[attr-defined, index]
        cellule.font, cellule.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor=c.fond_entete)


# ------------------------------------------------------------------------------------------------ cahier des charges
def cahier_des_charges(p: Projet, dossier: Path, en_pdf: bool = False) -> list[Path]:
    b, pre = p.brief, pre_estimation(p.brief, p.tarifs)
    doc = nouveau(f"Cahier des charges {b.version}", fictif=b.fictif, sous_titre=b.titre, logo=_logo(p))
    titre(doc, "1. Client et besoin")
    tableau(doc, ["Rubrique", "Détail"], [["Client", b.client.raison_sociale], ["Secteur", b.client.secteur or "—"],
                                          ["Interlocuteur", b.client.interlocuteur or "—"], ["Besoin d'information", b.besoin]],
            largeurs_cm=[5, 11])
    titre(doc, "2. Objectifs")
    for o in b.objectifs:
        doc.add_paragraph(o, style="List Bullet")
    titre(doc, "3. Cibles, villes et échantillon")
    villes = [p.referentiel.localite(v).nom for v in b.villes]
    rep = b.repartition()
    tableau(doc, ["Cible", *villes, "Total"], [[c.libelle, *[rep[v][c.code] for v in b.villes], sum(rep[v][c.code] for v in b.villes)]
                                               for c in b.cibles] + [["Total", *[pre.par_ville[v] for v in b.villes], pre.effectif]])
    if p.echantillonnage is not None and p.echantillonnage.mention():
        doc.add_paragraph(p.echantillonnage.mention()).runs[0].italic = True
    titre(doc, "4. Méthode et calendrier")
    tableau(doc, ["Rubrique", "Détail"], [
        ["Type d'étude", b.type.value], ["Mode de collecte", b.mode_collecte.value.replace("_", " ")],
        ["Langues", ", ".join(b.langues)], ["Démarrage souhaité", date_fr(b.debut)], ["Échéance", date_fr(b.echeance)],
        ["Pré-estimation du terrain", f"{sum(pre.enqueteurs.values())} enquêteurs, {pre.jours_terrain} jours de collecte"]],
        largeurs_cm=[5, 11])
    titre(doc, "5. Livrables")
    for x in b.livrables:
        doc.add_paragraph(x, style="List Bullet")
    doc.add_paragraph("Formats : " + ", ".join(f.value for f in b.formats))
    if b.budget_indicatif:
        doc.add_paragraph(f"Budget indicatif du client : {montant(b.budget_indicatif, p.tarifs.devise)}")
    return enregistrer(doc, dossier / f"CAHIER_DES_CHARGES_{b.version}.docx", en_pdf)


# ------------------------------------------------------------------------------------------------ chronogramme
def gantt_png(c: Chronogramme) -> bytes:
    """Diagramme de Gantt : une barre par tâche (abscisse en jours depuis le début), couleur par phase, lundis repérés."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle

    ch = charte_par_defaut()
    couleurs = ["#" + x for x in ch.palette]
    phases = list(dict.fromkeys(t.tache.phase for t in c.taches))
    fig, ax = plt.subplots(figsize=(10, 0.45 * len(c.taches) + 1.2), dpi=150)
    for k, t in enumerate(c.taches):
        couleur = couleurs[phases.index(t.tache.phase) % len(couleurs)]
        x0 = (t.debut - c.debut).days
        ax.barh(k, (t.fin - t.debut).days + 1, left=x0, color=couleur, height=0.6)
        ax.text(x0 + (t.fin - t.debut).days + 1.3, k, f"{t.jours} j", va="center", fontsize=7)
    lundis = [k for k in range((c.fin - c.debut).days + 2) if (c.debut + timedelta(days=k)).weekday() == 0]
    ax.set_xticks(lundis, [(c.debut + timedelta(days=k)).strftime("%d/%m") for k in lundis], fontsize=7)
    ax.set_yticks(range(len(c.taches)), [t.tache.libelle for t in c.taches], fontsize=8)
    ax.invert_yaxis()
    ax.grid(axis="x", alpha=0.3)
    for cote in ("top", "right"):
        ax.spines[cote].set_visible(False)
    handles = [Rectangle((0, 0), 1, 1, color=couleurs[i % len(couleurs)]) for i in range(len(phases))]
    ax.legend(handles, phases, fontsize=7, frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.08), ncol=2)
    fig.tight_layout()
    tampon = BytesIO()
    fig.savefig(tampon, format="png", bbox_inches="tight")
    plt.close(fig)
    return tampon.getvalue()


def chronogramme(p: Projet, dossier: Path, en_pdf: bool = False) -> list[Path]:
    from docx.shared import Cm

    c = p.chronogramme()
    doc = nouveau("Chronogramme de l'étude", fictif=p.brief.fictif, sous_titre=p.brief.titre, logo=_logo(p))
    doc.add_paragraph(f"Du {date_fr(c.debut, True)} au {date_fr(c.fin, True)} — jours ouvrés (lundi à vendredi), "
                      f"échéance du client : {date_fr(p.brief.echeance)}. Gabarit : {c.gabarit} ({c.source}).")
    doc.add_picture(BytesIO(gantt_png(c)), width=Cm(16.5))
    lignes = [[str(k), t.tache.phase, t.tache.libelle, str(t.jours), date_fr(t.debut), date_fr(t.fin),
               ", ".join(f"{FONCTIONS_CHRONO.get(f, f)} {pct} %" for f, pct in t.tache.ressources.items())]
              for k, t in enumerate(c.taches, start=1)]
    tableau(doc, ["N°", "Phase", "Tâche", "Durée (j)", "Début", "Fin", "Ressources (% d'occupation)"], lignes)
    for a in c.anomalies:
        doc.add_paragraph(f"⚠ {a}")
    out = enregistrer(doc, dossier / "CHRONOGRAMME.docx", en_pdf)
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "CHRONOGRAMME"
    jours = [c.debut + timedelta(days=k) for k in range((c.fin - c.debut).days + 1)]
    _entete_xlsx(ws, ["N°", "Phase", "Tâche", "Durée (j)", "Début", "Fin", "Ressources", *[j.strftime("%d/%m") for j in jours]])
    remplissage = PatternFill("solid", fgColor=charte_par_defaut().palette[1])
    for k, (t, li) in enumerate(zip(c.taches, lignes, strict=True), start=2):
        ws.append([int(li[0]), li[1], li[2], t.jours, t.debut, t.fin, li[6]])
        for j, jour in enumerate(jours):
            if t.debut <= jour <= t.fin and jour.weekday() < 5:
                ws.cell(row=k, column=8 + j).fill = remplissage
    chemin = dossier / "CHRONOGRAMME.xlsx"
    wb.save(chemin)
    return [*out, chemin]


# ------------------------------------------------------------------------------------------------ organisation
def organisation(p: Projet, dossier: Path, en_pdf: bool = False) -> list[Path]:
    """Organigramme du terrain (format du PDF d'organisation EDM) : cibles (effectifs) → villes → zones → quartiers →
    enquêteurs, puis le tableau des affectations."""
    t, pe = p.exiger_terrain(), p.exiger_echantillonnage()
    doc = nouveau("Organisation du terrain", fictif=p.brief.fictif, sous_titre=p.brief.titre, logo=_logo(p))
    titre(doc, f"Cibles ({pe.total()} fiches)")
    for q in pe.quotas:
        doc.add_paragraph(f"{q.cible} : {sum(q.villes.values())} ({', '.join(f'{t.ville(v).libelle} {n}' for v, n in q.villes.items())})",
                          style="List Bullet")
    if pe.mention():
        doc.add_paragraph(pe.mention()).runs[0].italic = True
    for v in t.villes:
        sup = next((m for m in t.equipe if m.id == v.superviseur), None)
        nom_sup = p.vivier.personne(sup.personne).nom_complet if sup and sup.personne else "—"
        titre(doc, f"{v.libelle} — {pe.par_ville().get(v.id, 0)} fiches — superviseur : {nom_sup}", 2)
        for z in [z for z in t.zones if z.ville == v.id]:
            doc.add_paragraph(f"{z.libelle} : " + ", ".join(p.referentiel.localite(x).nom for x in z.localites), style="List Bullet")
            for e in [e for e in t.enqueteurs if z.id in e.zones]:
                nom = p.vivier.personne(e.personne).nom_complet if e.personne else "(non pourvu)"
                doc.add_paragraph(f"{e.id} — {nom}", style="List Bullet 2")
        reserves = [e for e in t.enqueteurs if e.ville == v.id and e.role.value == "reserve"]
        for e in reserves:
            nom = p.vivier.personne(e.personne).nom_complet if e.personne else "(non pourvu)"
            doc.add_paragraph(f"Réserve : {e.id} — {nom} (hors statistiques tant qu'elle n'est pas activée)", style="List Bullet")
    return enregistrer(doc, dossier / "ORGANISATION_TERRAIN.docx", en_pdf)


# ------------------------------------------------------------------------------------------------ paiements et devis
COLONNES_FICHE = ["Poste", "Nom", "Statut", "Ville", "Superviseur de ville", "Honoraires", "Formation PU", "Formation qté",
                  "Collecte PU", "Collecte jours", "Transport PU", "Transport qté", "Hébergement PU", "Hébergement qté",
                  "Dépouillement PU", "Dépouillement qté", "Total", "Avance", "Reste"]


def paiements(p: Projet, dossier: Path, en_pdf: bool = False) -> list[Path]:
    t = p.exiger_terrain()
    f = fiche(t, p.tarifs, p.vivier)
    dv = p.tarifs.devise
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "PROFIL_PAIEMENTS"
    _entete_xlsx(ws, COLONNES_FICHE)
    for li in f.lignes:
        ws.append([li.poste, li.nom, li.statut, li.ville, li.superviseur, li.honoraires, li.formation.pu, li.formation.qte,
                   li.collecte.pu, li.collecte.qte, li.transport.pu, li.transport.qte, li.hebergement.pu, li.hebergement.qte,
                   li.depouillement.pu, li.depouillement.qte, li.total, li.avance, li.reste])
    ws.append(["Total des personnes", "", "", "", "", *[""] * 11, f.total_personnes, sum(li.avance for li in f.lignes),
               sum(li.reste for li in f.lignes)])
    for nom, r in f.impressions.lignes.items():
        ws.append([f"Impressions — {nom}", "", "", "", "", "", "", "", "", "", "", "", "", "", r.pu, r.qte, r.montant])
    ws.append(["TOTAL GÉNÉRAL", *[""] * 15, f.total_general])
    ws.append(["Contrôle", "somme des lignes = total général" if not f.anomalies else " ; ".join(f.anomalies)])
    chemin_xlsx = dossier / "PROFIL_PAIEMENTS.xlsx"
    chemin_xlsx.parent.mkdir(parents=True, exist_ok=True)
    wb.save(chemin_xlsx)
    doc = nouveau("Fiche profil des paiements", fictif=p.brief.fictif, sous_titre=p.brief.titre, logo=_logo(p))
    tableau(doc, ["Poste", "Nom", "Statut", "Ville", "Total", "Avance", "Reste"],
            [[li.poste, li.nom, li.statut, li.ville, montant(li.total, ""), montant(li.avance, ""), montant(li.reste, "")]
             for li in f.lignes] + [["", "Impressions", "", "", montant(f.impressions.total, ""), "", ""],
                                    ["", "TOTAL GÉNÉRAL", "", "", montant(f.total_general, ""), "", ""]])
    doc.add_paragraph(f"Montants en {dv}. Détail par rubrique (prix unitaire × quantité) dans PROFIL_PAIEMENTS.xlsx. "
                      + ("Contrôle : somme des lignes = total général." if not f.anomalies else "ANOMALIES : " + " ; ".join(f.anomalies)))
    out = enregistrer(doc, dossier / "PROFIL_PAIEMENTS.docx", en_pdf)
    d = devis(f, p.tarifs)
    doc = nouveau(f"Devis — {p.brief.titre}", fictif=p.brief.fictif, logo=_logo(p),
                  sous_titre=f"Client : {p.brief.client.raison_sociale} — cahier des charges {p.brief.version}")
    tableau(doc, ["Poste de coût", f"Montant ({dv})"], [[n, montant(v, "")] for n, v in d.lignes]
            + [["Coût total", montant(d.cout, "")], [f"Marge ({round(p.tarifs.marge * 100)} % du prix HT)", montant(d.marge, "")],
               ["PRIX HORS TAXES", montant(d.prix_ht, "")]], largeurs_cm=[11, 5])
    doc.add_paragraph("Taxes applicables selon le régime fiscal du client et du cabinet, en sus. Devis à valider par l'usine "
                      "avant engagement (CLAUDE.md §7.2).")
    return [chemin_xlsx, *out, *enregistrer(doc, dossier / "DEVIS.docx", en_pdf)]
