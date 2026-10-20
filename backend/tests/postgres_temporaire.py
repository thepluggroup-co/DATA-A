"""Compatibilité : le serveur PostgreSQL temporaire vit dans le paquet (plateforme/outils), pour servir aussi au serveur
de démonstration et aux tests de bout en bout du front-end."""

from plateforme.outils.postgres_temporaire import dossier_binaires, serveur

__all__ = ["dossier_binaires", "serveur"]
