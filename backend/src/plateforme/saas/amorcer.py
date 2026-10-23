"""Amorçage d'une base DATA'A migrée et vide (Supabase, Railway…) : à lancer UNE FOIS, après `alembic upgrade head`.

Fait trois choses, avec le rôle PROPRIÉTAIRE (celui des migrations, hors RLS) :
  1. donne un mot de passe et le droit de connexion au rôle applicatif `plateforme_app` (créé NOLOGIN par la migration 0003) ;
  2. crée l'organisation « usine » et le premier compte `usine_admin`, avec un secret de double authentification (TOTP) ;
  3. retire aux rôles de l'API publique Supabase (anon, authenticated, service_role), s'ils existent, tout droit sur les
     tables du schéma public : `utilisateur` contient les empreintes de mots de passe ET les secrets TOTP.

    $env:PLATEFORME_BASE_URL = 'postgresql+psycopg://postgres.<ref>:<mot-de-passe>@<hote-pooler>:5432/postgres'
    uv run python -m plateforme.saas.amorcer

Les mots de passe sont demandés au clavier : jamais dans un fichier, jamais dans l'historique de la console.
Le script est rejouable : un compte déjà présent n'est pas modifié ; le mot de passe du rôle applicatif est, lui, renouvelé.
"""

from __future__ import annotations

import os
import secrets
import sys
from getpass import getpass

import pyotp
from psycopg import sql
from sqlalchemy import select, text
from sqlalchemy.engine import make_url

from plateforme.api import audit, securite
from plateforme.stockage.connexion import fabrique_sessions, moteur
from plateforme.stockage.modeles import Organisation, Utilisateur

ROLES_API_SUPABASE = ("anon", "authenticated", "service_role")
NOM_ORGANISATION_USINE = "THE PLUG — usine"


def _demander_mot_de_passe() -> str:
    while True:
        mdp = getpass("Mot de passe du compte usine (12 caractères au moins, lettres et chiffres) : ")
        try:
            securite.verifier_politique(mdp)
        except securite.MotDePasseFaible as e:
            print(f"  {e}")
            continue
        if getpass("Confirmer le mot de passe : ") != mdp:
            print("  Les deux saisies diffèrent, recommencez.")
            continue
        return mdp


def _role_applicatif(m_url: str, mdp_app: str) -> None:
    m = moteur(m_url)
    raw = m.raw_connection()
    try:
        cur = raw.cursor()
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = 'plateforme_app'")
        if cur.fetchone() is None:
            sys.exit("Le rôle plateforme_app n'existe pas : lancez d'abord `alembic upgrade head`.")
        cur.execute(sql.SQL("ALTER ROLE plateforme_app LOGIN PASSWORD {}").format(sql.Literal(mdp_app)))
        raw.commit()
    finally:
        raw.close()
        m.dispose()


def _creer_compte_usine(m_url: str, email: str, nom: str, mdp: str, secret_totp: str) -> bool:
    m = moteur(m_url)
    try:
        with fabrique_sessions(m)() as s, s.begin():
            if s.scalar(select(Utilisateur).where(Utilisateur.email == email)) is not None:
                return False
            org = s.scalar(select(Organisation).where(Organisation.nom == NOM_ORGANISATION_USINE))
            if org is None:
                org = Organisation(nom=NOM_ORGANISATION_USINE, type="usine")
                s.add(org)
                s.flush()
            u = Utilisateur(organisation_id=org.id, email=email, nom=nom, role="usine_admin", hash_mdp=securite.hacher(mdp),
                            totp_secret=secret_totp)
            s.add(u)
            s.flush()
            audit.journaliser(s, "admin_initial_cree", email, organisation_id=org.id, utilisateur_id=u.id)
            return True
    finally:
        m.dispose()


