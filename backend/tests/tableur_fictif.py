"""Tableur de réponses FICTIF au format Google Forms (onglet « Form Responses 1 ») pour tester l'API sans données réelles.

Toutes les valeurs sont tirées au hasard : aucun chiffre produit à partir de ce fichier ne décrit l'étude réelle.
Les téléphones sont des numéros fictifs (600 000 xxx).
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from pathlib import Path

from openpyxl import Workbook

from plateforme.dictionnaire.modele import Dictionnaire, TypeQuestion
from plateforme.terrain.plan import PlanTerrain, Role


def ecrire(dico: Dictionnaire, terrain: PlanTerrain, chemin: Path, par_jour: int = 6, graine: int = 0) -> Path:
    rnd = random.Random(graine)
    ident = {i.role.value: i for i in dico.identification}
    entete: list[str] = ["Horodateur", *(ident[r].libelles["fr"] for r in ("enqueteur", "quartier", "telephone", "accord_recontact"))]
    for q in dico.questions:
        titre = dico.titre_question(q, "fr")
        if q.type is TypeQuestion.GRILLE:
            entete += [f"{titre} [{li.libelles['fr']}]" for li in q.lignes]
        else:
            entete.append(titre)
    libelles_villes = {v.id: v.libelle for v in terrain.villes}
    postes = [e for e in terrain.enqueteurs if e.role is Role.TITULAIRE and e.ville]
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Form Responses 1"
    ws.append(entete)
    n = 0
    for jour in terrain.jours:
        for e in postes:
            t = datetime(jour.year, jour.month, jour.day, 8, 30) + timedelta(minutes=rnd.randint(0, 40))
            for _ in range(par_jour):
                t += timedelta(minutes=rnd.choice([8, 12, 20, 35]))
                n += 1
                ligne: list[object] = [t, e.id, "Quartier fictif", f"600000{n:03d}", rnd.choice(["Oui", "Non"])]
                for q in dico.questions:
                    lib = [m.libelles["fr"] for m in q.modalites]
                    if q.prerempli == "ville":
                        ligne.append(libelles_villes[e.ville or ""])
                    elif q.type is TypeQuestion.CHOIX_UNIQUE:
                        ligne.append(rnd.choice(lib))
                    elif q.type is TypeQuestion.CHOIX_MULTIPLE:
                        ligne.append(", ".join(rnd.sample(lib, rnd.randint(1, min(3, len(lib))))))
                    elif q.type is TypeQuestion.GRILLE:
                        ligne += [rnd.choice(lib) for _ in q.lignes]
                    else:
                        ligne.append("")
                ws.append(ligne)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    wb.save(chemin)
    return chemin
