"""Modèle du dictionnaire du questionnaire : première des trois sources de vérité d'un projet.

Tout ce qui dérive du questionnaire (formulaire, masque, syntaxe SPSS, tri à plat,
contrôles) est généré depuis ce modèle. Les validations rendent impossibles les
défauts constatés sur le terrain (CLAUDE.md, section 5) : codes en double, code
de non-réponse utilisé comme modalité, question de quota facultative, règle de
cohérence citant une variable inexistante, libellés ambigus au codage…
"""

from __future__ import annotations

import re
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from plateforme.dictionnaire import expressions
from plateforme.noyau.textes import cle

CODE_VARIABLE = re.compile(r"^[A-Z]{8}$")

# Variables administratives et de contrôle produites par la plateforme : un code de question
# ne peut pas les réutiliser (voir generateurs/masque.py).
VARIABLES_RESERVEES = frozenset({
    "NUMFICHE", "CODEENQU", "CODEZONE", "QUARTIER", "SITEENQU", "DATEENQU", "HEUREENQ", "DELAIPRE",
    "ACCRECON", "ANOMALIE", "STATUTQC",
})

Textes = dict[str, str]
"""Libellé par langue : {"fr": "…", "en": "…"}."""


class TypeQuestion(StrEnum):
    CHOIX_UNIQUE = "choix_unique"
    CHOIX_MULTIPLE = "choix_multiple"
    GRILLE = "grille"
    TEXTE = "texte"
    NUMERIQUE = "numerique"
    DATE = "date"


class Mesure(StrEnum):
    NOMINAL = "NOMINAL"
    ORDINAL = "ORDINAL"
    SCALE = "SCALE"


class RoleIdentification(StrEnum):
    ENQUETEUR = "enqueteur"
    QUARTIER = "quartier"
    SITE = "site"
    NOM = "nom"
    TELEPHONE = "telephone"
    EMAIL = "email"
    ACCORD_RECONTACT = "accord_recontact"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class CodesSpeciaux(Strict):
    non_applicable: int = 97
    ne_sait_pas: int = 98
    non_reponse: int = 99
    libelles: dict[int, Textes] = Field(default_factory=lambda: {
        97: {"fr": "Non applicable", "en": "Not applicable"},
        98: {"fr": "NSP / Sans avis", "en": "Don't know / No opinion"},
        99: {"fr": "Non-réponse", "en": "No answer"},
    })

    def tous(self) -> frozenset[int]:
        return frozenset({self.non_applicable, self.ne_sait_pas, self.non_reponse})


class Section(Strict):
    id: str
    libelles: Textes


class Modalite(Strict):
    code: int
    libelles: Textes
    alias: list[str] = Field(default_factory=list, description="Anciens libellés encore acceptés au codage")
    variable: str | None = Field(default=None, description="Choix multiple : variable binaire de la modalité")


class Autre(Strict):
    code: int
    libelles: Textes
    variable: str = Field(description="Variable texte qui reçoit la précision")
    longueur: int = 80


class LigneGrille(Strict):
    variable: str
    libelles: Textes


class QuestionIdentification(Strict):
    """Question d'identification (hors questionnaire codé) : alimente les variables administratives ou les contacts."""

    role: RoleIdentification
    libelles: Textes
    type: TypeQuestion = TypeQuestion.TEXTE
    obligatoire: bool = True
    aide: Textes = Field(default_factory=dict)
    validation: str | None = Field(default=None, description="Expression régulière, ou « email »")
    message_validation: Textes = Field(default_factory=dict)
    modalites: list[Modalite] = Field(default_factory=list)
    donnee_personnelle: bool = False


