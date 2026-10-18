"""Schéma initial : organisations, projets, réponses brutes immuables, N° de fiche, fiches codées, décisions, contacts, journal.

Révision : 0001
Précédente : aucune
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _horodatage(nom: str) -> sa.Column[object]:
    return sa.Column(nom, sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    op.create_table("organisation",
                    sa.Column("id", uuid, primary_key=True), sa.Column("nom", sa.String(200), nullable=False, unique=True),
                    _horodatage("cree_le"))
    op.create_table("projet",
                    sa.Column("id", uuid, primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("code", sa.String(100), nullable=False), sa.Column("nom", sa.String(300), nullable=False),
                    _horodatage("cree_le"), sa.UniqueConstraint("organisation_id", "code"))
    op.create_table("reponse_brute",
                    sa.Column("id", uuid, primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("id_externe", sa.String(200), nullable=False),
                    sa.Column("source", sa.String(200), nullable=False),
                    sa.Column("horodatage", sa.DateTime(timezone=True), nullable=False, index=True),
                    sa.Column("items", postgresql.JSONB(), nullable=False),
                    sa.Column("empreinte", sa.String(64), nullable=False),
                    _horodatage("recue_le"),
                    sa.UniqueConstraint("projet_id", "id_externe", name="uq_reponse_par_projet"))
    # Une réponse brute est IMMUABLE : toute modification ou suppression est refusée par la base elle-même.
    op.execute("""
        CREATE FUNCTION refuser_modification_reponse() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'reponse_brute est immuable (% refusé)', TG_OP USING ERRCODE = 'restrict_violation';
        END $$;
        CREATE TRIGGER reponse_brute_immuable BEFORE UPDATE OR DELETE ON reponse_brute
            FOR EACH ROW EXECUTE FUNCTION refuser_modification_reponse();
    """)
    op.create_table("numero_fiche",
                    sa.Column("reponse_id", uuid, sa.ForeignKey("reponse_brute.id"), primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("enqueteur", sa.String(50), nullable=False), sa.Column("sequence", sa.Integer, nullable=False),
                    _horodatage("attribue_le"),
                    sa.UniqueConstraint("projet_id", "enqueteur", "sequence", name="uq_numero_par_enqueteur"))
    op.execute("""
        CREATE FUNCTION refuser_modification_numero() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'un N° de fiche attribué ne peut être ni modifié ni supprimé' USING ERRCODE = 'restrict_violation';
        END $$;
        CREATE TRIGGER numero_fiche_fige BEFORE UPDATE OR DELETE ON numero_fiche
            FOR EACH ROW EXECUTE FUNCTION refuser_modification_numero();
    """)
    op.create_table("fiche_codee",
                    sa.Column("reponse_id", uuid, sa.ForeignKey("reponse_brute.id"), primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("numfiche", sa.String(40), nullable=False),
                    sa.Column("valeurs", postgresql.JSONB(), nullable=False),
                    sa.Column("anomalies", postgresql.JSONB(), nullable=False),
                    sa.Column("statut", sa.String(20), nullable=False, index=True),
                    sa.Column("version_dictionnaire", sa.String(40), nullable=False),
                    _horodatage("codee_le"),
                    sa.UniqueConstraint("projet_id", "numfiche", name="uq_numfiche_par_projet"))
    op.create_table("decision_qc",
                    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("reponse_id", uuid, sa.ForeignKey("reponse_brute.id"), nullable=False, index=True),
                    sa.Column("statut", sa.String(20), nullable=False),
                    sa.Column("anomalies_vues", sa.Text, nullable=False), sa.Column("motif", sa.Text, nullable=False),
                    sa.Column("auteur", sa.String(200), nullable=False), _horodatage("decide_le"),
                    sa.CheckConstraint("statut IN ('OK', 'REJETE', 'EXCLUE')", name="ck_statut_decision"))
    op.create_table("contact",
                    sa.Column("reponse_id", uuid, sa.ForeignKey("reponse_brute.id"), primary_key=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=False, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=False, index=True),
                    sa.Column("ligne", postgresql.JSONB(), nullable=False))
    op.create_table("journal_sync",
                    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
                    sa.Column("organisation_id", uuid, sa.ForeignKey("organisation.id"), nullable=True, index=True),
                    sa.Column("projet_id", uuid, sa.ForeignKey("projet.id"), nullable=True, index=True),
                    _horodatage("le"),
                    sa.Column("source", sa.String(50), nullable=False), sa.Column("niveau", sa.String(10), nullable=False),
                    sa.Column("message", sa.Text, nullable=False))
    op.create_index("ix_journal_sync_le", "journal_sync", ["le"])


def downgrade() -> None:
    for table in ("journal_sync", "contact", "decision_qc", "fiche_codee"):
        op.drop_table(table)
    op.execute("DROP TRIGGER numero_fiche_fige ON numero_fiche; DROP FUNCTION refuser_modification_numero();")
    op.drop_table("numero_fiche")
    op.execute("DROP TRIGGER reponse_brute_immuable ON reponse_brute; DROP FUNCTION refuser_modification_reponse();")
    for table in ("reponse_brute", "projet", "organisation"):
        op.drop_table(table)
