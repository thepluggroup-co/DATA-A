import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { EnTete, Kpi } from "../ui";

type Journal = { chaine_integre: boolean; ecarts: string[]; entrees: { le: string; action: string; cible: string }[] };

export function UsineAudit(): ReactNode {
  const [j, setJ] = useState<Journal | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => { api<Journal>("/api/usine/audit").then(setJ).catch((e: Error) => setErreur(e.message)); }, []);
  if (erreur) return <p className="erreur" role="alert">{erreur}</p>;
  if (!j) return <p>Chargement…</p>;
  return (
    <>
      <EnTete titre="Journal d'audit" sous_titre="Chaîne d'empreintes SHA-256 : toute modification ou suppression est détectée." />
      <div className="kpis">
        <Kpi icone="bouclier" etiquette="Intégrité" valeur={j.chaine_integre ? "Intègre" : "Rompue"} />
        <Kpi icone="audit" etiquette="Entrées affichées" valeur={j.entrees.length} detail="les plus récentes" />
      </div>
      <p className={j.chaine_integre ? "succes" : "erreur"} role="status">
        {j.chaine_integre ? "Chaîne d'empreintes intègre : aucune entrée modifiée ni supprimée." : `Chaîne rompue : ${j.ecarts.join(" ; ")}`}
      </p>
      <div className="tableau">
      <table aria-label="Dernières entrées du journal">
        <thead><tr><th>Date</th><th>Action</th><th>Objet</th></tr></thead>
        <tbody>{j.entrees.map((e, k) => <tr key={k}><td>{e.le}</td><td>{e.action}</td><td>{e.cible}</td></tr>)}</tbody>
      </table>
      </div>
    </>
  );
}
