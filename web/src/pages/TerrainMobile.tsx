import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { chiffrer, dechiffrer, derivierCle, type Coffre } from "../terrainCoffre";

type Option = { valeur: string; libelles: Record<string, string> };
type Champ = {
  cle: string;
  titre: string;
  type: string;
  obligatoire: boolean;
  section: string;
  valeur_fixe?: string;
  options: Option[];
  lignes?: Option[];
};
type FicheLocale = {
  id: string;
  debut: string;
  fin: string;
  items: { titre: string; valeur: string | string[] | null; lignes?: string[] }[];
};
type Mission = {
  enqueteur: string;
  etude: string;
  ville: { libelle: string };
  quotas: { cible: string; quota: number; realise: number; reste: number }[];
  mes_fiches: { total: number; recues_aujourdhui: number };
  formulaire: { titre: Record<string, string>; sections: { id: string; libelles: Record<string, string> }[]; champs: Champ[] };
};
type ReponseLot = { nouvelles: number; deja_recues: number; refusees: { id: string; motif: string }[]; acceptees: string[] };

const CLE_COFFRE = "dataa-terrain-coffre";
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function requete<T>(chemin: string, jeton: string, corps?: unknown): Promise<T> {
  const reponse = await fetch(`${API}${chemin}`, {
    method: corps === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${jeton}`, ...(corps === undefined ? {} : { "Content-Type": "application/json" }) },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await reponse.text();
  const donnees = texte ? JSON.parse(texte) as { detail?: string } : null;
  if (!reponse.ok) throw new Error(donnees?.detail ?? `Erreur serveur ${reponse.status}`);
  return donnees as T;
}

function nomChamp(champ: Champ): string {
  return `${champ.titre}${champ.obligatoire ? " *" : ""}`;
}

export function TerrainMobile(): ReactNode {
  const [jeton, setJeton] = useState("");
  // Lien de diffusion « /terrain#code=XXXX » : le code reste dans le fragment (jamais envoyé au serveur ni journalisé),
  // pré-remplit l'activation puis disparaît de la barre d'adresse.
  const [code, setCode] = useState(() => {
    const lu = new URLSearchParams(window.location.hash.slice(1)).get("code") ?? "";
    if (lu) window.history.replaceState(null, "", window.location.pathname);
    return lu;
  });
  const [pin, setPin] = useState("");
  const [cle, setCle] = useState<CryptoKey | null>(null);
  const [sel, setSel] = useState("");
  const [verrouillee, setVerrouillee] = useState(() => Boolean(localStorage.getItem(CLE_COFFRE)));
  const [mission, setMission] = useState<Mission | null>(null);
  const [file, setFile] = useState<FicheLocale[]>([]);
  const fileRef = useRef<FicheLocale[]>([]);
  const [valeurs, setValeurs] = useState<Record<string, string | string[]>>({});
  const [debut, setDebut] = useState(() => new Date().toISOString());
  const [connecte, setConnecte] = useState(navigator.onLine);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const sauvegarde = useRef(Promise.resolve());
  const envoiRef = useRef(false);
  const relanceRef = useRef(false);

  useEffect(() => {
    const actualiser = (): void => setConnecte(navigator.onLine);
    window.addEventListener("online", actualiser);
    window.addEventListener("offline", actualiser);
    return () => {
      window.removeEventListener("online", actualiser);
      window.removeEventListener("offline", actualiser);
    };
  }, []);

  useEffect(() => {
    if (!jeton) return;
    void requete<Mission>("/api/terrain/mission", jeton).then(async (m) => {
      setMission(m);
      if (cle && sel) {
        const coffre = await chiffrer({ file: fileRef.current, mission: m, jeton }, cle, sel);
        localStorage.setItem(CLE_COFFRE, JSON.stringify(coffre));
      }
    }).catch((e: Error) => {
      setErreur(e.message);
      if (/jeton|session.*expir/i.test(e.message)) {
        setJeton("");
        setMission(null);
      }
    });
  }, [jeton]);

  const remplacerFile = async (prochaine: FicheLocale[]): Promise<void> => {
    fileRef.current = prochaine;
    setFile(prochaine);
    if (!cle || !sel) return;
    const prochaineSauvegarde = sauvegarde.current.then(async () => {
      const coffre = await chiffrer({ file: prochaine, mission, jeton }, cle, sel);
      localStorage.setItem(CLE_COFFRE, JSON.stringify(coffre));
    });
    sauvegarde.current = prochaineSauvegarde;
    await prochaineSauvegarde;
  };

  const deverrouiller = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErreur("");
    try {
      const coffre = JSON.parse(localStorage.getItem(CLE_COFFRE) ?? "null") as Coffre | null;
      if (!coffre) throw new Error("Aucune file chiffrée à ouvrir.");
      const resultat = await dechiffrer<{ file: FicheLocale[]; mission: Mission | null; jeton: string }>(coffre, pin);
      setCle(resultat.cle);
      setSel(coffre.sel);
      fileRef.current = resultat.donnees.file;
      setFile(resultat.donnees.file);
      setMission(resultat.donnees.mission);
      setVerrouillee(false);
      setPin("");
      setJeton(resultat.donnees.jeton);
      if (resultat.donnees.jeton && navigator.onLine) {
        const m = await requete<Mission>("/api/terrain/mission", resultat.donnees.jeton);
        setMission(m);
        localStorage.setItem(CLE_COFFRE, JSON.stringify(await chiffrer({ file: resultat.donnees.file, mission: m, jeton: resultat.donnees.jeton }, resultat.cle, coffre.sel)));
      }
    } catch (e) {
      setErreur("PIN incorrect ou file locale illisible.");
    }
  };

  const activer = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErreur("");
    try {
      if (pin.length < 6) throw new Error("Le PIN doit contenir au moins 6 caractères.");
      const r = await fetch(`${API}/api/terrain/activation`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      const donnees = await r.json() as { jeton?: string; detail?: string };
      if (!r.ok || !donnees.jeton) throw new Error(donnees.detail ?? "Activation impossible.");
      const derivee = await derivierCle(pin);
      const coffre = await chiffrer({ file: [], mission: null, jeton: donnees.jeton }, derivee.cle, derivee.sel);
      localStorage.setItem(CLE_COFFRE, JSON.stringify(coffre));
      fileRef.current = [];
      setFile([]);
      setCle(derivee.cle);
      setSel(derivee.sel);
      setVerrouillee(false);
      setJeton(donnees.jeton);
      setCode("");
      setPin("");
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  const synchroniser = async (): Promise<void> => {
    if (!jeton || !connecte || !fileRef.current.length) return;
    if (envoiRef.current) {
      relanceRef.current = true;
      return;
    }
    envoiRef.current = true;
    setEnvoi(true);
    setErreur("");
    setMessage("");
    try {
      let nouvelles = 0;
      let dejaRecues = 0;
      const refusees: ReponseLot["refusees"] = [];
      const idsRefuses = new Set<string>();
      while (true) {
        const lot = fileRef.current.filter((f) => !idsRefuses.has(f.id)).slice(0, 100);
        if (!lot.length) break;
        const resultat = await requete<ReponseLot>("/api/terrain/fiches", jeton, { fiches: lot });
        const confirmees = new Set(resultat.acceptees);
        await remplacerFile(fileRef.current.filter((f) => !confirmees.has(f.id)));
        nouvelles += resultat.nouvelles;
        dejaRecues += resultat.deja_recues;
        refusees.push(...resultat.refusees);
        resultat.refusees.forEach((r) => idsRefuses.add(r.id));
        if (!resultat.acceptees.length && !resultat.refusees.length) {
          throw new Error("Le serveur n’a confirmé aucune fiche.");
        }
      }
      const prochaineMission = await requete<Mission>("/api/terrain/mission", jeton);
      setMission(prochaineMission);
      if (cle && sel) localStorage.setItem(CLE_COFFRE, JSON.stringify(await chiffrer({ file: fileRef.current, mission: prochaineMission, jeton }, cle, sel)));
      setMessage(`${nouvelles} nouvelle(s), ${dejaRecues} déjà reçue(s).`);
      if (refusees.length) setErreur(refusees.map((r) => `${r.id} : ${r.motif}`).join(" · "));
    } catch (e) {
      setErreur(`Synchronisation interrompue : ${(e as Error).message}. Les fiches restent sur cet appareil.`);
    } finally {
      envoiRef.current = false;
      setEnvoi(false);
      if (relanceRef.current) {
        relanceRef.current = false;
        window.setTimeout(() => void synchroniser(), 0);
      }
    }
  };

  useEffect(() => {
    if (connecte && jeton && file.length) void synchroniser();
  }, [connecte, jeton]);

  const changer = (cle: string, valeur: string | string[]): void => {
    setValeurs((actuelles) => ({ ...actuelles, [cle]: valeur }));
  };

  const enregistrer = (e: FormEvent): void => {
    e.preventDefault();
    if (!mission) return;
    const manquants = mission.formulaire.champs.filter((champ) => {
      if (!champ.obligatoire || champ.type === "fixe") return false;
      if (champ.lignes?.length) return champ.lignes.some((ligne) => !valeurs[`${champ.cle}:${ligne.valeur}`]);
      const valeur = valeurs[champ.cle];
      return Array.isArray(valeur) ? valeur.length === 0 : !String(valeur ?? "").trim();
    });
    if (manquants.length) {
      setErreur(`Réponse obligatoire : ${manquants.map((champ) => champ.titre).join(", ")}`);
      return;
    }
    setErreur("");
    const items = mission.formulaire.champs.map((champ) => {
      const valeur = champ.type === "fixe" ? champ.valeur_fixe ?? "" : valeurs[champ.cle] ?? "";
      if (champ.lignes?.length) {
        const selections = champ.lignes.map((ligne) => String(valeurs[`${champ.cle}:${ligne.valeur}`] ?? ""));
        return { titre: champ.titre, valeur: selections, lignes: champ.lignes.map((ligne) => ligne.valeur) };
      }
      return { titre: champ.titre, valeur };
    });
    const fiche: FicheLocale = { id: crypto.randomUUID(), debut, fin: new Date().toISOString(), items };
    void remplacerFile([...fileRef.current, fiche]);
    setValeurs({});
    setDebut(new Date().toISOString());
    setMessage("Fiche enregistrée sur cet appareil.");
    if (connecte) window.setTimeout(() => void synchroniser(), 0);
  };

  if (verrouillee) return <main className="terrain-mobile">
    <h1>DATA'A · Terrain</h1><p>Déverrouiller la file locale</p>
    <form onSubmit={(e) => void deverrouiller(e)}>
      <label htmlFor="pin-deverrouillage">PIN de l’appareil</label>
      <input id="pin-deverrouillage" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} required />
      <button type="submit">Déverrouiller</button>
    </form>
    {erreur && <p role="alert">{erreur}</p>}
  </main>;

  if (!jeton) return <main className="terrain-mobile">
    <h1>DATA'A · Terrain</h1>
    <p>Activation de mission</p>
    <form onSubmit={(e) => void activer(e)}>
      <label htmlFor="code-mission">Code de mission</label>
      <input id="code-mission" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} required />
      <label htmlFor="pin-mission">Créer un PIN local (6 caractères minimum)</label>
      <input id="pin-mission" type="password" inputMode="numeric" autoComplete="new-password" minLength={6} value={pin} onChange={(e) => setPin(e.target.value)} required />
      <button type="submit">Activer</button>
    </form>
    {erreur && <p role="alert">{erreur}</p>}
  </main>;

  if (!mission) return <main className="terrain-mobile"><p role="status">Chargement de la mission…</p>{erreur && <p role="alert">{erreur}</p>}</main>;

  const groupes = new Map<string, Champ[]>();
  for (const champ of mission.formulaire.champs) {
    const groupe = groupes.get(champ.section) ?? [];
    groupe.push(champ);
    groupes.set(champ.section, groupe);
  }

  const champUI = (champ: Champ): ReactNode => {
    if (champ.type === "fixe") return <p className="terrain-fixe" key={champ.cle}><span>{champ.titre}</span><strong>{champ.valeur_fixe}</strong></p>;
    const valeur = valeurs[champ.cle];
    const options = champ.options ?? [];
    let controle: ReactNode;
    if (champ.lignes?.length) {
      controle = <div className="terrain-grille">{champ.lignes.map((ligne) => <label key={ligne.valeur}>{ligne.libelles.fr ?? ligne.valeur}
        <select required={champ.obligatoire} value={String(valeurs[`${champ.cle}:${ligne.valeur}`] ?? "")} onChange={(e) => changer(`${champ.cle}:${ligne.valeur}`, e.target.value)}>
          <option value="">Choisir…</option>{options.map((option) => <option key={option.valeur} value={option.valeur}>{option.libelles.fr ?? option.valeur}</option>)}
        </select>
      </label>)}</div>;
    } else if (options.length && champ.type.includes("multiple")) {
      const selection = Array.isArray(valeur) ? valeur : [];
      controle = <div className="terrain-options">{options.map((option) => <label key={option.valeur}>
        <input type="checkbox" checked={selection.includes(option.valeur)} onChange={(e) => changer(champ.cle, e.target.checked ? [...selection, option.valeur] : selection.filter((v) => v !== option.valeur))} />
        {option.libelles.fr ?? option.valeur}
      </label>)}</div>;
    } else if (options.length) {
      controle = <select required={champ.obligatoire} value={typeof valeur === "string" ? valeur : ""} onChange={(e) => changer(champ.cle, e.target.value)}>
        <option value="">Choisir…</option>{options.map((option) => <option key={option.valeur} value={option.valeur}>{option.libelles.fr ?? option.valeur}</option>)}
      </select>;
    } else {
      controle = champ.type === "texte" ? <textarea required={champ.obligatoire} value={typeof valeur === "string" ? valeur : ""} onChange={(e) => changer(champ.cle, e.target.value)} />
        : <input required={champ.obligatoire} type={champ.type === "numerique" ? "number" : "text"} value={typeof valeur === "string" ? valeur : ""} onChange={(e) => changer(champ.cle, e.target.value)} />;
    }
    return <label className="terrain-champ" key={champ.cle}>{nomChamp(champ)}{controle}</label>;
  };

  return <main className="terrain-mobile">
    <header className="terrain-entete"><div><small>{mission.etude}</small><h1>{mission.enqueteur} · {mission.ville.libelle}</h1></div>
      <span className={connecte ? "terrain-etat en-ligne" : "terrain-etat"}>{connecte ? "En ligne" : "Hors ligne"}</span>
    </header>
    <section aria-label="Suivi mission" className="terrain-suivi">
      <span>{mission.mes_fiches.total} fiches reçues</span><span>{mission.mes_fiches.recues_aujourdhui} aujourd’hui</span><span>{file.length} en attente</span>
    </section>
    <section className="terrain-quotas" aria-label="Quotas restants"><h2>Quotas</h2>{mission.quotas.map((q) => <div key={q.cible}><span>{q.cible}</span><strong>{q.reste} / {q.quota}</strong></div>)}</section>
    <form className="terrain-formulaire" onSubmit={enregistrer}>
      <h2>{mission.formulaire.titre.fr ?? "Nouvelle fiche"}</h2>
      {[...groupes.entries()].map(([section, champs]) => <fieldset key={section}><legend>{mission.formulaire.sections.find((s) => s.id === section)?.libelles.fr ?? section}</legend>{champs.map(champUI)}</fieldset>)}
      <button type="submit">Enregistrer la fiche</button>
    </form>
    <section className="terrain-synchronisation">
      <button type="button" onClick={() => void synchroniser()} disabled={!connecte || !file.length || envoi}>{envoi ? "Envoi…" : `Synchroniser (${file.length})`}</button>
      {message && <p role="status">{message}</p>}{erreur && <p role="alert">{erreur}</p>}
    </section>
  </main>;
}