class Question(Strict):
    numero: int = Field(ge=1)
    code: str
    section: str
    libelles: Textes
    type: TypeQuestion
    mesure: Mesure | None = None
    obligatoire: bool = True
    aide: Textes = Field(default_factory=dict)
    modalites: list[Modalite] = Field(default_factory=list)
    autre: Autre | None = None
    lignes: list[LigneGrille] = Field(default_factory=list)
    condition: str | None = Field(default=None, description="Condition d'affichage (expressions.py)")
    role: str | None = Field(default=None, description="« cible » : question qui porte les quotas")
    prerempli: str | None = Field(default=None, description="« ville » : pré-remplie par le lien personnel")
    longueur: int = Field(default=500, description="Longueur SPSS d'une question texte")

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        if not CODE_VARIABLE.match(v):
            raise ValueError(f"code « {v} » : 8 lettres majuscules attendues")
        return v

    @model_validator(mode="after")
    def _coherence_type(self) -> Self:
        t, q = self.type, f"Q{self.numero} ({self.code})"
        codes = [m.code for m in self.modalites]
        if len(codes) != len(set(codes)):
            raise ValueError(f"{q} : codes de modalités en double")
        if t in (TypeQuestion.CHOIX_UNIQUE, TypeQuestion.CHOIX_MULTIPLE, TypeQuestion.GRILLE) and not self.modalites:
            raise ValueError(f"{q} : au moins une modalité attendue")
        if t in (TypeQuestion.CHOIX_UNIQUE, TypeQuestion.GRILLE) and self.mesure is None:
            raise ValueError(f"{q} : mesure (NOMINAL / ORDINAL / SCALE) obligatoire")
        if t is TypeQuestion.CHOIX_MULTIPLE:
            if any(m.variable is None for m in self.modalites):
                raise ValueError(f"{q} : chaque modalité d'un choix multiple porte sa variable binaire")
        elif any(m.variable is not None for m in self.modalites):
            raise ValueError(f"{q} : seules les modalités d'un choix multiple portent une variable")
        if (t is TypeQuestion.GRILLE) != bool(self.lignes):
            raise ValueError(f"{q} : les lignes sont réservées aux grilles, et une grille en exige")
        if self.autre is not None:
            if t is not TypeQuestion.CHOIX_UNIQUE:
                raise ValueError(f"{q} : « Autre (précisez) » n'est géré que pour un choix unique")
            if self.autre.code in codes:
                raise ValueError(f"{q} : le code « Autre » {self.autre.code} est déjà une modalité")
        # Deux libellés (ou alias) de même clé rendraient le codage ambigu
        for langue in {lg for m in self.modalites for lg in m.libelles}:
            vus: dict[str, int] = {}
            for m in self.modalites:
                for texte in [m.libelles.get(langue, "")] + (m.alias if langue == "fr" else []):
                    k = cle(texte)
                    if k and vus.setdefault(k, m.code) != m.code:
                        raise ValueError(f"{q} : libellé ambigu « {texte} » ({langue}) pour les codes {vus[k]} et {m.code}")
        if self.role is not None and self.role != "cible":
            raise ValueError(f"{q} : rôle inconnu « {self.role} »")
        if self.role == "cible" and (t is not TypeQuestion.CHOIX_UNIQUE or not self.obligatoire):
            raise ValueError(f"{q} : la question de cible (quotas) doit être un choix unique OBLIGATOIRE")
        if self.prerempli is not None and self.prerempli != "ville":
            raise ValueError(f"{q} : pré-remplissage inconnu « {self.prerempli} »")
        if self.condition:
            try:
                expressions.analyser(self.condition)
            except expressions.ExpressionInvalide as e:
                raise ValueError(f"{q} : condition invalide ({e})") from e
        return self

    def variables(self) -> list[str]:
        """Variables (colonnes) produites par la question, dans l'ordre du masque."""
        if self.type is TypeQuestion.CHOIX_MULTIPLE:
            return [m.variable for m in self.modalites if m.variable]
        if self.type is TypeQuestion.GRILLE:
            return [li.variable for li in self.lignes]
        return [self.code] + ([self.autre.variable] if self.autre else [])

    def variables_codees(self) -> list[str]:
        """Variables numériques codées (hors variable texte « Autre »)."""
        return [v for v in self.variables() if not (self.autre and v == self.autre.variable)]


class RegleCoherence(Strict):
    code: str = Field(pattern=r"^[A-Z0-9_]+$")
    expression: str
    description: Textes = Field(default_factory=dict)

    @field_validator("expression")
    @classmethod
    def _expression(cls, v: str) -> str:
        try:
            expressions.analyser(v)
        except expressions.ExpressionInvalide as e:
            raise ValueError(f"expression invalide ({e})") from e
        return v


