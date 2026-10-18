// Client de l'API de la console usine (backend/src/plateforme/api/app.py).
// Les types ne décrivent que les champs affichés ; la source de vérité reste le moteur Python.

export type Textes = Record<string, string>;

export interface ResumeProjet {
  id: string;
  etude: string;
  titre: Textes;
  version_dictionnaire: string;
  statut_dictionnaire: string;
  langues: string[];
  questions: number;
  variables: number;
  colonnes_masque: number;
  villes: { id: string; libelle: string; prefixe: string }[];
  postes: number;
  reserves: number;
  objectif_total: number | null;
  jours: string[];
  quota_total: number;
}

export interface Modalite { code: number; libelles: Textes }
export interface Question {
  numero: string;
  code: string;
  section: string;
  libelles: Textes;
  type: string;
  mesure: string | null;
  obligatoire: boolean;
  modalites: Modalite[];
}
export interface Dictionnaire {
  etude: string;
  version: string;
  statut: string;
  langues: string[];
  sections: { id: string; libelles: Textes }[];
  questions: Question[];
  regles_coherence: { code: string; expression: string }[];
  codes_speciaux: { non_applicable: number; ne_sait_pas: number; non_reponse: number; libelles: Record<string, Textes> };
  nb_variables: Record<string, number>;
}

export interface Diagnostic {
  verdict: string;
  blocages: number;
  alertes: number;
  chemin_sans_cible: string[] | null;
  lignes: { element: string; statut: string; detail: string }[];
}

export interface Difference {
  ancienne: string;
  nouvelle: string;
  migration: number;
  ecarts: { type: string; question: string; detail: string; migration: boolean }[];
  texte: string;
}

export interface Affectation { personne: string; debut: string | null; fin: string | null; sortie: string; demarrage: string }
export interface EnqueteurPlan { id: string; ville: string | null; role: "titulaire" | "reserve"; affectations: Affectation[] }
export interface Terrain {
  etude: string;
  fuseau: string;
  villes: { code: number; id: string; libelle: string; prefixe: string }[];
  enqueteurs: EnqueteurPlan[];
  objectif_total: number | null;
  jours: string[];
  objectif_jour: number;
  nb_jours: number;
  seuil_delai_min: number;
  seuil_volume_jour: number;
  quotas: { code: number; cible: string; villes: Record<string, number>; total: number }[];
}

export interface Lien { id: string; ville: string | null; role: string; lien: string; qr_png: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Analyse {
  projet: string;
  jour: string;
  maintenant: string;
  reponses: number;
  fiches: number;
  note_de_base: { texte: string; collectees: number; retenues: number; valides: number; ecartees: Record<string, number> };
  tableau_de_bord: {
    lignes: Record<string, any>[];
    hors_liste: number;
    total: Record<string, any>;
    zones: Record<string, any>[];
    total_zones: Record<string, any>;
    sans_cible: number;
  };
  suivi_cibles: {
    quotas: { code: number; cible: string; villes: { quota: number; realise: number; part: any }[]; total: { quota: number; realise: number; part: any } }[];
    total: { villes: { quota: number; realise: number; part: any }[]; total: { quota: number; realise: number; part: any } };
  };
  recap_jours: Record<string, any[]>;
  rapport: {
    partiel: boolean;
    jour: string;
    synthese: any[][];
    recos: string[][];
    villes: Record<string, any>[];
    classement: Record<string, any>[];
    cibles: Record<string, any>[];
    nonRep: { q: string; n: number; tx: any }[];
    heures: any[][];
  };
  statut: null | {
    postes: number;
    objectif_total: number;
    objectif_poste: number;
    vue: Record<string, any>;
    atteints: LigneStatut[];
    non_atteints: LigneStatut[];
    sortis: LigneStatut[];
    remplacants: LigneStatut[];
  };
  qualite: {
    statuts: Record<string, number>;
    anomalies: Record<string, number>;
    a_verifier: { numfiche: string; enqueteur: string; date: string; heure: string; anomalies: string[]; statut: string }[];
    rappels: { numfiche: string; enqueteur: string; priorite: number; motif: string }[];
    graine_rappels: number;
  };
  effet_enqueteur: {
    tests: number;
    signales: { groupe: string; enqueteur: string; variable: string; libelle: string; n: number; p_corrige: number; w: number;
      modalite: string; part_enqueteur: number; part_attendue: number }[];
  };
}
export interface LigneStatut {
  poste: string; personne: string; ville: string; jours: (number | null)[]; fiches: number; cumul_poste: number; part: number; reste: number;
  sortie: string; demarrage: string; note: string;
}

async function lire<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let detail = `${r.status} ${r.statusText}`;
    try {
      const corps = await r.json();
      if (corps?.detail) detail = typeof corps.detail === "string" ? corps.detail : JSON.stringify(corps.detail);
    } catch {
      /* corps non JSON */
    }
    throw new Error(detail);
  }
  return (await r.json()) as T;
}

export const obtenir = <T,>(chemin: string): Promise<T> => fetch(`/api${chemin}`).then((r) => lire<T>(r));

export const envoyerJson = <T,>(chemin: string, corps: unknown): Promise<T> =>
  fetch(`/api${chemin}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }).then((r) =>
    lire<T>(r),
  );

export interface Envoi {
  tableur: File;
  decisions: File | null;
  onglet: string;
  maintenant: string;
  graine: number;
}

function formulaire(e: Envoi): FormData {
  const f = new FormData();
  f.append("tableur", e.tableur);
  if (e.decisions) f.append("decisions", e.decisions);
  f.append("onglet", e.onglet);
  if (e.maintenant) f.append("maintenant", e.maintenant);
  f.append("graine", String(e.graine));
  return f;
}

export const analyser = (projet: string, e: Envoi): Promise<Analyse> =>
  fetch(`/api/projets/${projet}/suivi`, { method: "POST", body: formulaire(e) }).then((r) => lire<Analyse>(r));

/** Télécharge une archive produite par l'API (POST avec le tableur, ou GET). */
export async function telecharger(chemin: string, nom: string, e?: Envoi): Promise<void> {
  const r = await fetch(`/api${chemin}`, e ? { method: "POST", body: formulaire(e) } : undefined);
  if (!r.ok) await lire(r);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}
