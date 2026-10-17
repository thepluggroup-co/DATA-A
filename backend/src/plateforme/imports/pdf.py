"""Extraction d'un BROUILLON de dictionnaire depuis un questionnaire PDF (« Qn. libellé : ☐ a ☐ b … »).

Le résultat porte le statut « brouillon » : une revue humaine est obligatoire avant validation
(M4). Les codes de variables et de modalités sont repris d'un dictionnaire de RÉFÉRENCE quand
la question y est reconnue (même numéro et libellé proche, ou même libellé) ; sinon un code est
proposé et un avertissement l'indique.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from plateforme.dictionnaire.modele import (
    Autre,
    Dictionnaire,
    LigneGrille,
    Mesure,
    Modalite,
    Question,
    Section,
    TypeQuestion,
)
from plateforme.noyau.textes import cle, normaliser, sans_accents

CASES = "☐□❑"
RE_CASE = re.compile(f"[{CASES}]")
RE_QUESTION = re.compile(r"(?:(?<=\s)|^)Q(\d{1,2})\.\s*")
RE_SECTION = re.compile(r"^\s*(\d{1,2})\.\s+([A-ZÉÈÀÂÎÔÛÇ][^☐□]{2,60}?)\s*$", re.MULTILINE)
RE_MENTION = re.compile(r"\((?:une seule réponse|cochez une case par ligne|plusieurs réponses|facultatif)\)", re.IGNORECASE)
MOTS_VIDES = {"de", "du", "des", "le", "la", "les", "l", "d", "un", "une", "a", "au", "aux", "et", "en", "pour", "par", "vous",
              "votre", "selon", "est", "ce", "qui", "quel", "quelle", "que", "sur", "avec"}


@dataclass
class ResultatImport:
    dictionnaire: Dictionnaire
    avertissements: list[str]


def texte_pdf(chemin: str | Path) -> str:
    from pypdf import PdfReader  # import local : dépendance chargée seulement pour cet import
    return "\n".join(page.extract_text() or "" for page in PdfReader(str(chemin)).pages)


def _proposer_code(libelle: str, pris: set[str]) -> str:
    """Code de 8 lettres formé des initiales des mots significatifs (convention V11), rendu unique."""
    mots = [m for m in re.findall(r"[a-z]+", sans_accents(libelle)) if m not in MOTS_VIDES]
    lettres = ("".join(m[:2] for m in mots) or "question").upper()
    base = (lettres + "XXXXXXXX")[:8]
    code, i = base, 0
    while code in pris:
        i += 1
        code = base[:6] + f"{i:02d}".translate(str.maketrans("0123456789", "ABCDEFGHIJ"))
    pris.add(code)
    return code


def _proche(a: str, b: str) -> float:
    return SequenceMatcher(None, cle(a), cle(b)).ratio()


def _decouper(texte: str) -> tuple[list[tuple[int, str]], list[tuple[int, str, int]]]:
    """Renvoie [(numéro, bloc de texte)] et [(n° de section, libellé, position)]."""
    sections = [(int(m.group(1)), normaliser(m.group(2)), m.start()) for m in RE_SECTION.finditer(texte)]
    reperes = list(RE_QUESTION.finditer(texte))
    blocs = []
    for i, m in enumerate(reperes):
        fin = reperes[i + 1].start() if i + 1 < len(reperes) else len(texte)
        bloc = texte[m.end():fin]
        for s in sections:                       # retire un titre de section collé à la fin du bloc
            if m.end() < s[2] < fin:
                bloc = texte[m.end():s[2]]
        blocs.append((int(m.group(1)), bloc))
    return blocs, sections


def depuis_pdf(chemin: str | Path, version: str, reference: Dictionnaire) -> ResultatImport:
    return depuis_texte(texte_pdf(chemin), version, reference, source=Path(chemin).name)


RE_PIED_DE_PAGE = re.compile(r"^\s*\d+\s*-\s*\d+\s*$", re.MULTILINE)      # « 2-2 » en tête ou pied de page


def _colonnes_grille(bloc: str, ref: Question, reference: Dictionnaire) -> list[str] | None:
    """Colonnes d'une grille : repérées dans l'en-tête du tableau d'après les libellés de la référence."""
    premiere = reference.texte(ref.lignes[0].libelles)
    debut = bloc.find(premiere)
    if debut < 0:
        return None
    entete = cle(bloc[:debut])
    trouvees, pos = [], 0
    for m in ref.modalites:
        k = cle(reference.texte(m.libelles))
        i = entete.find(k, pos)
        if i < 0:
            return None
        trouvees.append(reference.texte(m.libelles))
        pos = i + len(k)
    return trouvees


def _coder(libelles: list[str], ref: Question | None, n: int, reference: Dictionnaire, avert: list[str]) -> list[Modalite]:
    """Codes des modalités : ceux de la référence si le libellé y est reconnu, 98 pour NSP / sans avis, sinon proposés."""
    ref_mods = {cle(reference.texte(m.libelles)): m for m in (ref.modalites if ref else [])}
    mods: list[Modalite] = []
    prochains = 1
    for lib in libelles:
        m = ref_mods.get(cle(lib))
        if m is not None:
            mods.append(Modalite(code=m.code, libelles={"fr": lib}, variable=m.variable))
            continue
        if cle(lib) in ("nsp", "sansavis", "nesaitpas"):
            mods.append(Modalite(code=reference.codes_speciaux.ne_sait_pas, libelles={"fr": lib}))
            continue
        pris_codes = {x.code for x in mods} | {x.code for x in ref_mods.values()}
        while prochains in pris_codes:
            prochains += 1
        mods.append(Modalite(code=prochains, libelles={"fr": lib}))
        if ref is not None:
            avert.append(f"Q{n} : modalité « {lib} » absente de la référence, code {prochains} proposé")
    return mods


