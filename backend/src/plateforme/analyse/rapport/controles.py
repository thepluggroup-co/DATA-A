"""Contrôles BLOQUANTS avant export du rapport (M15, CLAUDE.md §5 et §9). Un rapport qui porte une anomalie bloquante
n'est pas exporté. Objectif : « zéro observation de cohérence de la part du client ».

| Code | Contrôle |
|---|---|
| NUMERO_DOUBLE / NUMERO_MANQUANT / NUMERO_DESORDRE | numérotation des tableaux et des figures, par série (« », « S », « A ») |
| RENVOI_INEXISTANT | « voir tableau 12 » vers un tableau absent |
| LEGENDE_MANQUANTE / SOURCE_MANQUANTE / BASE_MANQUANTE | titre, source et note de base sous chaque tableau et figure |
| BASE_DIFFERENTE / TOTAL_DIFFERENT | base et effectifs du rapport ≠ recalcul sur la base d'analyse (tri à plat, .sav) |
| TABLEAU_INCOMPLET | tableau récapitulatif qui ne couvre pas toutes les variables attendues |
| CHIFFRE_SANS_LIEN | chiffre écrit en dur dans un paragraphe au lieu d'une référence [[…]] |
| REFERENCE_INVALIDE | référence [[…]] introuvable |
| TERME_ETRANGER | terme interdit (autre étude, ville hors projet…) |
| ENCODAGE | texte abîmé (« Ã© », « â€™ », caractère de remplacement) |
| SECTIONS_CONCLUSIONS | conclusions et recommandations absentes ou non séparées |

Avertissement (non bloquant) : RECOMMANDATION_DANS_CONCLUSIONS (formule de recommandation dans la section conclusions).
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass

from plateforme.analyse import procedures as p
from plateforme.analyse.donnees import JeuDonnees
from plateforme.analyse.rapport.modele import (
    REFERENCE,
    ElementNumerote,
    Figure,
    Paragraphe,
    Rapport,
    ReferenceInvalide,
    TableauRapport,
    Titre,
    valeur_reference,
)


@dataclass(frozen=True)
class Anomalie:
    code: str
    message: str
    bloquante: bool = True


_NUMERO = re.compile(r"^(?P<serie>[A-Z]?)(?P<n>\d+)(?P<suffixe>(?: (?:bis|ter))?)$")
_RENVOI = re.compile(r"\b(tableau|graphique|figure)s? (?P<num>[A-Z]?\d+(?: (?:bis|ter))?)\b", re.IGNORECASE)
# chiffres admis hors référence : renvois numérotés, numéros de questions (Q12), codes de variables
_ADMIS_RENVOIS = re.compile(r"\b(?:tableaux?|graphiques?|figures?|sections?|parties?)\s+[A-Z]?\d+(?:\s+(?:bis|ter))?"
                            r"(?:\s*(?:,|et|à)\s*[A-Z]?\d+)*", re.IGNORECASE)
# III.B.2, Q12, codes de variables et d'enquêteurs (ENQ10), noms propres mêlant lettres et chiffres (M2B)
_ADMIS_CODES = re.compile(r"\b[IVX]+\.[A-Z](?:\.\d+)*\b|\bQ\d+\b|\b[A-Z][A-Z_]+\d*\b|\b[A-Z]+\d+[A-Z]+\w*\b")
_CASSE = re.compile("Ã[\u0080-¿©¨ª«®´¹»¢§¯°µ]|â€|�|Â[ -¿]")
RECOMMANDATION = ("nous recommandons", "il faut", "il faudrait", "devrait", "devraient", "il convient de", "doit ", "doivent ")


def _cle(texte: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texte.lower()) if unicodedata.category(c) != "Mn")


def numerotation(rapport: Rapport) -> list[Anomalie]:
    out: list[Anomalie] = []
    for genre, classe in (("tableau", TableauRapport), ("figure", Figure)):
        vus: dict[str, list[int]] = {}
        deja: set[str] = set()
        for e in rapport.numerotes():
            if not isinstance(e, classe):
                continue
            m = _NUMERO.match(e.numero)
            if not m:
                out.append(Anomalie("NUMERO_DESORDRE", f"{genre} « {e.numero} » : numéro illisible (attendu 5, 2 bis, S1, A2…)"))
                continue
            if e.numero in deja:
                out.append(Anomalie("NUMERO_DOUBLE", f"{genre} {e.numero} numéroté deux fois"))
            deja.add(e.numero)
            serie, n = m["serie"], int(m["n"])
            if m["suffixe"]:
                if n not in vus.get(serie, []):
                    out.append(Anomalie("NUMERO_DESORDRE", f"{genre} {e.numero} avant le {genre} {serie}{n}"))
                continue
            precedents = vus.setdefault(serie, [])
            if precedents and n != precedents[-1] + 1:
                code = "NUMERO_MANQUANT" if n > precedents[-1] + 1 else "NUMERO_DESORDRE"
                out.append(Anomalie(code, f"{genre} {serie}{n} après le {genre} {serie}{precedents[-1]}"))
            precedents.append(n)
    return out


def renvois(rapport: Rapport) -> list[Anomalie]:
    existants = {("tableau", e.numero) for e in rapport.numerotes() if isinstance(e, TableauRapport)}
    existants |= {("figure", e.numero) for e in rapport.numerotes() if isinstance(e, Figure)}
    out = []
    for e in rapport.elements:
        if isinstance(e, Paragraphe):
            for m in _RENVOI.finditer(e.texte):
                genre = "tableau" if m.group(1).lower().startswith("tableau") else "figure"
                if (genre, m["num"]) not in existants:
                    out.append(Anomalie("RENVOI_INEXISTANT", f"« {m.group(0)} » : aucun {genre} {m['num']} dans le rapport"))
    return out


def legendes(rapport: Rapport) -> list[Anomalie]:
    out = []
    for e in rapport.numerotes():
        nom = f"{'tableau' if isinstance(e, TableauRapport) else 'figure'} {e.numero}"
        if not e.titre.strip():
            out.append(Anomalie("LEGENDE_MANQUANTE", f"{nom} sans titre"))
        if not e.source.strip():
            out.append(Anomalie("SOURCE_MANQUANTE", f"{nom} sans source"))
        if e.resultat is not None and not e.note_base.strip():
            out.append(Anomalie("BASE_MANQUANTE", f"{nom} sans note de base"))
        if e.resultat is not None and e.note_base and str(e.resultat.base) not in e.note_base.replace(" ", ""):
            out.append(Anomalie("BASE_DIFFERENTE", f"{nom} : la note de base n'affiche pas la base du calcul ({e.resultat.base})"))
    return out


def bases(rapport: Rapport, jeux: dict[str, JeuDonnees]) -> list[Anomalie]:
    """Recalcule chaque tableau de fréquences sur SA base (analyse ou collecte : celles du tri à plat et du .sav), avec
    le même filtre et la même pondération, et compare base, effectifs et total."""
    from plateforme.analyse.derivees import _Evaluateur

    out = []
    for e in rapport.numerotes():
        r = e.resultat
        if isinstance(r, p.Repartitions):
            out += _bases_repartitions(e.numero, r, jeux.get(e.base), e.filtre)
            continue
        if not isinstance(r, p.Frequences):
            continue
        jd = jeux.get(e.base)
        if jd is None or r.variable not in jd.table.columns:
            out.append(Anomalie("BASE_DIFFERENTE", f"{e.numero} ({r.variable}) : variable absente de la base « {e.base} »"))
            continue
        if e.filtre:
            jd = jd.filtrer(_Evaluateur._bool(_Evaluateur(jd)(e.filtre)), e.filtre)
        ref = p.frequences(jd, r.variable, r.ponderation)
        if ref.base != r.base:
            out.append(Anomalie("BASE_DIFFERENTE", f"{e.numero} ({r.variable}) : base {r.base} dans le rapport, {ref.base} dans la base « {e.base} »"))
        attendu = {li.code: round(li.effectif, 6) for li in ref.lignes}
        affiche = {li.code: round(li.effectif, 6) for li in r.lignes}
        if attendu != affiche or abs(r.total_pondere - sum(li.effectif for li in r.lignes)) > 1e-6:
            out.append(Anomalie("TOTAL_DIFFERENT", f"{e.numero} ({r.variable}) : effectifs ou total différents de la base « {e.base} »"))
    return out


def _bases_repartitions(numero: str, r: p.Repartitions, jd: JeuDonnees | None, filtre: str | None) -> list[Anomalie]:
    """Répartitions côte à côte : chaque sous-population est recalculée sur la base avec sa propre condition."""
    from plateforme.analyse.derivees import _Evaluateur

    if jd is None or r.variable not in jd.table.columns:
        return [Anomalie("BASE_DIFFERENTE", f"{numero} ({r.variable}) : variable absente de la base")]
    if filtre:
        jd = jd.filtrer(_Evaluateur._bool(_Evaluateur(jd)(filtre)), filtre)
    out = []
    for titre, freq in r.parts.items():
        condition = r.conditions.get(titre, "")
        sous = jd.filtrer(_Evaluateur._bool(_Evaluateur(jd)(condition)), condition) if condition else jd
        ref = p.frequences(sous, r.variable, freq.ponderation)
        if ref.base != freq.base or {li.code: round(li.effectif, 6) for li in ref.lignes} != {li.code: round(li.effectif, 6) for li in freq.lignes}:
            out.append(Anomalie("BASE_DIFFERENTE", f"{numero} ({r.variable}, {titre}) : base ou effectifs différents de la base"))
    return out


def completude(rapport: Rapport) -> list[Anomalie]:
    """Tableau récapitulatif incomplet (cas vécu : tableau de synthèse livré avec 43 variables sur 56)."""
    return [Anomalie("TABLEAU_INCOMPLET", f"tableau {e.numero} : {len(e.resultat.lignes)} variables sur {e.resultat.attendu} attendues")
            for e in rapport.numerotes()
            if isinstance(e.resultat, p.Recapitulatif | p.Remplissage) and e.resultat.attendu is not None
            and len(e.resultat.lignes) != e.resultat.attendu]


def textes_libres(rapport: Rapport, rediges: bool = False) -> list[str]:
    """Textes rédigés (paragraphes et cellules des tableaux statiques) : ils peuvent porter des références [[…]].
    `rediges` : sans les paragraphes générés depuis le dictionnaire (libellés de modalités, pas des chiffres d'enquête)."""
    out = [e.texte for e in rapport.elements if isinstance(e, Paragraphe) and not (rediges and e.origine == "dictionnaire")]
    for e in rapport.elements:
        if isinstance(e, TableauRapport) and e.contenu:
            out += [cellule for ligne in e.contenu for cellule in ligne]
    return out


def chiffres(rapport: Rapport) -> list[Anomalie]:
    resultats = rapport.resultats()
    out = []
    for texte in textes_libres(rapport, rediges=True):
        for m in REFERENCE.finditer(texte):
            if not m.group(1).startswith("lit:"):
                try:
                    valeur_reference(m.group(1), resultats)
                except ReferenceInvalide as err:
                    out.append(Anomalie("REFERENCE_INVALIDE", str(err)))
        nu = _ADMIS_CODES.sub(" ", _ADMIS_RENVOIS.sub(" ", REFERENCE.sub(" ", texte)))
        for m in re.finditer(r"\d+(?:[.,]\d+)?\s*%?", nu):
            extrait = texte[:80].replace("\n", " ")
            out.append(Anomalie("CHIFFRE_SANS_LIEN", f"« {m.group(0).strip()} » écrit en dur (texte « {extrait}… ») : utiliser une référence [[…]]"))
    return out


def termes(rapport: Rapport, interdits: list[str]) -> list[Anomalie]:
    textes = [e.texte for e in rapport.elements if isinstance(e, Titre)] + textes_libres(rapport)
    textes += [t for e in rapport.numerotes() for t in (e.titre, e.source, e.note_base, getattr(e, "legende", ""))]
    textes += [rapport.source_etude, *rapport.sources_affichees.values()]
    textes.append(rapport.titre)
    cles = [_cle(t) for t in textes]
    out = []
    for terme in interdits:
        motif = re.compile(rf"\b{re.escape(_cle(terme))}\b")
        if any(motif.search(c) for c in cles):
            out.append(Anomalie("TERME_ETRANGER", f"terme étranger au projet : « {terme} »"))
    return out


def encodage(rapport: Rapport) -> list[Anomalie]:
    textes = [rapport.titre, rapport.note_base] + [e.texte for e in rapport.elements if isinstance(e, Titre)] + textes_libres(rapport)
    textes += [t for e in rapport.numerotes() for t in (e.titre, e.source, e.note_base)]
    textes += [rapport.source_etude, *rapport.sources_affichees.values()]
    return [Anomalie("ENCODAGE", f"texte abîmé : « {t[:60]} »") for t in textes if _CASSE.search(t)]


def sections(rapport: Rapport) -> list[Anomalie]:
    roles = [(i, e.role) for i, e in enumerate(rapport.elements) if isinstance(e, Titre) and e.role]
    noms = [r for _, r in roles]
    out = []
    for attendu in ("conclusions", "recommandations"):
        if noms.count(attendu) != 1:
            out.append(Anomalie("SECTIONS_CONCLUSIONS", f"section « {attendu} » : {noms.count(attendu)} au lieu d'une"))
    if out:
        return out
    debut = next(i for i, r in roles if r == "conclusions")
    niveau = next(e.niveau for e in rapport.elements if isinstance(e, Titre) and e.role == "conclusions")
    for e in rapport.elements[debut + 1:]:
        if isinstance(e, Titre) and e.niveau <= niveau:
            break
        if isinstance(e, Paragraphe) and any(f in _cle(e.texte) for f in RECOMMANDATION):
            out.append(Anomalie("RECOMMANDATION_DANS_CONCLUSIONS", f"formule de recommandation dans les conclusions : « {e.texte[:60]}… »",
                                bloquante=False))
    return out


def controler(rapport: Rapport, jeux: dict[str, JeuDonnees] | JeuDonnees, interdits: list[str]) -> list[Anomalie]:
    """Tous les contrôles ; le rapport n'est exportable que si aucune anomalie n'est bloquante. `jeux` : les bases du
    projet ({"analyse": …, "collecte": …}) ; un jeu seul vaut base d'analyse."""
    bases_projet = jeux if isinstance(jeux, dict) else {"analyse": jeux}
    etapes: list[Callable[[], list[Anomalie]]] = [
        lambda: numerotation(rapport), lambda: renvois(rapport), lambda: legendes(rapport), lambda: bases(rapport, bases_projet),
        lambda: completude(rapport), lambda: chiffres(rapport), lambda: termes(rapport, interdits), lambda: encodage(rapport), lambda: sections(rapport)]
    return [a for f in etapes for a in f()]


def bloquantes(anomalies: list[Anomalie]) -> list[Anomalie]:
    return [a for a in anomalies if a.bloquante]


__all__ = ["Anomalie", "ElementNumerote", "bloquantes", "controler"]
