// Types et outils de l'éditeur du dictionnaire. Le serveur reste juge : il valide le dictionnaire complet (modèle,
// cohérence avec le brief et les plans, diagnostic du formulaire) ; ces outils évitent seulement les erreurs évidentes.
export type Textes = Record<string, string>;
export type Modalite = { code: number; libelles: Textes; alias?: string[]; variable?: string | null };
export type Autre = { code: number; libelles: Textes; variable: string; longueur?: number };
export type LigneGrille = { variable: string; libelles: Textes };
export type Question = {
  numero: number; code: string; section: string; libelles: Textes; type: string; mesure?: string | null; obligatoire: boolean;
  aide: Textes; modalites: Modalite[]; autre?: Autre | null; lignes: LigneGrille[]; condition?: string | null;
  role?: string | null; prerempli?: string | null; longueur?: number;
};
export type Section = { id: string; libelles: Textes };
export type Regle = { code: string; expression: string; description: Textes };
export type Dictionnaire = {
  langue_reference: string; langues: string[]; titre: Textes; sections: Section[]; questions: Question[];
  regles_coherence: Regle[]; [cle: string]: unknown;
};
export type Changement = { type: string; question: string; detail: string; migration: boolean };
export type Vue = {
  version: string; statut: string; etude: string; langue_reference: string; nb_fiches: number; modifiable: boolean;
  dictionnaire: Dictionnaire; ecarts: string[]; changements?: Changement[]; alertes?: string[];
};
export type Verification = {
  valide: boolean; version_suivante: string; erreurs: string[]; blocages: string[]; alertes: string[]; changements: Changement[];
};

export const TYPES: Record<string, string> = {
  choix_unique: "Choix unique", choix_multiple: "Choix multiple", grille: "Grille", texte: "Texte libre", numerique: "Numérique", date: "Date",
};
export const MESURES = ["NOMINAL", "ORDINAL", "SCALE"];
export const AVEC_MODALITES = new Set(["choix_unique", "choix_multiple", "grille"]);
const RESERVEES = new Set(["NUMFICHE", "CODEENQU", "CODEZONE", "QUARTIER", "SITEENQU", "DATEENQU", "HEUREENQ", "DELAIPRE", "ACCRECON",
  "ANOMALIE", "STATUTQC"]);
const MOTS_VIDES = new Set(["de", "du", "des", "le", "la", "les", "l", "d", "un", "une", "a", "au", "aux", "et", "en", "pour", "par",
  "vous", "votre", "selon", "est", "ce", "qui", "quel", "quelle", "que", "sur", "avec"]);
export const CODE_VARIABLE = /^[A-Z]{8}$/;

export const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Toutes les variables déjà prises par le dictionnaire (codes, variables des choix multiples, lignes, « Autre »). */
export function variablesPrises(d: Dictionnaire): Set<string> {
  const pris = new Set<string>(RESERVEES);
  for (const q of d.questions) {
    pris.add(q.code);
    q.modalites.forEach((m) => m.variable && pris.add(m.variable));
    q.lignes.forEach((l) => pris.add(l.variable));
    if (q.autre) pris.add(q.autre.variable);
  }
  return pris;
}

/** Code de 8 lettres formé des initiales des mots significatifs (convention V11), rendu unique (même règle que le serveur). */
export function proposerCode(libelle: string, pris: Set<string>): string {
  const mots = (libelle.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((m) => !MOTS_VIDES.has(m));
  const base = ((mots.map((m) => m.slice(0, 2)).join("") || "question").toUpperCase() + "XXXXXXXX").slice(0, 8);
  let code = base;
  for (let i = 1; pris.has(code); i += 1) {
    code = base.slice(0, 6) + String(i).padStart(2, "0").replace(/\d/g, (c) => "ABCDEFGHIJ"[Number(c)]);
  }
  pris.add(code);
  return code;
}

/** Prochain code de modalité libre, en sautant les codes spéciaux (97, 98, 99) et le code « Autre ». */
export function prochainCode(q: Question): number {
  const pris = new Set([...q.modalites.map((m) => m.code), ...(q.autre ? [q.autre.code] : []), 97, 98, 99]);
  let c = 1;
  while (pris.has(c)) c += 1;
  return c;
}

/** Numéros 1…n dans l'ordre d'affichage : l'ordre du tableau fait foi. */
export const renumeroter = (qs: Question[]): Question[] => qs.map((q, i) => ({ ...q, numero: i + 1 }));

/** Met une question en conformité avec son type (mesure, variables des choix multiples, lignes de grille, « Autre »). */
export function conformerAuType(q: Question, type: string, d: Dictionnaire): Question {
  const pris = variablesPrises(d);
  const lr = d.langue_reference;
  const x: Question = { ...q, type };
  if (!AVEC_MODALITES.has(type)) {
    x.modalites = []; x.lignes = []; x.autre = null; x.mesure = type === "numerique" ? "SCALE" : null;
    return x;
  }
  if (!x.modalites.length) x.modalites = [{ code: 1, libelles: { [lr]: "Modalité 1" } }];
  if (type === "choix_multiple") {
    x.modalites = x.modalites.map((m) => ({ ...m, variable: m.variable ?? proposerCode(`${q.libelles[lr] ?? ""} ${m.libelles[lr] ?? ""}`, pris) }));
    x.mesure = null; x.autre = null;
  } else {
    x.modalites = x.modalites.map(({ variable: _v, ...m }) => m);
    x.mesure = x.mesure ?? "NOMINAL";
  }
  if (type === "grille") {
    x.autre = null;
    if (!x.lignes.length) x.lignes = [{ variable: proposerCode(`${q.libelles[lr] ?? ""} ligne`, pris), libelles: { [lr]: "Ligne 1" } }];
  } else x.lignes = [];
  return x;
}

/** Corps envoyé au serveur : retire les champs vides que le modèle strict n'accepte pas sous cette forme. */
export function nettoyer(d: Dictionnaire): Dictionnaire {
  return {
    ...d,
    questions: d.questions.map((q) => {
      const x: Question = { ...q, condition: q.condition?.trim() ? q.condition.trim() : null };
      if (q.type !== "choix_multiple") x.modalites = q.modalites.map(({ variable: _v, ...m }) => m);
      return x;
    }),
  };
}
