"""Formation des enquêteurs (M8) : support en 8 parties (carte mentale « FORMATION ENQUETEURS EDM », CLAUDE.md §3.1),
rempli depuis le projet, en Word et en présentation ; quiz de validation avec corrigé et score minimal.

Plan : 1. contexte et objectifs ; 2. équipe ; 3. déroulement ; 4. organisation ; 5. questionnaire ; 6. badge ;
7. charte ; 8. divers (questions-réponses, perdiems de formation et de jour d'enquête).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from plateforme.documents.commun import date_fr, enregistrer, montant, nouveau, titre
from plateforme.documents.enqueteur import COMPORTEMENT_DOIT, COMPORTEMENT_NE_DOIT_PAS, _argumentaire, _consignes
from plateforme.projet.projet import Projet

SCORE_MIN = 0.8          # part de bonnes réponses exigée (paramètre du support ; à confirmer par l'usine)


def parties(p: Projet) -> list[tuple[str, list[str]]]:
    """Les 8 parties du support : (titre, puces)."""
    b, t, pe, d = p.brief, p.exiger_terrain(), p.exiger_echantillonnage(), p.dictionnaire
    jours = t.jours_ouvres()
    nom = {m.id: (p.vivier.personne(m.personne).nom_complet if m.personne else "—") for m in t.equipe}
    bareme = t.baremes.get("titulaire")
    perdiems = []
    if bareme and bareme.formation:
        seuls = " (titulaires seulement)" if t.formation_titulaires_seuls else ""
        perdiems.append(f"Formation : {montant(bareme.formation.pu, p.tarifs.devise)}{seuls}")
    if bareme and bareme.collecte:
        perdiems.append(f"Jour d'enquête : {montant(bareme.collecte.pu, p.tarifs.devise)} par jour de terrain tenu")
    if bareme and bareme.transport:
        perdiems.append(f"Transport : {montant(bareme.transport.pu, p.tarifs.devise)} × {bareme.transport.qte:g}")
    enqueteurs = [f"{e.id} — {p.vivier.personne(e.personne).nom_complet if e.personne else '(non pourvu)'}"
                  + (" (réserve)" if e.role.value == "reserve" else "") for e in t.enqueteurs]
    return [
        ("1. Contexte de la réunion", [f"Projet : {b.titre} — client : {b.client.raison_sociale}", f"Contexte : {b.besoin}",
                                       *[f"Objectif du promoteur : {o}" for o in b.objectifs],
                                       f"Objectif du cabinet : livrer {', '.join(b.livrables) or 'les livrables du cahier des charges'}",
                                       f"Objectif des enquêteurs : {round(t.objectif_jour)} fiches complètes et sincères par jour",
                                       "Ce qu'on attend des enquêteurs : respect de la charte, des quotas et des zones"]),
        ("2. Présentation de l'équipe", [f"Cabinet : {p.cabinet.nom}",
                                         *[f"{m.fonction.value.replace('_', ' ').capitalize()}"
                                           + (f" ({t.ville(m.ville).libelle})" if m.ville else "") + f" : {nom[m.id]}" for m in t.equipe],
                                         *enqueteurs]),
        ("3. Déroulement de la descente sur le terrain", [
            "Étapes : recrutement → formation → pré-test → descente sur le terrain",
            f"Formation : {date_fr(t.calendrier.formation, True)}" if t.calendrier.formation else "Formation : date à fixer",
            f"Pré-test : {date_fr(t.calendrier.pre_test, True)} (mode test, fiches exclues de la base)" if t.calendrier.pre_test else "Pré-test : date à fixer",
            f"Terrain : du {date_fr(min(jours), True)} au {date_fr(max(jours), True)}" if jours else "Terrain : dates à fixer",
            "Pendant la formation : lire chaque question à voix haute, poser ses questions",
            "Lors du pré-test : noter les questions mal comprises et la durée des entretiens",
            "Lors de l'enquête : porter le badge, suivre ses zones, envoyer chaque fiche dès qu'elle est complète"]),
        ("4. Organisation de l'enquête", [*[f"Cible « {q.cible} » : {sum(q.villes.values())} fiches" for q in pe.quotas],
                                          *[f"{v.libelle} : {pe.par_ville().get(v.id, 0)} fiches ; "
                                            + " ; ".join(f"{z.libelle} ({', '.join(p.referentiel.localite(x).nom for x in z.localites)})"
                                                         for z in t.zones if z.ville == v.id) for v in t.villes],
                                          f"Objectif par enquêteur : {round(t.objectif_jour)} fiches par jour × {len(jours)} jours"]),
        ("5. Questionnaire / formulaire", [f"Grandes parties : {', '.join(d.texte(s.libelles) for s in d.sections)}",
                                           *[d.titre_question(q) for q in d.questions], *_consignes(p, t)]),
        ("6. Badge d'identification", ["À porter de façon visible pendant toute la durée du terrain",
                                       "Il indique le nom, l'identifiant, la ville, la validité et les contacts du bureau",
                                       "Le QR code permet à l'enquêté de vérifier que l'enquêteur est autorisé"]),
        ("7. La charte des enquêteurs", [*[f"Doit : {x}" for x in COMPORTEMENT_DOIT[:4]],
                                         *[f"Ne doit pas : {x}" for x in COMPORTEMENT_NE_DOIT_PAS[:4]],
                                         f"Argumentaire : {_argumentaire(p)}"]),
        ("8. Divers", ["Questions / réponses", *(perdiems or ["Perdiems : selon la fiche profil des paiements"])]),
    ]


def support(p: Projet, dossier: Path, en_pdf: bool = False) -> list[Path]:
    doc = nouveau("Formation des enquêteurs", fictif=p.brief.fictif, sous_titre=p.brief.titre,
                  logo=p.chemin(p.cabinet.logo) if p.cabinet.logo else None)
    for intitule, puces in parties(p):
        titre(doc, intitule)
        for x in puces:
            doc.add_paragraph(x, style="List Bullet")
    out = enregistrer(doc, dossier / "FORMATION_SUPPORT.docx", en_pdf)
    return [*out, presentation(p, dossier / "FORMATION_SUPPORT.pptx")]


def presentation(p: Projet, chemin: Path) -> Path:
    from pptx import Presentation
    from pptx.util import Pt

    prs = Presentation()
    couverture = prs.slides.add_slide(prs.slide_layouts[0])
    couverture.shapes.title.text = "Formation des enquêteurs"
    couverture.placeholders[1].text = p.brief.titre + ("\nPROJET FICTIF DE DÉMONSTRATION" if p.brief.fictif else "")
    for intitule, puces in parties(p):
        for k in range(0, len(puces), 7):                    # 7 puces par diapositive, au plus
            s = prs.slides.add_slide(prs.slide_layouts[1])
            s.shapes.title.text = intitule + (" (suite)" if k else "")
            cadre = s.placeholders[1].text_frame
            cadre.clear()
            for j, x in enumerate(puces[k:k + 7]):
                par = cadre.paragraphs[0] if j == 0 else cadre.add_paragraph()
                par.text = x
                par.font.size = Pt(16)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(chemin))
    return chemin


@dataclass(frozen=True)
class QuestionQuiz:
    enonce: str
    choix: list[str]
    bonne: int                   # indice dans `choix`


def quiz(p: Projet) -> list[QuestionQuiz]:
    """Questions tirées du projet (jamais inventées) : objectif journalier, question de quota, nombre de parties, lien
    personnel, réponses multiples, conduite face à un refus de recontact, mode test du pré-test, superviseur."""
    t, d = p.exiger_terrain(), p.dictionnaire
    obj = round(t.objectif_jour)
    out = [QuestionQuiz("Combien de fiches devez-vous réaliser par jour ?", [str(obj - 5), str(obj), str(obj + 10)], 1),
           QuestionQuiz("Combien de parties compte le questionnaire ?", [str(len(d.sections)), str(len(d.sections) + 2), str(len(d.questions))], 0),
           QuestionQuiz("Quel lien utilisez-vous pour remplir les fiches ?",
                        ["Le lien d'un collègue", "Mon lien personnel", "Le lien public de l'étude"], 1),
           QuestionQuiz("L'enquêté refuse d'être recontacté. Que faites-vous ?",
                        ["J'insiste poliment", "Je coche « Oui » quand même", "Je respecte son refus et je coche « Non »"], 2),
           QuestionQuiz("Les fiches du pré-test entrent-elles dans la base de l'étude ?",
                        ["Oui", "Non, elles sont en mode test", "Seulement si elles sont complètes"], 1),
           QuestionQuiz("Une question mal comprise par l'enquêté :", ["Je réponds à sa place", "Je la relis ou la reformule sans en changer le sens",
                                                                      "Je passe à la suivante"], 1)]
    q = d.question_cible()
    if q is not None:
        autre = next((x for x in d.questions if x.code != q.code), q)
        out.insert(1, QuestionQuiz("Quelle question détermine les quotas et ne doit jamais être sautée ?",
                                   [d.titre_question(autre), d.titre_question(q)], 1))
    multiples = [x for x in d.questions if x.type.value == "choix_multiple"]
    if multiples:
        out.append(QuestionQuiz(f"« {d.titre_question(multiples[0])} » admet-elle plusieurs réponses ?", ["Oui", "Non"], 0))
    return out


def quiz_docx(p: Projet, dossier: Path, en_pdf: bool = False) -> list[Path]:
    questions = quiz(p)
    doc = nouveau("Quiz de validation de la formation", fictif=p.brief.fictif, sous_titre=p.brief.titre,
                  logo=p.chemin(p.cabinet.logo) if p.cabinet.logo else None)
    doc.add_paragraph(f"Nom : ______________________   Identifiant : ________   Score minimal pour valider : "
                      f"{round(SCORE_MIN * len(questions))} / {len(questions)}")
    for k, q in enumerate(questions, start=1):
        doc.add_paragraph().add_run(f"{k}. {q.enonce}").bold = True
        for c in q.choix:
            doc.add_paragraph(f"☐ {c}")
    titre(doc, "Corrigé (réservé au formateur)")
    for k, q in enumerate(questions, start=1):
        doc.add_paragraph(f"{k}. {q.choix[q.bonne]}")
    return enregistrer(doc, dossier / "FORMATION_QUIZ.docx", en_pdf)


def noter(questions: list[QuestionQuiz], reponses: list[int]) -> tuple[int, bool]:
    """(bonnes réponses, validé ?) ; le score minimal est SCORE_MIN de la part des questions."""
    if len(reponses) != len(questions):
        raise ValueError("une réponse par question attendue")
    bonnes = sum(1 for q, r in zip(questions, reponses, strict=True) if q.bonne == r)
    return bonnes, bonnes >= round(SCORE_MIN * len(questions))