def _verrouiller_api_publique(m_url: str) -> list[str]:
    """Retire les droits des rôles de l'API Supabase sur le schéma public ; renvoie les messages (réussites et échecs)."""
    messages: list[str] = []
    m = moteur(m_url)
    try:
        with m.connect() as c:
            presents = [r for r in ROLES_API_SUPABASE
                        if c.execute(text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {"r": r}).first() is not None]
        for r in presents:
            for requete in (f'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "{r}"',
                            f'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "{r}"',
                            f'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM "{r}"',
                            f'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM "{r}"',
                            f'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM "{r}"',
                            f'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM "{r}"'):
                try:
                    with m.begin() as c:
                        c.execute(text(requete))
                except Exception as e:  # noqa: BLE001 : on continue et on le dit
                    messages.append(f"ÉCHEC  {requete}  ->  {str(e).splitlines()[0]}")
        with m.connect() as c:
            reste = c.execute(text("SELECT count(*) FROM information_schema.role_table_grants "
                                   "WHERE table_schema = 'public' AND grantee = ANY(:g)"), {"g": list(ROLES_API_SUPABASE)}).scalar_one()
        if not presents:
            messages.append("Aucun rôle anon / authenticated / service_role dans cette base : rien à verrouiller (normal hors Supabase).")
        else:
            messages.append(f"Rôles traités : {', '.join(presents)}. Droits restants sur les tables du schéma public : {reste} "
                            f"({'OK' if reste == 0 else 'À VÉRIFIER'}).")
    finally:
        m.dispose()
    return messages


def main() -> None:
    url = os.environ.get("PLATEFORME_BASE_URL")
    if not url:
        sys.exit("PLATEFORME_BASE_URL n'est pas définie (URL du rôle propriétaire, postgresql+psycopg://…).")
    email = input("E-mail du compte usine : ").strip().lower()
    nom = input("Nom affiché [Administrateur usine] : ").strip() or "Administrateur usine"
    if "@" not in email:
        sys.exit("E-mail invalide.")
    mdp = _demander_mot_de_passe()

    mdp_app = secrets.token_urlsafe(24)       # alphabet sûr dans une URL (lettres, chiffres, - et _)
    secret_totp = pyotp.random_base32()

    _role_applicatif(url, mdp_app)
    cree = _creer_compte_usine(url, email, nom, mdp, secret_totp)
    messages = _verrouiller_api_publique(url)

    u = make_url(url)
    suffixe = u.username.split(".", 1)[1] if u.username and "." in u.username else None     # pooler Supabase : utilisateur.<ref-projet>
    url_app = u.set(username=f"plateforme_app.{suffixe}" if suffixe else "plateforme_app", password=mdp_app)

    print("\n" + "=" * 78)
    print("1) À COPIER MAINTENANT dans Railway (variable DATAA_BD_URL) — affiché une seule fois :\n")
    print(f"   {url_app.render_as_string(hide_password=False)}\n")
    if cree:
        print("2) Double authentification du compte usine (obligatoire pour se connecter) :")
        print("   Application d'authentification -> ajouter un compte -> saisie manuelle de la clé, type « basé sur le temps ».")
        print(f"   Clé : {secret_totp}")
        print(f"   URI : {securite.uri_totp(secret_totp, email)}")
        try:
            import qrcode
            q = qrcode.QRCode(border=1)
            q.add_data(securite.uri_totp(secret_totp, email))
            q.print_ascii(invert=True)
        except Exception:  # noqa: BLE001 : le QR est un confort, la clé suffit
            pass
        print(f"\n   Compte créé : {email} (rôle usine_admin).")
    else:
        print(f"2) Le compte {email} existe déjà : mot de passe et double authentification NON modifiés.")
    print("\n3) Verrouillage de l'API publique Supabase :")
    for ligne in messages:
        print(f"   {ligne}")
    print("=" * 78)
    print("Fermez ensuite cette fenêtre (elle affiche des secrets) et ne les collez dans aucun message ni fichier.")


if __name__ == "__main__":
    main()
