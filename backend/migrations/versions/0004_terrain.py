"""Phase 8 (collecte native hors ligne) : missions des enquêteurs, sessions de terrain, métadonnées des fiches (durée,
position GPS) séparées des réponses, photos de points de vente, signalements.

- `mission` et `session_terrain` : tables d'authentification (comme `utilisateur`), hors RLS, lues par le seul module
  d'authentification du terrain ; le code de mission et le jeton ne sont stockés que sous forme d'empreinte SHA-256.
- `meta_fiche`, `photo`, `signalement` : données d'un client, RLS forcée (D-053). La position GPS reste à part des
  réponses et n'entre jamais dans la base livrée (D-056).

Révision : 0004
Précédente : 0003
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

TABLES_CLIENTS = ["meta_fiche", "photo", "signalement"]


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    maintenant = sa.func.now()
    op.create_table("mission",
                    sa.Column("id", uuid, primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("enqueteur", sa.String(50), nullable=False),
                    sa.Column("code_empreinte", sa.String(64), nullable=False, unique=True),
                    sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
                    sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=maintenant),
                    sa.UniqueConstraint("projet_id", "enqueteur", name="uq_mission_par_poste"))
    op.create_table("session_terrain",
                    sa.Column("empreinte", sa.String(64), primary_key=True),
                    sa.Column("mission_id", uuid, sa.ForeignKey("mission.id"), nullable=False, index=True),
                    sa.Column("cree_le", sa.DateTime(timezone=True), nullable=False, server_default=maintenant),
                    sa.Column("expire_le", sa.DateTime(timezone=True), nullable=False))
    op.create_table("meta_fiche",
                    sa.Column("reponse_id", uuid, sa.ForeignKey("reponse_brute.id"), primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("mission_id", uuid, sa.ForeignKey("mission.id"), nullable=False, index=True),
                    sa.Column("debut", sa.DateTime(timezone=True), nullable=True),
                    sa.Column("duree_s", sa.Integer(), nullable=True),
                    sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
                    sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
                    sa.Column("precision_m", sa.Integer(), nullable=True),
                    sa.Column("recue_le", sa.DateTime(timezone=True), nullable=False, server_default=maintenant))
    op.create_table("photo",
                    sa.Column("id", uuid, primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("reponse_id", uuid, sa.ForeignKey("reponse_brute.id"), nullable=False, unique=True),
                    sa.Column("fichier", sa.Text(), nullable=False),
                    sa.Column("octets", sa.Integer(), nullable=False),
                    sa.Column("empreinte", sa.String(64), nullable=False))
    op.create_table("signalement",
                    sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("mission_id", uuid, sa.ForeignKey("mission.id"), nullable=False),
                    sa.Column("le", sa.DateTime(timezone=True), nullable=False, server_default=maintenant),
                    sa.Column("type", sa.String(30), nullable=False),
                    sa.Column("texte", sa.Text(), nullable=False))
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
    for t in ("signalement", "photo", "meta_fiche", "session_terrain", "mission"):
        op.drop_table(t)
