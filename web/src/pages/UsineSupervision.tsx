import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, EnTete, Kpi } from "../ui";

type Projet = { id: string; code: string; nom: string; statut: string; organisation: string };
type Mission = { id: string; enqueteur: string; actif: boolean; fiches: number };

export function UsineSupervision(): ReactNode {
  const [lignes, setLignes] = useState<{ projet: Projet; missions: Mission[] }[]>([]);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    api<Projet[]>("/api/usine/projets").then(async (projets) => {
      const detail = await Promise.all(projets.filter((p) => p.statut !== "livre").map(async (projet) => ({ projet, missions: await api<Mission[]>(`/api/usine/projets/${projet.id}/missions`).catch(() => []) })));
      setLignes(detail);
    }).catch((e: Error) => setErreur(e.message));
  }, []);
  const missions = lignes.flatMap((x) => x.missions);
  const fiches = missions.reduce((s, m) => s + m.fiches, 0);
  return <>
    <EnTete titre="Supervision terrain" sous_titre="Vue consultant junior : suivre les enquêteurs, les fiches et les alertes de collecte." />
    {erreur && <p className="erreur" role="alert">{erreur}</p>}
    <div className="kpis"><Kpi icone="projets" etiquette="Études actives" valeur={lignes.length} /><Kpi icone="clients" etiquette="Missions" valeur={missions.length} detail={`${missions.filter((m) => m.actif).length} actives`} /><Kpi icone="fiches" etiquette="Fiches reçues" valeur={fiches} /><Kpi icone="audit" etiquette="À surveiller" valeur={missions.filter((m) => !m.actif).length} detail="missions révoquées" /></div>
    <div className="tableau"><table aria-label="Supervision terrain"><thead><tr><th>Projet</th><th>Client</th><th>Enquêteurs</th><th className="nombre">Fiches</th><th>État</th><th /></tr></thead><tbody>
      {lignes.length === 0 && <tr><td colSpan={6} className="vide">Aucune mission terrain active.</td></tr>}
      {lignes.map(({ projet, missions: ms }) => <tr key={projet.id}><td><strong>{projet.nom}</strong><br /><code>{projet.code}</code></td><td>{projet.organisation}</td><td>{ms.length}</td><td className="nombre">{ms.reduce((s, m) => s + m.fiches, 0)}</td><td>{ms.some((m) => !m.actif) ? <Badge ton="alerte">À vérifier</Badge> : <Badge ton="ok">Opérationnel</Badge>}</td><td><Link className="bouton" to="/usine">Ouvrir</Link></td></tr>)}
    </tbody></table></div>
  </>;
}
