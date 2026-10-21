"""Copilote DATA'A local : routage borné vers des outils métier en lecture seule, avec preuves."""

from __future__ import annotations

import json
import os
import re
import unicodedata
from typing import Any
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import ProxyHandler, Request, build_opener

from plateforme.analyse.donnees import JeuDonnees

OUTILS = ("etat_etude", "suivi_quotas", "tri_plat", "synthese", "aide")
_SYSTEME_LLM = (
    "Tu es le rédacteur du copilote DATA'A. Rédige en français, de façon claire et concise. "
    "Utilise exclusivement les faits et preuves du JSON fourni. N'invente aucun nombre, source, "
    "conclusion ou recommandation. Les éléments absents sont inconnus. Ne révèle pas les catégories "
    "masquées et ne tente pas d'identifier des personnes. Retourne uniquement un objet JSON avec une "
    "clé 'reponse' contenant le texte rédigé. Tu ne peux appeler aucun outil ni modifier de données."
)


def normaliser(texte: str) -> str:
    return " ".join(unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode().lower().split())


def classer(question: str) -> str:
    q = normaliser(question)
    mots = set(re.findall(r"[a-z0-9]+", q))
    if mots & {"quota", "quotas", "cible", "cibles", "ville", "terrain", "collecte"}:
        return "suivi_quotas"
    if mots & {"redige", "redaction", "conclusion", "recommandation", "recommandations", "priorite", "priorites", "commentaire", "synthese"}:
        return "synthese"
    if mots & {"frequence", "repartition", "modalite", "modalites", "tri", "plat", "profil", "pourcentage"}:
        return "tri_plat"
    if mots & {"etat", "statut", "avancement", "synthese", "resume", "validations", "validation"}:
        return "etat_etude"
    return "aide"


def _preuve(source: str, valeur: Any) -> dict[str, str]:
    return {"source": source, "valeur": str(valeur)}


def repondre(question: str, *, code: str | None = None, statut: str = "", analyses: list[dict[str, Any]] | None = None,
             recommandations: list[dict[str, Any]] | None = None, suivi: dict[str, Any] | None = None,
             jeu: JeuDonnees | None = None, variables: list[dict[str, Any]] | None = None,
             base_min: int = 30, seuil_k: int = 5, outil_force: str | None = None) -> dict[str, Any]:
    """Exécute seulement les outils déclarés, sans modèle externe ni action avec effet de bord."""
    outil = outil_force if outil_force in OUTILS else classer(question)
    analyses = analyses or []
    recommandations = recommandations or []
    preuves: list[dict[str, str]] = []
    limites = ["Réponse fondée sur les données et preuves disponibles dans DATA'A."]

    if outil in {"etat_etude", "synthese"}:
        validees = [x for x in analyses if x.get("statut") == "validee"]
        en_attente = [x for x in analyses if x.get("statut") in {"brouillon", "a_valider"}]
        actions = [x for x in recommandations if x.get("statut") == "validee"]
        preuves += [_preuve("projet.statut", statut or "non renseigné"),
                    _preuve("analyses.validées", len(validees)), _preuve("analyses.en_attente", len(en_attente)),
                    _preuve("recommandations.validées", len(actions))]
        for i, action in enumerate(actions[:8], start=1):
            preuves.append(_preuve(f"recommandation.validée.{i}", {
                "constat": action.get("constat", ""), "preuve": action.get("preuve", ""),
                "action": action.get("action", ""), "risque": action.get("risque", ""),
            }))
        if outil == "synthese":
            if suivi:
                preuves.append(_preuve("suivi.total", f"{suivi.get('total_realise', 0)}/{suivi.get('total_quota', 0)}"))
                preuves.extend(_preuve(f"quota.{x['cible']}.{x['ville']}", f"{x['realise']}/{x['quota']}")
                               for x in suivi.get("lignes", [])[:12])
            reponse = (f"Synthèse factuelle de {code or 'l’étude'} : statut {statut or 'non renseigné'}, "
                       f"{len(validees)} analyse(s) validée(s), {len(en_attente)} en attente et "
                       f"{len(actions)} recommandation(s) validée(s).")
            if actions:
                reponse += " Les constats, preuves, actions et risques validés sont joints aux sources."
            if suivi:
                reponse += f" Quotas : {suivi.get('total_realise', 0)}/{suivi.get('total_quota', 0)} fiches."
            limites.append("La synthèse ne reprend que les recommandations validées et les agrégats disponibles.")
            return {"outil": outil, "reponse": reponse, "preuves": preuves, "limites": limites}
        reponse = (f"Étude {code or 'sélectionnée'} : statut {statut or 'non renseigné'}, {len(validees)} analyse(s) validée(s), "
                   f"{len(en_attente)} en attente et {len(actions)} recommandation(s) validée(s).")
        if en_attente:
            noms = [str(x.get("titre") or x.get("methode") or "analyse sans titre") for x in en_attente[:5]]
            reponse += " À traiter : " + "; ".join(noms) + "."
        return {"outil": outil, "reponse": reponse, "preuves": preuves, "limites": limites}

    if outil == "suivi_quotas":
        if suivi is None:
            return {"outil": outil, "reponse": "Le suivi cible × ville n'est pas disponible : la base d'analyse ou le plan manque.",
                    "preuves": [], "limites": limites}
        lignes = suivi.get("lignes", [])
        realises, prevus = int(suivi.get("total_realise", 0)), int(suivi.get("total_quota", 0))
        preuves.append(_preuve("suivi.total", f"{realises}/{prevus}"))
        detail = [f"{x['cible']} · {x['ville']} : {x['realise']}/{x['quota']}" for x in lignes[:12]]
        reponse = f"Suivi des quotas : {realises} fiches réalisées sur {prevus} prévues. " + (" ; ".join(detail) if detail else "Aucun quota déclaré.")
        if len(lignes) > 12:
            reponse += f" ; et {len(lignes) - 12} autre(s) cellule(s)."
        preuves += [_preuve(f"quota.{x['cible']}.{x['ville']}", f"{x['realise']}/{x['quota']}") for x in lignes[:12]]
        return {"outil": outil, "reponse": reponse, "preuves": preuves, "limites": limites}

    if outil == "tri_plat":
        choix = variables or []
        if jeu is None:
            return {"outil": outil, "reponse": "Aucune base d'analyse n'est livrée pour calculer un tri à plat.",
                    "preuves": [], "limites": limites}
        q = normaliser(question)
        candidats = [v for v in choix if normaliser(str(v.get("libelle", ""))) in q or
                     str(v.get("nom", "")).lower() in q]
        if len(candidats) != 1:
            disponibles = ", ".join(str(v.get("libelle") or v.get("nom")) for v in choix[:10])
            message = ("Je n'identifie pas une variable unique. Précise son libellé. Variables disponibles : " + disponibles
                       if disponibles else "Aucune variable catégorielle exportable n'est disponible.")
            return {"outil": outil, "reponse": message, "preuves": [], "limites": limites}
        variable = str(candidats[0]["nom"])
        valeurs = jeu.valides(variable).dropna()
        base = len(valeurs)
        if base < base_min:
            return {"outil": outil, "reponse": f"Tri non affiché : base valide {base}, inférieure au seuil de {base_min}.",
                    "preuves": [_preuve(f"base.{variable}", base)], "limites": [*limites, "Seuil minimal de base appliqué."]}
        comptes = valeurs.value_counts(dropna=True)
        if not len(comptes):
            return {"outil": outil, "reponse": "Aucune réponse valide pour cette variable.", "preuves": [], "limites": limites}
        lignes = []
        masque = 0
        for code_modalite, effectif in comptes.items():
            n = int(effectif)
            if n < seuil_k:
                masque += n
                continue
            libelle = jeu.libelle(variable, float(str(code_modalite)))
            lignes.append(f"{libelle} : {n} ({100 * n / base:.1f} %)")
        if masque:
            lignes.append(f"{masque} réponse(s) dans des modalités masquées (< {seuil_k})")
        preuves = [_preuve(f"base.{variable}", base), _preuve("seuil_k", seuil_k)]
        preuves += [_preuve(f"modalité.{variable}", ligne) for ligne in lignes]
        reponse = f"Tri à plat de {candidats[0].get('libelle') or variable} (base valide {base}) : " + "; ".join(lignes)
        limite_modalites = f"Les modalités d'effectif inférieur à {seuil_k} sont regroupées pour protéger la confidentialité."
        return {"outil": outil, "reponse": reponse, "preuves": preuves,
            "limites": [*limites, limite_modalites] if masque else limites}

    return {"outil": outil,
            "reponse": "Je peux résumer l'état d'une étude, suivre les quotas par cible et ville, ou calculer un tri à plat. "
                       "Exemples : « Résume l'état de l'étude », « Où en sont les quotas par ville ? », "
                       "« Donne la fréquence de [libellé de variable] ». ",
            "preuves": [], "limites": limites}


