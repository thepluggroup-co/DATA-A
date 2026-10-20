"""Phase 7 (SaaS) : utilisateurs, sessions, journal d'audit chaîné et inaltérable, formules, abonnements, factures,
paiements, livrables, journal des croisements ; Row-Level Security FORCÉ sur toutes les tables des clients.

Isolation : l'application se connecte avec le rôle `plateforme_app` (ni propriétaire ni superutilisateur) et fixe, par
transaction, `app.organisation_id` (session client) ou `app.usine = 'oui'` (session usine authentifiée à deux facteurs).
Une requête qui oublierait son filtre ne voit donc jamais les lignes d'un autre client. Les tables d'authentification
(utilisateur, session_web) et le catalogue des formules restent hors RLS : elles ne sont lues que par le module
d'authentification.

Révision : 0003
Précédente : 0002
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

TABLES_CLIENTS = ["projet", "reponse_brute", "numero_fiche", "fiche_codee", "decision_qc", "contact", "journal_sync",
                  "abonnement", "facture", "paiement", "croisement", "livrable"]


def _le(nom: str = "cree_le") -> sa.Column[object]:
    return sa.Column(nom, sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    jsonb = postgresql.JSONB()
    org = lambda: sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True)  # noqa: E731
    op.add_column("organisation", sa.Column("type", sa.String(10), nullable=False, server_default="client"))   # client | usine
    op.add_column("projet", sa.Column("statut", sa.String(30), nullable=False, server_default="brief"))
    op.add_column("projet", sa.Column("dossier", sa.Text(), nullable=False, server_default=""))
    op.add_column("projet", sa.Column("base_analyse", sa.Text(), nullable=False, server_default=""))
    op.add_column("projet", sa.Column("parametres", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.create_table("utilisateur",
                    sa.Column("id", uuid, primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("email", sa.String(254), nullable=False, unique=True),
                    sa.Column("nom", sa.String(200), nullable=False),
                    sa.Column("role", sa.String(30), nullable=False),
                    sa.Column("hash_mdp", sa.Text(), nullable=False),
                    sa.Column("totp_secret", sa.String(64), nullable=True),
                    sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
                    sa.Column("echecs", sa.Integer(), nullable=False, server_default="0"),
                    sa.Column("bloque_jusqu", sa.DateTime(timezone=True), nullable=True),
                    _le())
    op.create_table("session_web",
                    sa.Column("empreinte", sa.String(64), primary_key=True),           # SHA-256 du jeton (jamais le jeton)
                    sa.Column("utilisateur_id", uuid, sa.ForeignKey("utilisateur.id"), nullable=False, index=True),
                    sa.Column("csrf", sa.String(64), nullable=False),
                    sa.Column("second_facteur", sa.Boolean(), nullable=False, server_default=sa.false()),
                    _le(), sa.Column("expire_le", sa.DateTime(timezone=True), nullable=False))
    op.create_table("journal_audit",
                    sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
                    _le("le"),
                    sa.Column("organisation_id", uuid, nullable=True, index=True),
                    sa.Column("utilisateur_id", uuid, nullable=True),
                    sa.Column("action", sa.String(80), nullable=False),
                    sa.Column("cible", sa.Text(), nullable=False, server_default=""),
                    sa.Column("detail", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
                    sa.Column("empreinte_precedente", sa.String(64), nullable=False),
                    sa.Column("empreinte", sa.String(64), nullable=False, unique=True))
    op.create_table("formule",
                    sa.Column("id", uuid, primary_key=True),
                    sa.Column("code", sa.String(50), nullable=False, unique=True),
                    sa.Column("nom", sa.String(200), nullable=False),
                    sa.Column("type", sa.String(30), nullable=False),                   # acces_credits | forfait | barometre
                    sa.Column("prix", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
                    sa.Column("droits", jsonb, nullable=False, server_default=sa.text("'{}'::jsonb")),
                    sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_table("abonnement",
                    sa.Column("id", uuid, primary_key=True), org(),
                    sa.Column("formule_id", uuid, sa.ForeignKey("formule.id"), nullable=False),
                    sa.Column("debut", sa.Date(), nullable=False), sa.Column("fin", sa.Date(), nullable=True),
                    sa.Column("statut", sa.String(20), nullable=False, server_default="actif"))
    op.create_table("facture",
                    sa.Column("id", uuid, primary_key=True), org(),
                    sa.Column("numero", sa.String(40), nullable=False, unique=True),
                    _le("emise_le"),
                    sa.Column("lignes", jsonb, nullable=False),
                    sa.Column("montant_ht", sa.Numeric(14, 2), nullable=False),
                    sa.Column("devise", sa.String(10), nullable=False, server_default="FCFA"),
                    sa.Column("statut", sa.String(20), nullable=False, server_default="emise"))   # emise | payee | annulee
    op.create_table("paiement",
                    sa.Column("id", uuid, primary_key=True), org(),
                    sa.Column("facture_id", uuid, sa.ForeignKey("facture.id"), nullable=False, index=True),
                    sa.Column("montant", sa.Numeric(14, 2), nullable=False),
                    sa.Column("moyen", sa.String(30), nullable=False),               # virement | mobile_money | especes
                    sa.Column("reference", sa.String(120), nullable=False, server_default=""),
                    sa.Column("saisi_par", uuid, nullable=False), _le("recu_le"))
    op.create_table("livrable",
                    sa.Column("id", uuid, primary_key=True), org(),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("nom", sa.String(200), nullable=False),
                    sa.Column("fichier", sa.Text(), nullable=False),
                    sa.Column("partage_client", sa.Boolean(), nullable=False, server_default=sa.false()), _le())
    op.create_table("croisement",
                    sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), org(),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("utilisateur_id", uuid, nullable=False), _le("le"),
                    sa.Column("demande", jsonb, nullable=False),
                    sa.Column("base", sa.Integer(), nullable=False),
                    sa.Column("refuse", sa.Boolean(), nullable=False),
                    sa.Column("motif", sa.Text(), nullable=False, server_default=""))
    # journal d'audit inaltérable (comme reponse_brute)
    op.execute("""
        CREATE FUNCTION refuser_modification_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'journal_audit est inaltérable (ni modification ni suppression)'; END $$;
        CREATE TRIGGER journal_audit_inalterable BEFORE UPDATE OR DELETE ON journal_audit
            FOR EACH ROW EXECUTE FUNCTION refuser_modification_audit();
    """)
    # rôle applicatif et RLS forcée
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'plateforme_app') THEN
                CREATE ROLE plateforme_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
            END IF;
        END $$;
    """)
    op.execute("GRANT USAGE ON SCHEMA public TO plateforme_app")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO plateforme_app")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO plateforme_app")
    op.execute("REVOKE UPDATE, DELETE ON journal_audit FROM plateforme_app")
    for t in TABLES_CLIENTS:
        op.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {t} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY isolation_{t} ON {t}
                USING (current_setting('app.usine', true) = 'oui'
                       OR organisation_id = NULLIF(current_setting('app.organisation_id', true), '')::uuid)
                WITH CHECK (current_setting('app.usine', true) = 'oui'
                            OR organisation_id = NULLIF(current_setting('app.organisation_id', true), '')::uuid)
        """)


def downgrade() -> None:
    for t in reversed(TABLES_CLIENTS):
        op.execute(f"DROP POLICY IF EXISTS isolation_{t} ON {t}")
        op.execute(f"ALTER TABLE {t} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {t} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TRIGGER journal_audit_inalterable ON journal_audit; DROP FUNCTION refuser_modification_audit();")
    for t in ("croisement", "livrable", "paiement", "facture", "abonnement", "formule", "journal_audit", "session_web", "utilisateur"):
        op.drop_table(t)
    for c in ("parametres", "base_analyse", "dossier", "statut"):
        op.drop_column("projet", c)
    op.drop_column("organisation", "type")
