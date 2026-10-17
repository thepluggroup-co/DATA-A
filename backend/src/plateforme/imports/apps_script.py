"""Import d'un dictionnaire défini dans un script Apps Script EDM (V3 à V11).

Le script est exécuté sous Node par `oracle_apps_script.js`, sans aucun service
Google ; on lit ses constantes (ITEMS, EN, IDENT, ZONES, QUOTAS) et ses colonnes
de masque. Le même oracle sert de référence aux tests de conformité.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

from plateforme.dictionnaire.modele import (
    Autre,
    Dictionnaire,
    LigneGrille,
    Modalite,
    Question,
    QuestionIdentification,
    RoleIdentification,
    Section,
    TypeQuestion,
)
from plateforme.generateurs.masque import Ville
from plateforme.noyau.textes import cle, numero_question, retirer_numero

ORACLE = Path(__file__).with_name("oracle_apps_script.js")

TYPES = {"radio": TypeQuestion.CHOIX_UNIQUE, "multi": TypeQuestion.CHOIX_MULTIPLE,
         "grille": TypeQuestion.GRILLE, "text": TypeQuestion.TEXTE}
ROLES_IDENT = {"enq": RoleIdentification.ENQUETEUR, "accord": RoleIdentification.ACCORD_RECONTACT,
               "site": RoleIdentification.SITE, "quartier": RoleIdentification.QUARTIER,
               "tel": RoleIdentification.TELEPHONE, "mail": RoleIdentification.EMAIL, "nom": RoleIdentification.NOM}


class OracleIndisponible(RuntimeError):
    """Node est absent ou le script n'a pas pu être exécuté."""


def executer_oracle(script_gs: str | Path) -> dict[str, Any]:
    """Exécute le script sous Node et renvoie ses constantes et `colonnesMasque_()` en JSON."""
    node = shutil.which("node")
    if node is None:
        raise OracleIndisponible("Node.js est introuvable : il est nécessaire pour lire un script Apps Script")
    res = subprocess.run([node, str(ORACLE), str(script_gs)], capture_output=True, check=False)
    if res.returncode != 0:
        raise OracleIndisponible(f"échec de l'exécution de {script_gs} : {res.stderr.decode('utf-8', 'replace')[:500]}")
    donnees: dict[str, Any] = json.loads(res.stdout.decode("utf-8"))
    return donnees


def _id_section(libelle: str) -> str:
    m = re.match(r"^\s*(\d+)", libelle)
    return f"S{m.group(1)}" if m else "S_" + cle(libelle)[:20]


def villes(oracle: dict[str, Any]) -> list[Ville]:
    return [Ville(z["code"], z["id"], z["libelle"], z["prefixe"]) for z in oracle.get("ZONES") or []]


def vers_dictionnaire(oracle: dict[str, Any], etude: str, version: str, source: str) -> Dictionnaire:
    """Convertit les constantes d'un script Apps Script en Dictionnaire."""
    en: dict[str, Any] = oracle.get("EN") or {}
    en_q: dict[str, Any] = en.get("q") or {}
    en_sections: dict[str, str] = en.get("sections") or {}
    en_aides = {cle(k): v for k, v in (en.get("aides") or {}).items()}
    langues = ["fr", "en"] if en else ["fr"]
    noms_villes = {cle(z["libelle"]) for z in oracle.get("ZONES") or []}

    def textes(fr: str, anglais: str | None) -> dict[str, str]:
        return {"fr": fr, "en": anglais} if anglais else {"fr": fr}

    sections: list[Section] = []
    questions: list[Question] = []
    for it in oracle["ITEMS"]:
        n = it.get("n") or numero_question(it["q"])
        if n is None:
            raise ValueError(f"numéro de question introuvable : {it['q']}")
        e = en_q.get(str(n)) or {}
        if not any(s.id == _id_section(it["section"]) for s in sections):
            sections.append(Section(id=_id_section(it["section"]), libelles=textes(it["section"], en_sections.get(it["section"]))))
        type_q = TYPES[it["type"]]
        libelle_fr = retirer_numero(it["q"])
        libelle_en = retirer_numero(e["q"]) if e.get("q") else None
        if type_q is TypeQuestion.CHOIX_MULTIPLE:
            libelle_fr = re.sub(r"\s*\(plusieurs réponses\)\s*$", "", libelle_fr)
            libelle_en = re.sub(r"\s*\(several answers\)\s*$", "", libelle_en) if libelle_en else None
        choix_en: list[str] = e.get("c") or []
        alias: dict[int, list[str]] = {}
        for texte, code in (it.get("alias") or {}).items():
            alias.setdefault(code, []).append(texte)
        if type_q is TypeQuestion.CHOIX_MULTIPLE:
            modalites = [Modalite(code=1 + i, libelles=textes(s[1], choix_en[i] if i < len(choix_en) else None), variable=s[0])
                         for i, s in enumerate(it["sousItems"])]
        else:
            modalites = [Modalite(code=c[0], libelles=textes(c[1], choix_en[i] if i < len(choix_en) else None),
                                  alias=alias.get(c[0], []))
                         for i, c in enumerate(it.get("choix") or [])]
        lignes_en: list[str] = e.get("l") or []
        lignes = [LigneGrille(variable=li[0], libelles=textes(li[1], lignes_en[i] if i < len(lignes_en) else None))
                  for i, li in enumerate(it.get("lignes") or [])]
        autre = None
        if it.get("autre"):
            a = it["autre"]
            autre = Autre(code=a["code"], libelles=textes(a["libelle"], "Other" if en else None), variable=a["variable"])
        aide = {}
        if it.get("aide"):
            aide = textes(it["aide"], en_aides.get(cle(it["aide"])))
        prerempli = None
        if type_q is TypeQuestion.CHOIX_UNIQUE and noms_villes and {cle(c[1]) for c in it["choix"]} == noms_villes:
            prerempli = "ville"
        questions.append(Question(
            numero=n, code=it["code"], section=_id_section(it["section"]),
            libelles=textes(libelle_fr, libelle_en), type=type_q,
            mesure=it.get("mesure") if type_q in (TypeQuestion.CHOIX_UNIQUE, TypeQuestion.GRILLE) else None,
            obligatoire=type_q is not TypeQuestion.TEXTE, aide=aide, modalites=modalites, autre=autre, lignes=lignes,
            role="cible" if n == 1 and oracle.get("QUOTAS") else None, prerempli=prerempli))

    en_ident: dict[str, str] = en.get("ident") or {}
    identification = [
        QuestionIdentification(
            role=ROLES_IDENT[d["champ"]], libelles=textes(d["titre"], en_ident.get(d["champ"])),
            type=TypeQuestion.CHOIX_UNIQUE if d["champ"] in ("enq", "accord") else TypeQuestion.TEXTE,
            obligatoire=d["champ"] != "mail", donnee_personnelle=d["champ"] in ("nom", "tel", "mail"))
        for d in oracle.get("IDENT") or []
    ]
    titre = {"en": en["titre"]} if en.get("titre") else {}
    return Dictionnaire(etude=etude, version=version, langues=langues, titre=titre, source=source,
                        sections=sections, identification=identification, questions=questions)
