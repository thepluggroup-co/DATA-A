"""Sécurité de l'authentification : mots de passe (Argon2id), jetons de session (seule leur empreinte est stockée),
jeton CSRF, double authentification TOTP (RFC 6238) pour l'usine, politique de mot de passe et verrouillage de compte."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta

import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# Le mode démonstration peut tourner dans un runner très contraint. Il utilise
# un coût réduit explicitement signalé par l'environnement ; la production
# conserve les paramètres Argon2id par défaut.
_HACHEUR = PasswordHasher(memory_cost=32768, time_cost=2, parallelism=1) if os.environ.get("DATAA_DEMO") == "1" else PasswordHasher()
LONGUEUR_MIN = 12
ECHECS_MAX = 5
DUREE_BLOCAGE = timedelta(minutes=15)
DUREE_SESSION = timedelta(hours=8)
# Alias historique conservé pour les routes existantes. Le vocabulaire produit est « cabinet ».
ROLES_CABINET = {"cabinet_admin", "cabinet_operateur", "consultant_junior", "consultant_senior", "expert_etude"}
ROLES_USINE = {"usine_admin", "usine_operateur"} | ROLES_CABINET
ROLES_CLIENT = {"client_admin", "client_lecteur"}
ROLES_ENQUETEUR = {"enqueteur"}

PERMISSIONS_PAR_ROLE: dict[str, frozenset[str]] = {
    "cabinet_admin": frozenset({"equipe.lire", "equipe.ecrire", "projet.piloter", "terrain.deployer", "analyse.valider", "facturation.gerer"}),
    "cabinet_operateur": frozenset({"equipe.lire", "projet.piloter", "terrain.deployer", "facturation.gerer"}),
    "consultant_junior": frozenset({"projet.lire", "terrain.superviser", "qualite.signaler"}),
    "consultant_senior": frozenset({"projet.lire", "terrain.superviser", "analyse.executer", "analyse.superviser", "qualite.valider"}),
    "expert_etude": frozenset({"projet.lire", "analyse.programmer", "analyse.valider", "recommandations.ecrire", "livraison.valider"}),
    "enqueteur": frozenset({"terrain.collecter", "formation.suivre"}),
    "usine_admin": frozenset({"equipe.lire", "equipe.ecrire", "projet.piloter", "terrain.deployer", "analyse.valider", "facturation.gerer"}),
    "usine_operateur": frozenset({"equipe.lire", "projet.piloter", "terrain.deployer", "facturation.gerer"}),
}

def permissions(role: str) -> frozenset[str]:
    return PERMISSIONS_PAR_ROLE.get(role, frozenset())


class MotDePasseFaible(ValueError):
    pass


def verifier_politique(mdp: str) -> None:
    """12 caractères au moins, avec lettres et chiffres."""
    if len(mdp) < LONGUEUR_MIN or not any(c.isdigit() for c in mdp) or not any(c.isalpha() for c in mdp):
        raise MotDePasseFaible(f"mot de passe trop faible : {LONGUEUR_MIN} caractères au moins, avec lettres et chiffres")


def hacher(mdp: str) -> str:
    verifier_politique(mdp)
    return _HACHEUR.hash(mdp)


def verifier(hache: str, mdp: str) -> bool:
    try:
        return _HACHEUR.verify(hache, mdp)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def jeton() -> str:
    return secrets.token_urlsafe(32)


def empreinte(valeur: str) -> str:
    return hashlib.sha256(valeur.encode("utf-8")).hexdigest()


def egaux(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def nouveau_secret_totp() -> str:
    return pyotp.random_base32()


def verifier_totp(secret: str, code: str) -> bool:
    """Code à 6 chiffres, tolérance d'une période de 30 s (décalage d'horloge du téléphone)."""
    return bool(code.isdigit() and len(code) == 6 and pyotp.TOTP(secret).verify(code, valid_window=1))


def uri_totp(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="DATA'A")


def maintenant() -> datetime:
    return datetime.now(UTC)


def expiration() -> datetime:
    return maintenant() + DUREE_SESSION
