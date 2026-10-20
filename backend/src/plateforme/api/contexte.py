"""Configuration, accès à la base par contexte (RLS) et utilisateur courant."""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, Request
from sqlalchemy import Engine, select, text
from sqlalchemy.orm import Session, sessionmaker

from plateforme.api import securite
from plateforme.stockage.connexion import fabrique_sessions, moteur
from plateforme.stockage.modeles import Organisation, SessionWeb, Utilisateur

COOKIE = "dataa_session"


@dataclass(frozen=True)
class Config:
    bd_url: str                      # rôle applicatif plateforme_app (soumis à la RLS), jamais le propriétaire
    stockage: Path                   # projets, bases d'analyse, livrables (un dossier par organisation)
    web: Path | None = None          # front-end construit (web/dist), servi à la racine
    cookie_securise: bool = True     # False uniquement en développement local (http)
    tarifs_usine: Path | None = None  # tarifs par défaut de la pré-estimation des briefs
    referentiel: Path | None = None   # reference/geo/<PAYS>

    @staticmethod
    def depuis_env() -> Config:
        web = os.environ.get("DATAA_WEB")
        return Config(bd_url=os.environ["DATAA_BD_URL"], stockage=Path(os.environ["DATAA_STOCKAGE"]),
                      web=Path(web) if web else None, cookie_securise=os.environ.get("DATAA_COOKIE_SECURISE", "1") != "0",
                      tarifs_usine=Path(os.environ["DATAA_TARIFS"]) if os.environ.get("DATAA_TARIFS") else None,
                      referentiel=Path(os.environ["DATAA_REFERENTIEL"]) if os.environ.get("DATAA_REFERENTIEL") else None)


@dataclass(frozen=True)
class Courant:
    utilisateur: Utilisateur
    organisation: Organisation
    session: SessionWeb

    @property
    def usine(self) -> bool:
        return self.utilisateur.role in securite.ROLES_USINE and self.session.second_facteur


class Etat:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.moteur: Engine = moteur(cfg.bd_url)
        self.sessions: sessionmaker[Session] = fabrique_sessions(self.moteur)


def etat(request: Request) -> Etat:
    e: Etat = request.app.state.dataa
    return e


def bd_auth(request: Request) -> Iterator[Session]:
    """Session sans contexte client : tables d'authentification et organisations (hors RLS)."""
    with etat(request).sessions() as s, s.begin():
        yield s


def courant(request: Request) -> Courant:
    jeton = request.cookies.get(COOKIE)
    if not jeton:
        raise HTTPException(401, "non connecté")
    with etat(request).sessions() as s:
        sw = s.get(SessionWeb, securite.empreinte(jeton))
        if sw is None or sw.expire_le < securite.maintenant():
            raise HTTPException(401, "session expirée")
        u = s.get(Utilisateur, sw.utilisateur_id)
        if u is None or not u.actif:
            raise HTTPException(401, "compte inactif")
        o = s.get(Organisation, u.organisation_id)
        assert o is not None
        return Courant(u, o, sw)


def exiger_complet(c: Courant) -> Courant:
    """Usine : second facteur obligatoire avant tout accès (CLAUDE.md §8)."""
    if c.utilisateur.role in securite.ROLES_USINE and not c.session.second_facteur:
        raise HTTPException(401, "double authentification requise")
    return c


def bd_contexte(request: Request, c: Courant) -> Iterator[Session]:
    """Session soumise à la RLS : l'organisation du client, ou l'usine authentifiée à deux facteurs."""
    with etat(request).sessions() as s, s.begin():
        s.execute(text("SELECT set_config('app.organisation_id', :o, true), set_config('app.usine', :u, true)"),
                  {"o": str(c.organisation.id), "u": "oui" if c.usine else "non"})
        yield s


def chemin_sur(cfg: Config, relatif: str) -> Path:
    """Chemin d'un fichier du stockage ; refuse toute sortie du dossier (« .. », chemin absolu ailleurs)."""
    racine = cfg.stockage.resolve()
    p = (racine / relatif).resolve()
    if racine != p and racine not in p.parents:
        raise HTTPException(400, "chemin refusé")
    return p


def utilisateur_par_email(s: Session, email: str) -> Utilisateur | None:
    return s.scalar(select(Utilisateur).where(Utilisateur.email == email.strip().lower()))


def uuid_ou_404(valeur: str) -> uuid.UUID:
    try:
        return uuid.UUID(valeur)
    except ValueError:
        raise HTTPException(404, "introuvable") from None
