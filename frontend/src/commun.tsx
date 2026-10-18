import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { obtenir, type Analyse, type Envoi } from "./api";

export const pct = (x: unknown, decimales = 0): string =>
  typeof x === "number" && Number.isFinite(x) ? `${(x * 100).toFixed(decimales).replace(".", ",")} %` : "—";
export const nb = (x: unknown): string =>
  typeof x === "number" && Number.isFinite(x) ? (Number.isInteger(x) ? x.toLocaleString("fr-FR") : x.toLocaleString("fr-FR", { maximumFractionDigits: 1 })) : String(x ?? "—");
export const dateFr = (iso: string): string => (iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);

/** Appel GET avec état de chargement et d'erreur. */
export function useDonnees<T>(chemin: string | null): { donnees: T | null; erreur: string | null; charge: boolean } {
  const [etat, setEtat] = useState<{ donnees: T | null; erreur: string | null; charge: boolean }>({ donnees: null, erreur: null, charge: !!chemin });
  useEffect(() => {
    if (!chemin) return;
    let vivant = true;
    setEtat({ donnees: null, erreur: null, charge: true });
    obtenir<T>(chemin)
      .then((d) => vivant && setEtat({ donnees: d, erreur: null, charge: false }))
      .catch((e: Error) => vivant && setEtat({ donnees: null, erreur: e.message, charge: false }));
    return () => {
      vivant = false;
    };
  }, [chemin]);
  return etat;
}

export function Etat({ charge, erreur }: { charge: boolean; erreur: string | null }) {
  if (charge) return <p className="chargement">Chargement…</p>;
  if (erreur) return <div className="bandeau erreur">Erreur de l’API : {erreur}</div>;
  return null;
}

export function Barre({ part }: { part: number }) {
  const p = Math.max(0, Math.min(1, Number.isFinite(part) ? part : 0));
  return (
    <div className={`barre${p >= 1 ? " pleine" : ""}`} role="img" aria-label={pct(p)}>
      <span style={{ width: `${p * 100}%` }} />
    </div>
  );
}

/** Logo DATA'A redessiné en vectoriel : à remplacer par le fichier officiel (public/logo.svg) dès qu'il est fourni. */
export function Logo({ taille = 34 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="degrade-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1F4FE0" />
          <stop offset="1" stopColor="#19C3E6" />
        </linearGradient>
      </defs>
      <path d="M6 6h24c16 0 28 11.5 28 26S46 58 30 58H10l7-9h13c11 0 19-7.6 19-17S41 15 30 15H13z" fill="url(#degrade-logo)" />
      <rect x="17" y="37" width="6" height="12" rx="1" fill="#19C3E6" />
      <rect x="26" y="30" width="6" height="19" rx="1" fill="#3D7BFF" />
      <rect x="35" y="22" width="6" height="27" rx="1" fill="#19C3E6" />
    </svg>
  );
}

/** Dernière analyse du suivi et fichiers envoyés (gardés en mémoire du navigateur, jamais sur le serveur). */
interface Session {
  projet: string;
  setProjet: (p: string) => void;
  analyse: Analyse | null;
  envoi: Envoi | null;
  memoriser: (a: Analyse | null, e: Envoi | null) => void;
}
const Contexte = createContext<Session | null>(null);

export function FournisseurSession({ children, projetInitial }: { children: ReactNode; projetInitial: string }) {
  const [projet, setProjetBrut] = useState(projetInitial);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [envoi, setEnvoi] = useState<Envoi | null>(null);
  const setProjet = (p: string) => {
    setProjetBrut(p);
    setAnalyse(null);
    setEnvoi(null);
  };
  const memoriser = (a: Analyse | null, e: Envoi | null) => {
    setAnalyse(a);
    setEnvoi(e);
  };
  return <Contexte.Provider value={{ projet, setProjet, analyse, envoi, memoriser }}>{children}</Contexte.Provider>;
}

export function useSession(): Session {
  const s = useContext(Contexte);
  if (!s) throw new Error("FournisseurSession manquant");
  return s;
}

export function SansAnalyse() {
  return (
    <div className="vide">
      Aucune réponse chargée. Ouvrez <a href="#/suivi">Suivi temps réel</a> et envoyez l’export .xlsx du classeur de réponses.
    </div>
  );
}
