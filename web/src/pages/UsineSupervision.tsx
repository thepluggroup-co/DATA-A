import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, EnTete, Kpi } from "../ui";

type Projet = { id: string; code: string; nom: string; statut: string; organisation: string };
type Mission = { id: string; enqueteur: string; actif: boolean; fiches: number };
type Qualite = { score_global: number; fiches_trop_rapides: number; signalements_ouverts: number };

export function UsineSupervision(): ReactNode {
  const [lignes, setLignes] = useState<{ projet: Projet; missions: Mission[] }[]>([]);
  const [erreur, setErreur] = useState("");
  const [qualites, setQualites] = useState<Record<string, Qualite>>({});
  useEffect(() => {
    api<Projet[]>("/api/usine/projets").then(async (projets) => {
      const detail = await Promise.all(projets.filter((p) => p.statut !== "livre").map(async (projet) => ({ projet, missions: await api<Mission[]>(`/api/usine/projets/${projet.id}/missions`).catch(() => []) })));
      const q = await Promise.all(detail.map(async ({ projet }) => [projet.id, await api<Qualite>(`/api/cabinet/projets/${projet.id}/qualite-terrain`).catch(() => ({ score_global: 0, fiches_trop_rapides: 0, signalements_ouverts: 0 }))] as const)); setQualites(Object.fromEntries(q));
      setLignes(detail);
    }).catch((e: Error) => setErreur(e.message));
  }, []);
  const missions = lignes.flatMap((x) => x.missions);
  const fiches = missions.reduce((s, m) => s + m.fiches, 0);
  const qualiteRows = Object.values(qualites);
  const scoreQualite = qualiteRows.length ? Math.round(qualiteRows.reduce((total, row) => total + row.score_global, 0) / qualiteRows.length) : 0;
  const fichesRapides = qualiteRows.reduce((total, row) => total + row.fiches_trop_rapides, 0);
  const signalements = qualiteRows.reduce((total, row) => total + row.signalements_ouverts, 0);
  return <>
    <EnTete titre="Supervision terrain" sous_titre="Vue consultant junior : suivre les enquÃªteurs, les fiches et les alertes de collecte." />
    {erreur && <p className="erreur" role="alert">{erreur}</p>}
    <div className="kpis"><Kpi icone="projets" etiquette="Ã‰tudes actives" valeur={lignes.length} /><Kpi icone="clients" etiquette="Missions" valeur={missions.length} detail={`${missions.filter((m) => m.actif).length} actives`} /><Kpi icone="fiches" etiquette="Fiches reÃ§ues" valeur={fiches} /><Kpi icone="audit" etiquette="Ã€ surveiller" valeur={missions.filter((m) => !m.actif).length} detail="missions rÃ©voquÃ©es" /></div>
    <section className="panneau"><h2>Qualité terrain</h2><div className="kpis"><Kpi icone="bouclier" etiquette="Score global" valeur={`${scoreQualite}%`} detail="calculé par fiche" /><Kpi icone="audit" etiquette="Fiches trop rapides" valeur={fichesRapides} /><Kpi icone="alerte" etiquette="Signalements ouverts" valeur={signalements} /></div></section>
    <div className="tableau"><table aria-label="Supervision terrain"><thead><tr><th>Projet</th><th>Client</th><th>EnquÃªteurs</th><th className="nombre">Fiches</th><th>Ã‰tat</th><th /></tr></thead><tbody>
      {lignes.length === 0 && <tr><td colSpan={6} className="vide">Aucune mission terrain active.</td></tr>}
      {lignes.map(({ projet, missions: ms }) => <tr key={projet.id}><td><strong>{projet.nom}</strong><br /><code>{projet.code}</code></td><td>{projet.organisation}</td><td>{ms.length}</td><td className="nombre">{ms.reduce((s, m) => s + m.fiches, 0)}</td><td>{ms.some((m) => !m.actif) ? <Badge ton="alerte">Ã€ vÃ©rifier</Badge> : <Badge ton="ok">OpÃ©rationnel</Badge>}</td><td><Link className="bouton" to="/usine">Ouvrir</Link></td></tr>)}
    </tbody></table></div>
  </>;
}


