"""Fiche profil des paiements (structure SOLINA, CLAUDE.md §3.2) et devis, calculés depuis le plan de terrain, le vivier et
les barèmes. Aucun montant dans le code.

Règles :
- enquêteur titulaire : barème « titulaire » ; collecte = PU × jours de terrain effectivement tenus sur le poste ;
- remplacement (affectations datées) : le reste des jours de collecte passe au remplaçant (barème « remplacant »), la
  formation n'est versée qu'aux titulaires si `formation_titulaires_seuls` ;
- réserve non activée : barème « reserve » (formation seulement en général) ;
- encadrement : barème de sa fonction (expert, appui_1, appui_2, superviseur, depouilleur) ;
- impressions (badges, chartes, ordres de mission, contrats) : ligne à part ;
- contrôle : la somme des lignes égale le total général ; le reste à payer n'est jamais négatif.
- Les colonnes « en compte partenaire » / « reste partenaire » de la fiche SOLINA ne sont pas reprises tant que le fichier
  n'est pas fourni (leur règle n'est pas décrite) : à ajouter alors.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from plateforme.projet.brief import Tarifs
from plateforme.terrain.plan import LIBELLES_FONCTIONS, Bareme, EnqueteurPlan, PlanTerrain, Role
from plateforme.terrain.vivier import Vivier


class Rubrique(BaseModel):
    model_config = ConfigDict(frozen=True)
    pu: float = 0
    qte: float = 0

    @property
    def montant(self) -> float:
        return self.pu * self.qte


class LignePaiement(BaseModel):
    model_config = ConfigDict(frozen=True)
    personne: str
    nom: str
    statut: str
    poste: str
    ville: str
    superviseur: str
    honoraires: float = 0
    formation: Rubrique = Field(default_factory=Rubrique)
    collecte: Rubrique = Field(default_factory=Rubrique)
    transport: Rubrique = Field(default_factory=Rubrique)
    hebergement: Rubrique = Field(default_factory=Rubrique)
    depouillement: Rubrique = Field(default_factory=Rubrique)
    avance: float = 0

    @property
    def total(self) -> float:
        return self.honoraires + sum(r.montant for r in (self.formation, self.collecte, self.transport, self.hebergement, self.depouillement))

    @property
    def reste(self) -> float:
        return self.total - self.avance


class Impressions(BaseModel):
    model_config = ConfigDict(frozen=True)
    lignes: dict[str, Rubrique]

    @property
    def total(self) -> float:
        return sum(r.montant for r in self.lignes.values())


class FichePaiements(BaseModel):
    model_config = ConfigDict(frozen=True)
    etude: str
    devise: str
    lignes: list[LignePaiement]
    impressions: Impressions
    anomalies: list[str] = Field(default_factory=list)

    @property
    def total_personnes(self) -> float:
        return sum(li.total for li in self.lignes)

    @property
    def total_general(self) -> float:
        return self.total_personnes + self.impressions.total


def _rubrique(b: Bareme | None, nom: str, qte_defaut: float | None = None) -> Rubrique:
    ligne = getattr(b, nom) if b is not None else None
    if ligne is None:
        return Rubrique()
    qte = qte_defaut if qte_defaut is not None and "qte" not in ligne.model_fields_set else ligne.qte
    return Rubrique(pu=ligne.pu, qte=qte)


def _jours_tenus(jours: list[date], debut: datetime | None, fin: datetime | None) -> int:
    return sum(1 for j in jours if (debut is None or j >= debut.date()) and (fin is None or j < fin.date()))


def _nom(vivier: Vivier | None, pid: str | None) -> str:
    if not pid:
        return "(poste non pourvu)"
    if vivier is None:
        return pid
    try:
        return vivier.personne(pid).nom_complet
    except KeyError:
        return pid


def fiche(terrain: PlanTerrain, tarifs: Tarifs, vivier: Vivier | None = None) -> FichePaiements:
    jours = terrain.jours_ouvres()
    sup_nom = {v.id: _nom(vivier, next((m.personne for m in terrain.equipe if m.id == v.superviseur), None)) if v.superviseur else ""
               for v in terrain.villes}
    lignes: list[LignePaiement] = []

    def ligne(pid: str | None, fonction: str, poste: str, ville: str | None, b: Bareme | None, jours_collecte: float,
              formation: bool = True) -> None:
        lignes.append(LignePaiement(
            personne=pid or "", nom=_nom(vivier, pid), statut=LIBELLES_FONCTIONS.get(fonction, fonction), poste=poste,
            ville=terrain.ville(ville).libelle if ville else "Toutes", superviseur=sup_nom.get(ville or "", ""),
            honoraires=b.honoraires if b else 0, formation=_rubrique(b, "formation") if formation else Rubrique(),
            collecte=_rubrique(b, "collecte", jours_collecte), transport=_rubrique(b, "transport"),
            hebergement=_rubrique(b, "hebergement"), depouillement=_rubrique(b, "depouillement"), avance=b.avance if b else 0))

    for m in terrain.equipe:
        ligne(m.personne, m.fonction.value, m.id, m.ville, terrain.baremes.get(m.fonction.value), len(jours))
    for e in terrain.enqueteurs:
        _lignes_poste(e, terrain, jours, ligne)
    imp = tarifs.impression
    enqueteurs = sum(1 for li in lignes if li.statut.startswith("Enquêteur"))
    superviseurs = sum(1 for m in terrain.equipe if m.fonction.value == "superviseur")
    impressions = Impressions(lignes={
        "Badges": Rubrique(pu=imp.badge, qte=enqueteurs + superviseurs),
        "Chartes de l'enquêteur": Rubrique(pu=imp.charte, qte=enqueteurs),
        "Ordres de mission": Rubrique(pu=imp.ordre_mission, qte=enqueteurs + superviseurs),
        "Contrats et engagements de confidentialité": Rubrique(pu=imp.contrat, qte=enqueteurs)})
    f = FichePaiements(etude=terrain.etude, devise=tarifs.devise, lignes=lignes, impressions=impressions)
    return f.model_copy(update={"anomalies": controler(f)})


def _lignes_poste(e: EnqueteurPlan, terrain: PlanTerrain, jours: list[date], ajouter: Callable[..., None]) -> None:
    seuls = terrain.formation_titulaires_seuls
    if e.role is Role.RESERVE and not e.affectations:
        ajouter(e.personne, "reserve", e.id, e.ville, terrain.baremes.get("reserve"), 0)
        return
    if not e.affectations:
        ajouter(e.personne, "titulaire", e.id, e.ville, terrain.baremes.get("titulaire"), len(jours))
        return
    for k, a in enumerate(e.affectations):
        fonction = "titulaire" if k == 0 and e.role is Role.TITULAIRE else "remplacant"
        ajouter(a.personne_id, fonction, e.id, e.ville, terrain.baremes.get(fonction), _jours_tenus(jours, a.debut, a.fin),
                formation=not (seuls and fonction != "titulaire"))


def controler(f: FichePaiements) -> list[str]:
    out = []
    somme = sum(li.honoraires + li.formation.montant + li.collecte.montant + li.transport.montant + li.hebergement.montant
                + li.depouillement.montant for li in f.lignes) + sum(r.montant for r in f.impressions.lignes.values())
    if abs(somme - f.total_general) > 0.5:
        out.append(f"somme des lignes ({somme:.0f}) différente du total général ({f.total_general:.0f})")
    out += [f"{li.poste} ({li.nom}) : avance supérieure au total" for li in f.lignes if li.reste < 0]
    return out


class Devis(BaseModel):
    model_config = ConfigDict(frozen=True)
    etude: str
    devise: str
    lignes: list[tuple[str, float]]
    cout: float
    marge: float
    prix_ht: float


def devis(f: FichePaiements, tarifs: Tarifs) -> Devis:
    """Prix HT = coût / (1 − marge) : la marge est la part du prix HT qui reste au cabinet (0,25 = 25 % du prix).
    Taxes : à appliquer selon le régime fiscal du client et du cabinet (hors périmètre de ce calcul)."""
    par_rubrique: dict[str, float] = {}
    for li in f.lignes:
        for nom, montant in (("Honoraires de l'équipe", li.honoraires), ("Formation", li.formation.montant),
                             ("Collecte (jours de terrain)", li.collecte.montant), ("Transport", li.transport.montant),
                             ("Hébergement", li.hebergement.montant), ("Dépouillement", li.depouillement.montant)):
            par_rubrique[nom] = par_rubrique.get(nom, 0) + montant
    lignes = [(k, v) for k, v in par_rubrique.items() if v] + [("Impressions (badges, chartes, ordres, contrats)", f.impressions.total)]
    lignes += list(tarifs.frais_fixes.items())
    cout = sum(v for _, v in lignes)
    prix = cout / (1 - tarifs.marge)
    return Devis(etude=f.etude, devise=f.devise, lignes=lignes, cout=cout, marge=prix - cout, prix_ht=prix)