def rediger_localement(question: str, faits: dict[str, Any]) -> str | None:
    """Rédige les faits agrégés via Ollama sur loopback. Aucun modèle cloud n'est appelé."""
    modele = os.environ.get("DATAA_OLLAMA_MODEL", "").strip()
    if not modele:
        return None
    url = os.environ.get("DATAA_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    analyse = urlparse(url)
    if analyse.scheme != "http" or analyse.hostname not in {"localhost", "127.0.0.1", "::1"}:
        return None
    try:
        delai = min(max(float(os.environ.get("DATAA_OLLAMA_TIMEOUT", "30")), 1), 120)
        corps = json.dumps({
            "model": modele,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0, "num_predict": 400},
            "messages": [
                {"role": "system", "content": _SYSTEME_LLM},
                {"role": "user", "content": json.dumps({"question": question, "faits": faits}, ensure_ascii=False)},
            ],
        }, ensure_ascii=False).encode("utf-8")
        requete = Request(f"{url}/api/chat", data=corps, headers={"Content-Type": "application/json"}, method="POST")
        with build_opener(ProxyHandler({})).open(requete, timeout=delai) as reponse:
            donnees = json.loads(reponse.read(1_000_000))
        contenu = donnees.get("message", {}).get("content", "")
        resultat = json.loads(contenu) if isinstance(contenu, str) else {}
        texte = resultat.get("reponse", "") if isinstance(resultat, dict) else ""
        if not isinstance(texte, str) or not texte.strip() or len(texte) > 5000:
            return None
        nombres_reponse = set(re.findall(r"(?<!\w)\d+(?:[.,]\d+)?", texte))
        nombres_faits = set(re.findall(r"(?<!\w)\d+(?:[.,]\d+)?", json.dumps(faits, ensure_ascii=False)))
        if not nombres_reponse <= nombres_faits:
            return None
        return texte.strip()
    except (OSError, ValueError, TypeError, KeyError, URLError):
        return None
