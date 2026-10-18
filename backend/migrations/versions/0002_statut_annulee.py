"""Décision ANNULEE (incident technique, non imputable) autorisée dans decision_qc.

Révision : 0002
Précédente : 0001
"""

from __future__ import annotations

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_statut_decision", "decision_qc", type_="check")
    op.create_check_constraint("ck_statut_decision", "decision_qc", "statut IN ('OK', 'REJETE', 'ANNULEE', 'EXCLUE')")


def downgrade() -> None:
    op.drop_constraint("ck_statut_decision", "decision_qc", type_="check")
    op.create_check_constraint("ck_statut_decision", "decision_qc", "statut IN ('OK', 'REJETE', 'EXCLUE')")
