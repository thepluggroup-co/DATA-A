// Client de l'API DATA'A : cookie de session HttpOnly (envoyé par le navigateur) et jeton CSRF en en-tête pour toute
// écriture. Les erreurs remontent avec le message du serveur, en français.
export type Moi = {
  id: string; nom: string; email: string; role: string; organisation: string; organisation_type: string;
  csrf: string; second_facteur_requis: boolean;
  permissions?: string[];
};

let csrf = "";
export function retenirCsrf(jeton: string): void { csrf = jeton; }

export class ErreurApi extends Error {
  constructor(public statut: number, message: string, public corps: unknown = null) { super(message); }
}

export async function api<T>(chemin: string, options: { methode?: string; corps?: unknown } = {}): Promise<T> {
  const methode = options.methode ?? "GET";
  const entetes: Record<string, string> = {};
  if (options.corps !== undefined) entetes["Content-Type"] = "application/json";
  if (methode !== "GET") entetes["X-CSRF-Token"] = csrf;
  const r = await fetch(chemin, {
    method: methode, credentials: "same-origin", headers: entetes,
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
  });
  const texte = await r.text();
  const donnees = texte ? JSON.parse(texte) : null;
  if (!r.ok) {
    const message = donnees?.motif ?? donnees?.detail ?? `erreur ${r.status}`;
    throw new ErreurApi(r.status, typeof message === "string" ? message : JSON.stringify(message), donnees);
  }
  return donnees as T;
}

export const fcfa = (x: number): string => `${Math.round(x).toLocaleString("fr-FR")} FCFA`;
export const pct = (x: number | null): string => (x === null ? "—" : `${x.toFixed(1).replace(".", ",")} %`);
