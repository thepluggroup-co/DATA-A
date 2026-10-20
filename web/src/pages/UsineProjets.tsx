import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { Badge, EnTete, Kpi, StatutProjet } from "../ui";

type Projet = { id: string; code: string; nom: string; statut: string; organisation: string };
type Livrable = { id: string; nom: string; partage_client: boolean };
type Mission = { id: string; enqueteur: string; actif: boolean; fiches: number };
type Organisation = { id: string; nom: string; type: string };

function Missions({ p }: { p: Projet }): ReactNode {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState("");
  const charger = (): void => { api<Mission[]>(`/api/usine/projets/${p.id}/missions`).then(setMissions).catch(() => setMissions([])); };
  useEffect(charger, [p.id]);
  const creer = async (): Promise<void> => {
    try {
      const r = await api<{ codes: Record<string, string> }>(`/api/usine/projets/${p.id}/missions`, { methode: "POST" });
      setCodes(r.codes);
      charger();
    } catch (err) {
      setErreur((err as Error).message);
    }
  };
  const basculer = async (m: Mission): Promise<void> => {
    await api(`/api/usine/missions/${m.id}`, { methode: "PATCH", corps: { actif: !m.actif } });
    charger();
  };
  return (
    <section aria-label="Missions terrain">
      <h2>Missions terrain (application enquêteur)</h2>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="secondaire" onClick={() => void creer()}>Générer les codes de mission manquants</button>
        <span className="mention">Un code par poste du plan de terrain ; affiché une seule fois, à imprimer sur l'ordre de mission.</span>
      </div>
      {Object.keys(codes).length > 0 && (
        <div className="succes" role="status">
          Codes à remettre aux enquêteurs (non récupérables ensuite) :
          <ul>{Object.entries(codes).map(([e, c]) => <li key={e}><strong>{e}</strong> : <code>{c}</code></li>)}</ul>
        </div>
      )}
      <div className="tableau">
        <table aria-label="Missions du projet">
          <thead><tr><th>Poste</th><th>État</th><th className="nombre">Fiches reçues</th><th /></tr></thead>
          <tbody>
            {missions.length === 0 && <tr><td colSpan={4} className="vide">Aucune mission créée.</td></tr>}
            {missions.map((m) => (
              <tr key={m.id}><td>{m.enqueteur}</td><td>{m.actif ? <Badge ton="ok">Active</Badge> : <Badge ton="alerte">Révoquée</Badge>}</td>
                <td className="nombre">{m.fiches}</td>
                <td><button className="secondaire" aria-label={`${m.actif ? "Révoquer" : "Réactiver"} ${m.enqueteur}`}
                            onClick={() => void basculer(m)}>{m.actif ? "Révoquer" : "Réactiver"}</button></td></tr>))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetailProjet({ p }: { p: Projet }): ReactNode {
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [ecarts, setEcarts] = useState<string[]>([]);
  const [livrables, setLivrables] = useState<Livrable[]>([]);
  const [occupe, setOccupe] = useState(false);
  const charger = (): void => { api<Livrable[]>(`/api/projets/${p.id}/livrables`).then(setLivrables).catch(() => setLivrables([])); };
  useEffect(charger, [p.id]);
  const action = async (quoi: "verifier" | "documents"): Promise<void> => {
    setOccupe(true);
    setMessage(null);
    setEcarts([]);
    try {
      if (quoi === "verifier") {
        const r = await api<{ coherent: boolean; ecarts: string[] }>(`/api/usine/projets/${p.id}/verifier`, { methode: "POST" });
        setMessage({ ok: r.coherent, texte: r.coherent ? "Sources du projet cohérentes." : "Sources incohérentes :" });
        setEcarts(r.ecarts);
      } else {
        const r = await api<{ documents: number }>(`/api/usine/projets/${p.id}/documents`, { methode: "POST" });
        setMessage({ ok: true, texte: `${r.documents} documents générés.` });
        charger();
      }
    } catch (err) {
      setMessage({ ok: false, texte: (err as Error).message });
    } finally {
      setOccupe(false);
    }
  };
  const partager = async (l: Livrable): Promise<void> => {
    await api(`/api/usine/livrables/${l.id}`, { methode: "PATCH", corps: { partage_client: !l.partage_client } });
    charger();
  };
  const partages = livrables.filter((l) => l.partage_client).length;
  return (
    <div className="panneau" aria-label={`Projet ${p.code}`}>
      <div className="actions" style={{ justifyContent: "space-between", marginTop: 0 }}>
        <div>
          <h2>{p.nom}</h2>
          <p className="mention" style={{ margin: 0 }}>{p.organisation} · {p.code} · <StatutProjet statut={p.statut} /></p>
        </div>
        <div className="actions">
          <button disabled={occupe} onClick={() => void action("verifier")}>Vérifier la cohérence</button>
          <button disabled={occupe} onClick={() => void action("documents")}>Générer les documents</button>
        </div>
      </div>
      {occupe && <p role="status" className="mention">Traitement en cours…</p>}
      {message && <p className={message.ok ? "succes" : "erreur"} role="status">{message.texte}</p>}
      {ecarts.length > 0 && <ul>{ecarts.map((e, k) => <li key={k}>{e}</li>)}</ul>}
      <div className="grille-2">
        <section aria-label="Livrables">
          <h2>Livrables ({partages} partagé{partages > 1 ? "s" : ""} / {livrables.length})</h2>
          <div className="tableau">
            <table aria-label="Livrables du projet">
              <thead><tr><th>Livrable</th><th>Client</th><th /></tr></thead>
              <tbody>
                {livrables.length === 0 && <tr><td colSpan={3} className="vide">Aucun livrable : générez les documents.</td></tr>}
                {livrables.map((l) => (
                  <tr key={l.id}><td><a href={`/api/livrables/${l.id}`}>{l.nom}</a></td>
                    <td>{l.partage_client ? <Badge ton="ok">Partagé</Badge> : <Badge ton="neutre">Interne</Badge>}</td>
                    <td><button className="secondaire" aria-label={`${l.partage_client ? "Retirer" : "Partager"} ${l.nom}`}
                                onClick={() => void partager(l)}>{l.partage_client ? "Retirer" : "Partager"}</button></td></tr>))}
              </tbody>
            </table>
          </div>
        </section>
        <Missions p={p} />
      </div>
    </div>
  );
}

export function UsineProjets(): ReactNode {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [choisi, setChoisi] = useState<Projet | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    Promise.all([api<Projet[]>("/api/usine/projets"), api<Organisation[]>("/api/usine/organisations")])
      .then(([p, o]) => { setProjets(p); setOrgs(o); })
      .catch((e: Error) => setErreur(e.message));
  }, []);
  const parStatut = (s: string): number => projets.filter((p) => p.statut === s).length;
  return (
    <>
      <EnTete titre="File des projets" sous_titre="Pilotage des études : cohérence des sources, documents, terrain et livraison." />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="kpis">
        <Kpi icone="projets" etiquette="Projets" valeur={projets.length} detail={`${parStatut("livre")} livré(s)`} />
        <Kpi icone="brief" etiquette="Briefs à traiter" valeur={parStatut("brief")} detail="en attente de cadrage" />
        <Kpi icone="fiches" etiquette="En préparation" valeur={parStatut("documents")} detail="documents générés" />
        <Kpi icone="clients" etiquette="Clients" valeur={orgs.filter((o) => o.type === "client").length} detail="organisations actives" />
      </div>
      <div className="tableau">
        <table aria-label="File des projets">
          <thead><tr><th>Client</th><th>Projet</th><th>Code</th><th>Statut</th><th /></tr></thead>
          <tbody>{projets.map((p) => (
            <tr key={p.id} style={choisi?.id === p.id ? { background: "rgba(21,234,224,0.06)" } : undefined}>
              <td>{p.organisation}</td><td>{p.nom}</td><td><code>{p.code}</code></td><td><StatutProjet statut={p.statut} /></td>
              <td><button className="secondaire" aria-label={`Ouvrir ${p.code}`} onClick={() => setChoisi(p)}>Ouvrir</button></td></tr>))}
          </tbody>
        </table>
      </div>
      {choisi && <DetailProjet key={choisi.id} p={choisi} />}
    </>
  );
}