def depuis_texte(texte: str, version: str, reference: Dictionnaire, source: str = "") -> ResultatImport:
    avert: list[str] = []
    texte = RE_PIED_DE_PAGE.sub("", texte)
    blocs, sections_pdf = _decouper(texte)
    pris = {v for q in reference.questions for v in [q.code, *q.variables()]}
    sections: list[Section] = []
    questions: list[Question] = []
    for n, bloc in blocs:
        bloc_net = normaliser(bloc)
        aide = "; ".join(m.group(0)[1:-1] for m in RE_MENTION.finditer(bloc_net) if "plusieurs" not in m.group(0).lower()
                         and "facultatif" not in m.group(0).lower())
        multiple = "plusieurs réponses" in bloc_net.lower()
        facultatif = "(facultatif)" in bloc_net.lower()
        parties = RE_CASE.split(bloc_net)
        titre = normaliser(RE_MENTION.sub("", parties[0])).strip(" :.…").strip()
        options = [normaliser(RE_MENTION.sub("", o)).strip(" :") for o in parties[1:]]
        # Section : dernier titre de section rencontré avant la question
        pos = texte.find(f"Q{n}.")
        sec = max((s for s in sections_pdf if s[2] < pos), key=lambda s: s[2], default=(0, "Sans section", 0))
        sid = f"S{sec[0]}" if sec[0] else "S_INCONNUE"
        if not any(s.id == sid for s in sections):
            sections.append(Section(id=sid, libelles={"fr": f"{sec[0]}. {sec[1]}" if sec[0] else sec[1]}))
        # Rapprochement avec la référence
        ref = next((q for q in reference.questions if q.numero == n and _proche(reference.texte(q.libelles), titre) > 0.6), None)
        if ref is None:
            ref = max(reference.questions, key=lambda q: _proche(reference.texte(q.libelles), titre))
            if _proche(reference.texte(ref.libelles), titre) <= 0.8:
                ref = None
        code = ref.code if ref else _proposer_code(titre, pris)
        if ref is None:
            avert.append(f"Q{n} « {titre} » : absente de la référence, code proposé {code}")
        def coder(libelles: list[str], ref: Question | None = ref, n: int = n) -> list[Modalite]:
            return _coder(libelles, ref, n, reference, avert)

        colonnes = _colonnes_grille(bloc_net, ref, reference) if ref and ref.type is TypeQuestion.GRILLE else None
        if ref and ref.type is TypeQuestion.GRILLE and colonnes is None:
            avert.append(f"Q{n} : grille dont les colonnes ne correspondent pas à la référence, lue comme choix unique")
        if colonnes and ref:
            premiere = reference.texte(ref.lignes[0].libelles)
            titre = RE_MENTION.sub("", bloc_net[:bloc_net.find(premiere)]).strip()
            titre = titre[:titre.rfind("?") + 1] if "?" in titre else titre
            questions.append(Question(
                numero=n, code=code, section=sid, libelles={"fr": titre}, type=TypeQuestion.GRILLE, mesure=ref.mesure,
                aide={"fr": aide} if aide else {}, modalites=coder(colonnes),
                lignes=[LigneGrille(variable=li.variable, libelles={"fr": reference.texte(li.libelles)}) for li in ref.lignes
                        if cle(reference.texte(li.libelles)) in cle(bloc_net)]))
            continue
        if not options:
            questions.append(Question(numero=n, code=code, section=sid, libelles={"fr": titre}, type=TypeQuestion.TEXTE,
                                      obligatoire=not facultatif))
            continue
        autre = None
        if options and re.match(r"^autre\b", cle(options[-1])[:5]):
            options = options[:-1]
            if ref and ref.autre:
                autre = Autre(code=ref.autre.code, libelles={"fr": "Autre"}, variable=ref.autre.variable)
            else:
                autre = Autre(code=len(options) + 1, libelles={"fr": "Autre"}, variable=_proposer_code(titre + " autre", pris))
                avert.append(f"Q{n} : option « Autre » sans variable dans la référence, {autre.variable} proposée")
        if multiple:
            mods = coder(options)
            variables = {cle(reference.texte(m.libelles)): m.variable for m in (ref.modalites if ref else [])}
            mods = [Modalite(code=i + 1, libelles=m.libelles,
                             variable=variables.get(cle(m.libelles["fr"])) or _proposer_code(titre + " " + m.libelles["fr"], pris))
                    for i, m in enumerate(mods)]
            questions.append(Question(numero=n, code=code, section=sid, libelles={"fr": titre}, type=TypeQuestion.CHOIX_MULTIPLE,
                                      modalites=mods))
            continue
        questions.append(Question(numero=n, code=code, section=sid, libelles={"fr": titre}, type=TypeQuestion.CHOIX_UNIQUE,
                                  mesure=ref.mesure if ref and ref.mesure else Mesure.NOMINAL, aide={"fr": aide} if aide else {},
                                  modalites=coder(options), autre=autre,
                                  role=ref.role if ref else None, prerempli=ref.prerempli if ref else None))
        if ref is None:
            avert.append(f"Q{n} : mesure NOMINAL supposée, à vérifier")
    dico = Dictionnaire(etude=reference.etude, version=version, langues=["fr"], statut="brouillon", source=source,
                        sections=sections, identification=list(reference.identification), questions=questions)
    return ResultatImport(dico, avert)
