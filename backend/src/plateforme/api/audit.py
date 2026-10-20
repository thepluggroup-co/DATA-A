"""Journal d'audit inaltérable : chaque entrée porte l'empreinte de la précédente (chaîne SHA-256). Une suppression ou une
modification est refusée par la base (déclencheur) ; une altération hors base casse la chaîne, vérifiable à tout moment."""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from plateforme.stockage.modeles import JournalAudit

ORIGINE = "0" * 64
VERROU = 7_202_607          # verrou consultatif de transaction : une seule écriture à la fois dans la chaîne


def _empreinte(precedente: str, action: str, cible: str, detail: dict[str, Any], org: uuid.UUID | None, util: uuid.UUID | None) -> str:
    contenu = json.dumps({"p": precedente, "a": action, "c": cible, "d": detail, "o": str(org or ""), "u": str(util or "")},
                         sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(contenu.encode("utf-8")).hexdigest()


def journaliser(s: Session, action: str, cible: str = "", detail: dict[str, Any] | None = None,
                organisation_id: uuid.UUID | None = None, utilisateur_id: uuid.UUID | None = None) -> None:
    s.execute(text("SELECT pg_advisory_xact_lock(:v)"), {"v": VERROU})
    precedente = s.scalar(select(JournalAudit.empreinte).order_by(JournalAudit.id.desc()).limit(1)) or ORIGINE
    d = detail or {}
    s.add(JournalAudit(action=action, cible=cible, detail=d, organisation_id=organisation_id, utilisateur_id=utilisateur_id,
                       empreinte_precedente=precedente,
                       empreinte=_empreinte(precedente, action, cible, d, organisation_id, utilisateur_id)))
    s.flush()


def verifier_chaine(s: Session) -> list[str]:
    """Écarts de la chaîne (liste vide = intègre)."""
    out, precedente = [], ORIGINE
    for e in s.scalars(select(JournalAudit).order_by(JournalAudit.id)):
        if e.empreinte_precedente != precedente:
            out.append(f"entrée {e.id} : chaînage rompu")
        if e.empreinte != _empreinte(e.empreinte_precedente, e.action, e.cible, e.detail, e.organisation_id, e.utilisateur_id):
            out.append(f"entrée {e.id} : contenu altéré")
        precedente = e.empreinte
    return out