class Dictionnaire(Strict):
    """Dictionnaire versionné d'un questionnaire."""

    etude: str
    version: str
    langue_reference: str = "fr"
    langues: list[str] = Field(default_factory=lambda: ["fr"])
    titre: Textes = Field(default_factory=dict)
    statut: str = Field(default="valide", pattern=r"^(brouillon|valide)$",
                        description="« brouillon » tant qu'un import n'a pas été revu par un humain")
    source: str = ""
    codes_speciaux: CodesSpeciaux = Field(default_factory=CodesSpeciaux)
    libelles_choix_multiple: dict[int, Textes] = Field(default_factory=lambda: {
        1: {"fr": "Cité", "en": "Mentioned"}, 0: {"fr": "Non cité", "en": "Not mentioned"}})
    mention_choix_multiple: Textes = Field(default_factory=lambda: {
        "fr": "(plusieurs réponses)", "en": "(several answers)"})
    sections: list[Section]
    identification: list[QuestionIdentification] = Field(default_factory=list)
    questions: list[Question]
    regles_coherence: list[RegleCoherence] = Field(default_factory=list)

    @model_validator(mode="after")
    def _coherence_globale(self) -> Self:
        if self.langue_reference not in self.langues:
            raise ValueError("la langue de référence doit figurer dans « langues »")
        ids_sections = [s.id for s in self.sections]
        if len(ids_sections) != len(set(ids_sections)):
            raise ValueError("identifiants de sections en double")
        numeros = [q.numero for q in self.questions]
        if len(numeros) != len(set(numeros)):
            raise ValueError("numéros de questions en double")
        nr = self.codes_speciaux.non_reponse
        vues: dict[str, str] = {}

        def declarer(nom: str, origine: str) -> None:
            if not CODE_VARIABLE.match(nom):
                raise ValueError(f"{origine} : variable « {nom} » : 8 lettres majuscules attendues")
            if nom in VARIABLES_RESERVEES:
                raise ValueError(f"{origine} : « {nom} » est une variable réservée de la plateforme")
            if nom in vues:
                raise ValueError(f"variable « {nom} » en double ({vues[nom]} et {origine})")
            vues[nom] = origine

        for q in self.questions:
            origine = f"Q{q.numero}"
            if q.section not in ids_sections:
                raise ValueError(f"{origine} : section inconnue « {q.section} »")
            for texte, nom in [(q.libelles, "libellé")] + [(m.libelles, f"modalité {m.code}") for m in q.modalites]:
                if self.langue_reference not in texte:
                    raise ValueError(f"{origine} : {nom} sans libellé en langue de référence ({self.langue_reference})")
            if any(m.code == nr for m in q.modalites) or (q.autre and q.autre.code == nr):
                raise ValueError(f"{origine} : le code {nr} est réservé à la non-réponse")
            declarer(q.code, origine)
            for v in q.variables():
                if v != q.code:
                    declarer(v, origine)
        cibles = [q for q in self.questions if q.role == "cible"]
        if len(cibles) > 1:
            raise ValueError("une seule question de cible (quotas) par questionnaire")
        connues = set(vues)
        for r in self.regles_coherence:
            inconnues = expressions.variables(r.expression) - connues
            if inconnues:
                raise ValueError(f"règle {r.code} : variable(s) inconnue(s) {sorted(inconnues)}")
        for q in self.questions:
            if q.condition:
                inconnues = expressions.variables(q.condition) - connues
                if inconnues:
                    raise ValueError(f"Q{q.numero} : condition sur variable(s) inconnue(s) {sorted(inconnues)}")
        codes_regles = [r.code for r in self.regles_coherence]
        if len(codes_regles) != len(set(codes_regles)):
            raise ValueError("codes de règles de cohérence en double")
        return self

    # ----- accès pratiques -----
    def section(self, id_section: str) -> Section:
        return next(s for s in self.sections if s.id == id_section)

    def question(self, code: str) -> Question:
        return next(q for q in self.questions if q.code == code)

    def question_cible(self) -> Question | None:
        return next((q for q in self.questions if q.role == "cible"), None)

    def texte(self, textes: Textes, langue: str | None = None) -> str:
        """Libellé dans la langue demandée, à défaut dans la langue de référence."""
        return textes.get(langue or self.langue_reference) or textes.get(self.langue_reference, "")

    def titre_question(self, q: Question, langue: str | None = None) -> str:
        """Titre affiché : « Q9. Produits achetés (plusieurs réponses) »."""
        base = f"Q{q.numero}. {self.texte(q.libelles, langue)}"
        if q.type is TypeQuestion.CHOIX_MULTIPLE:
            base += " " + self.texte(self.mention_choix_multiple, langue)
        return base
