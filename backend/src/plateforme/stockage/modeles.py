"""Schéma de la base (SQLAlchemy 2). Garanties portées PAR LA BASE, pas seulement par le code :

- `reponse_brute` : une réponse par (projet, identifiant de réponse) — contrainte d'unicité, donc une
  fiche envoyée deux fois n'est jamais comptée deux fois ; IMMUABLE (déclencheur qui refuse UPDATE et
  DELETE, voir la migration) ;
- `numero_fiche` : registre des N° ; un N° attribué n'est jamais modifié ni réattribué
  (unicité par projet, enquêteur et séquence ; unicité par réponse) ;
- `fiche_codee` : recalculable à tout moment depuis la réponse brute et le dictionnaire ;
- `decision_qc` : historique des décisions du superviseur (la dernière fait foi), séparé des fiches ;
- `contact` : coordonnées des répondants, séparées des réponses codées (chiffrement : phase 7) ;
- `journal_sync` : toute opération et toute erreur sont journalisées, jamais silencieuses.
Chaque table porte `organisation_id` (isolation multi-locataire ; politiques RLS en phase 7).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

Json = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class Organisation(Base):
    __tablename__ = "organisation"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(String(200), unique=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Projet(Base):
    __tablename__ = "projet"
    __table_args__ = (UniqueConstraint("organisation_id", "code"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    code: Mapped[str] = mapped_column(String(100))
    nom: Mapped[str] = mapped_column(String(300))
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReponseBruteBD(Base):
    __tablename__ = "reponse_brute"
    __table_args__ = (UniqueConstraint("projet_id", "id_externe", name="uq_reponse_par_projet"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    id_externe: Mapped[str] = mapped_column(String(200))           # identifiant généré par l'outil de collecte / l'appareil
    source: Mapped[str] = mapped_column(String(200), default="")
    horodatage: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    items: Mapped[list[dict[str, Any]]] = mapped_column(Json)
    empreinte: Mapped[str] = mapped_column(String(64))             # SHA-256 du contenu : détecte un renvoi modifié
    recue_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NumeroFiche(Base):
    __tablename__ = "numero_fiche"
    __table_args__ = (UniqueConstraint("projet_id", "enqueteur", "sequence", name="uq_numero_par_enqueteur"),)
    reponse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reponse_brute.id"), primary_key=True)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    enqueteur: Mapped[str] = mapped_column(String(50))
    sequence: Mapped[int] = mapped_column(Integer)
    attribue_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FicheCodeeBD(Base):
    __tablename__ = "fiche_codee"
    __table_args__ = (UniqueConstraint("projet_id", "numfiche", name="uq_numfiche_par_projet"),)
    reponse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reponse_brute.id"), primary_key=True)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    numfiche: Mapped[str] = mapped_column(String(40))
    valeurs: Mapped[dict[str, Any]] = mapped_column(Json)
    anomalies: Mapped[list[str]] = mapped_column(Json)
    statut: Mapped[str] = mapped_column(String(20), index=True)
    version_dictionnaire: Mapped[str] = mapped_column(String(40))
    codee_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DecisionQCBD(Base):
    __tablename__ = "decision_qc"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    reponse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reponse_brute.id"), index=True)
    statut: Mapped[str] = mapped_column(String(20))                  # OK | REJETE | EXCLUE
    anomalies_vues: Mapped[str] = mapped_column(Text, default="")
    motif: Mapped[str] = mapped_column(Text, default="")
    auteur: Mapped[str] = mapped_column(String(200), default="")
    decide_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Contact(Base):
    __tablename__ = "contact"
    reponse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reponse_brute.id"), primary_key=True)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    ligne: Mapped[list[str]] = mapped_column(Json)


class JournalSync(Base):
    __tablename__ = "journal_sync"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organisation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organisation.id"), index=True, nullable=True)
    projet_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projet.id"), index=True, nullable=True)
    le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    source: Mapped[str] = mapped_column(String(50))
    niveau: Mapped[str] = mapped_column(String(10))                   # INFO | ALERTE | ERREUR
    message: Mapped[str] = mapped_column(Text)
