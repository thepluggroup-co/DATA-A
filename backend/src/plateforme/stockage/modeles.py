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

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy import Date as sa_Date
from sqlalchemy import Numeric as sa_Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

Json = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class Organisation(Base):
    __tablename__ = "organisation"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(String(200), unique=True)
    type: Mapped[str] = mapped_column(String(10), default="client")
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Projet(Base):
    __tablename__ = "projet"
    __table_args__ = (UniqueConstraint("organisation_id", "code"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    code: Mapped[str] = mapped_column(String(100))
    nom: Mapped[str] = mapped_column(String(300))
    statut: Mapped[str] = mapped_column(String(30), default="brief")
    dossier: Mapped[str] = mapped_column(Text, default="")
    base_analyse: Mapped[str] = mapped_column(Text, default="")
    parametres: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
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
    statut: Mapped[str] = mapped_column(String(20))                  # OK | REJETE | ANNULEE | EXCLUE
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


# ------------------------------------------------------------------------------------------------ phase 7 (SaaS)
class Utilisateur(Base):
    __tablename__ = "utilisateur"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    nom: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(30))
    hash_mdp: Mapped[str] = mapped_column(Text)
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    actif: Mapped[bool] = mapped_column(default=True)
    echecs: Mapped[int] = mapped_column(Integer, default=0)
    bloque_jusqu: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SessionWeb(Base):
    __tablename__ = "session_web"
    empreinte: Mapped[str] = mapped_column(String(64), primary_key=True)
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilisateur.id"), index=True)
    csrf: Mapped[str] = mapped_column(String(64))
    second_facteur: Mapped[bool] = mapped_column(default=False)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expire_le: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class JournalAudit(Base):
    __tablename__ = "journal_audit"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    organisation_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    utilisateur_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    action: Mapped[str] = mapped_column(String(80))
    cible: Mapped[str] = mapped_column(Text, default="")
    detail: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
    empreinte_precedente: Mapped[str] = mapped_column(String(64))
    empreinte: Mapped[str] = mapped_column(String(64), unique=True)


class Formule(Base):
    __tablename__ = "formule"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True)
    nom: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(30))
    prix: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
    droits: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
    active: Mapped[bool] = mapped_column(default=True)


class Abonnement(Base):
    __tablename__ = "abonnement"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    formule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("formule.id"))
    debut: Mapped[Any] = mapped_column(sa_Date())
    fin: Mapped[Any] = mapped_column(sa_Date(), nullable=True)
    statut: Mapped[str] = mapped_column(String(20), default="actif")


class Facture(Base):
    __tablename__ = "facture"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    numero: Mapped[str] = mapped_column(String(40), unique=True)
    emise_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lignes: Mapped[list[Any]] = mapped_column(Json)
    montant_ht: Mapped[Any] = mapped_column(sa_Numeric(14, 2))
    devise: Mapped[str] = mapped_column(String(10), default="FCFA")
    statut: Mapped[str] = mapped_column(String(20), default="emise")


class Paiement(Base):
    __tablename__ = "paiement"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    facture_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("facture.id"), index=True)
    montant: Mapped[Any] = mapped_column(sa_Numeric(14, 2))
    moyen: Mapped[str] = mapped_column(String(30))
    reference: Mapped[str] = mapped_column(String(120), default="")
    saisi_par: Mapped[uuid.UUID] = mapped_column()
    recu_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Livrable(Base):
    __tablename__ = "livrable"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    nom: Mapped[str] = mapped_column(String(200))
    fichier: Mapped[str] = mapped_column(Text)
    partage_client: Mapped[bool] = mapped_column(default=False)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CroisementBD(Base):
    __tablename__ = "croisement"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    utilisateur_id: Mapped[uuid.UUID] = mapped_column()
    le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    demande: Mapped[dict[str, Any]] = mapped_column(Json)
    base: Mapped[int] = mapped_column(Integer)
    refuse: Mapped[bool] = mapped_column()
    motif: Mapped[str] = mapped_column(Text, default="")


# ------------------------------------------------------------------------------------------------ phase 8 (terrain)
class Mission(Base):
    __tablename__ = "mission"
    __table_args__ = (UniqueConstraint("projet_id", "enqueteur", name="uq_mission_par_poste"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    enqueteur: Mapped[str] = mapped_column(String(50))
    code_empreinte: Mapped[str] = mapped_column(String(64), unique=True)
    actif: Mapped[bool] = mapped_column(default=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SessionTerrain(Base):
    __tablename__ = "session_terrain"
    empreinte: Mapped[str] = mapped_column(String(64), primary_key=True)
    mission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mission.id"), index=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expire_le: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MetaFiche(Base):
    __tablename__ = "meta_fiche"
    reponse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reponse_brute.id"), primary_key=True)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    mission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mission.id"), index=True)
    debut: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duree_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latitude: Mapped[Any] = mapped_column(sa_Numeric(9, 6), nullable=True)
    longitude: Mapped[Any] = mapped_column(sa_Numeric(9, 6), nullable=True)
    precision_m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recue_le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Photo(Base):
    __tablename__ = "photo"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    reponse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reponse_brute.id"), unique=True)
    fichier: Mapped[str] = mapped_column(Text)
    octets: Mapped[int] = mapped_column(Integer)
    empreinte: Mapped[str] = mapped_column(String(64))


class Signalement(Base):
    __tablename__ = "signalement"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisation.id"), index=True)
    projet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projet.id"), index=True)
    mission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mission.id"))
    le: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    type: Mapped[str] = mapped_column(String(30))
    texte: Mapped[str] = mapped_column(Text)
