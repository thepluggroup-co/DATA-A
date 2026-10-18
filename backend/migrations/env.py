"""Environnement Alembic : l'URL de la base vient de PLATEFORME_BASE_URL ou de la configuration passée par le code."""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy import create_engine

from plateforme.stockage.modeles import Base

config = context.config
url = config.get_main_option("sqlalchemy.url") or os.environ.get("PLATEFORME_BASE_URL")
if not url:
    raise RuntimeError("PLATEFORME_BASE_URL n'est pas définie (ex. postgresql+psycopg://utilisateur@localhost:5432/plateforme)")


def executer() -> None:
    moteur = create_engine(url)
    with moteur.connect() as connexion:
        context.configure(connection=connexion, target_metadata=Base.metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


executer()
