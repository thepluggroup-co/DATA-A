"""Connexion à la base et migrations (Alembic) appliquées par le code."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

RACINE_BACKEND = Path(__file__).resolve().parents[3]


def moteur(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


def fabrique_sessions(m: Engine) -> sessionmaker[Session]:
    return sessionmaker(m, expire_on_commit=False)


def migrer(url: str, cible: str = "head") -> None:
    """Applique les migrations Alembic jusqu'à `cible` (sans danger si déjà à jour)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(RACINE_BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(RACINE_BACKEND / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    command.upgrade(cfg, cible)
