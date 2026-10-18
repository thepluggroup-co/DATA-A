"""API HTTP de la console « usine » (FastAPI) et service de l'interface web compilée (`frontend/dist`).

Lancement : `plateforme serveur` (écoute 127.0.0.1:8000 par défaut).
ATTENTION : pas encore d'authentification. À n'exposer que sur le poste de l'usine (127.0.0.1) tant que la
double authentification exigée par CLAUDE.md §8 n'est pas en place (phase 7).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

from plateforme.api import services

TAILLE_MAX = 50 * 1024 * 1024          # 50 Mo par fichier reçu
INTERFACE = Path(os.environ.get("PLATEFORME_INTERFACE", services.RACINE / "frontend" / "dist"))

app = FastAPI(title="[NOM_PRODUIT] — API de la console usine", version="0.1.0")


@app.exception_handler(services.ProjetIntrouvable)
async def _introuvable(_: Request, e: services.ProjetIntrouvable) -> JSONResponse:
    return JSONResponse({"detail": f"introuvable : {e}"}, status_code=404)


@app.exception_handler(ValueError)
async def _invalide(_: Request, e: ValueError) -> JSONResponse:
    # Couvre TableurInvalide, DecisionsInconnues, ModeleInvalide et les erreurs de validation des fichiers du projet.
    return JSONResponse({"detail": str(e)}, status_code=422)


async def _lire(f: UploadFile | None) -> bytes | None:
    if f is None:
        return None
    contenu = await f.read(TAILLE_MAX + 1)
    if len(contenu) > TAILLE_MAX:
        raise HTTPException(413, "fichier trop volumineux (50 Mo au plus)")
    return contenu


def _zip(contenu: bytes, nom: str) -> Response:
    return Response(contenu, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{nom}"'})


@app.get("/api/sante")
def sante() -> dict[str, Any]:
    return {"etat": "ok", "projets": str(services.dossier_projets()), "interface": INTERFACE.is_dir(), "authentification": False}


@app.get("/api/projets")
def lister() -> list[dict[str, Any]]:
    return services.projets()


@app.get("/api/projets/{projet}")
def resume(projet: str) -> dict[str, Any]:
    return services.resume(projet)


@app.get("/api/projets/{projet}/dictionnaire")
def dictionnaire(projet: str) -> dict[str, Any]:
    return services.dictionnaire(projet)


@app.get("/api/projets/{projet}/dictionnaire/diagnostic")
def diagnostic(projet: str) -> dict[str, Any]:
    return services.diagnostic_formulaire(projet)


@app.get("/api/projets/{projet}/dictionnaire/versions")
def versions(projet: str) -> list[str]:
    return services.versions(projet)


@app.get("/api/projets/{projet}/dictionnaire/diff")
def difference(projet: str, ancienne: str) -> dict[str, Any]:
    return services.difference(projet, ancienne)


@app.get("/api/projets/{projet}/dictionnaire/generations.zip")
def generations(projet: str) -> Response:
    return _zip(services.archive_generations(projet), f"{projet}_generations.zip")


@app.get("/api/projets/{projet}/terrain")
def terrain(projet: str) -> dict[str, Any]:
    return services.terrain(projet)


class DemandeLiens(BaseModel):
    modele: str
    enqueteur: str
    villes: list[str]


@app.post("/api/projets/{projet}/deploiement/liens")
def liens(projet: str, d: DemandeLiens) -> list[dict[str, Any]]:
    return services.liens(projet, d.modele, d.enqueteur, d.villes)


async def _reponses(projet: str, tableur: UploadFile, onglet: str, decisions: UploadFile | None) -> tuple[Any, Any]:
    dico, t, _ = services.charger(projet)
    contenu = await _lire(tableur)
    assert contenu is not None
    reps = services.lire_tableur(contenu, onglet, dico, t, tableur.filename or "tableur.xlsx")
    return reps, services.lire_decisions(await _lire(decisions))


Tableur = Annotated[UploadFile, File(description="export .xlsx du classeur de réponses Google Forms")]
Decisions = Annotated[UploadFile | None, File(description="YAML {N° de fiche: {statut, motif}}")]


@app.post("/api/projets/{projet}/suivi")
async def suivi(projet: str, tableur: Tableur, decisions: Decisions = None, onglet: Annotated[str, Form()] = "Form Responses 1",
                jour: Annotated[str | None, Form()] = None, maintenant: Annotated[str | None, Form()] = None,
                graine: Annotated[int, Form()] = 0) -> dict[str, Any]:
    reps, brutes = await _reponses(projet, tableur, onglet, decisions)
    return services.analyser(projet, reps, brutes, jour or None, maintenant or None, graine)


@app.post("/api/projets/{projet}/suivi/livrables.zip")
async def livrables(projet: str, tableur: Tableur, decisions: Decisions = None, onglet: Annotated[str, Form()] = "Form Responses 1",
                    jour: Annotated[str | None, Form()] = None, maintenant: Annotated[str | None, Form()] = None,
                    graine: Annotated[int, Form()] = 0) -> Response:
    reps, brutes = await _reponses(projet, tableur, onglet, decisions)
    return _zip(services.archive_suivi(projet, reps, brutes, jour or None, maintenant or None, graine), f"{projet}_suivi.zip")


@app.post("/api/projets/{projet}/base.zip")
async def base(projet: str, tableur: Tableur, decisions: Decisions = None,
               onglet: Annotated[str, Form()] = "Form Responses 1") -> Response:
    reps, brutes = await _reponses(projet, tableur, onglet, decisions)
    return _zip(services.archive_base(projet, reps, brutes), f"{projet}_base.zip")


# ---------------------------------------------------------------- interface web compilée (application à page unique)

@app.get("/{chemin:path}", include_in_schema=False)
def interface(chemin: str) -> Response:
    if chemin.startswith("api/"):
        raise HTTPException(404, "route d'API inconnue")
    if not INTERFACE.is_dir():
        return JSONResponse({"detail": "interface non compilée : lancer `npm run build` dans frontend/"}, status_code=404)
    racine = INTERFACE.resolve()
    cible = (racine / chemin).resolve()
    if chemin and cible.is_file() and cible.is_relative_to(racine):
        return FileResponse(cible)
    return FileResponse(racine / "index.html")
