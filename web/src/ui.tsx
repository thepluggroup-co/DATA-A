import type { ReactNode } from "react";

// Icônes en ligne (SVG, trait 1,8) : aucune dépendance, aucune ressource externe.
const CHEMINS: Record<string, string> = {
  tableau: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  etudes: "M4 4h16v4H4zM4 10h10v4H4zM4 16h16v4H4z",
  brief: "M12 5v14M5 12h14",
  projets: "M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4",
  clients: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0",
  facture: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6",
  audit: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4zm-3 10l2 2 4-4",
  croisement: "M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v7h-7zM4 13h7v7H4z",
  fiches: "M5 3h14v18H5zM8 7h8M8 11h8M8 15h5",
  argent: "M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H7",
  bouclier: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z",
  sortie: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
};

export function Icone({ nom }: { nom: string }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CHEMINS[nom] ?? CHEMINS.tableau} />
    </svg>
  );
}

export function Kpi({ icone, etiquette, valeur, detail, jauge }:
  { icone: string; etiquette: string; valeur: ReactNode; detail?: ReactNode; jauge?: number }): ReactNode {
  return (
    <div className="kpi">
      <div className="etiquette"><Icone nom={icone} />{etiquette}</div>
      <div className="valeur">{valeur}</div>
      {detail && <div className="detail">{detail}</div>}
      {jauge !== undefined && <div className="jauge" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, jauge))}%` }} /></div>}
    </div>
  );
}

export function Badge({ ton, children }: { ton: "ok" | "info" | "alerte" | "neutre"; children: ReactNode }): ReactNode {
  return <span className={`badge ${ton}`}>{children}</span>;
}

export function EnTete({ titre, sous_titre, actions }: { titre: string; sous_titre?: string; actions?: ReactNode }): ReactNode {
  return (
    <div className="actions" style={{ justifyContent: "space-between", margin: "0 0 0.4rem" }}>
      <div>
        <h1>{titre}</h1>
        {sous_titre && <p className="sous-titre">{sous_titre}</p>}
      </div>
      {actions}
    </div>
  );
}

export const STATUTS_PROJET: Record<string, { libelle: string; ton: "ok" | "info" | "alerte" | "neutre" }> = {
  brief: { libelle: "Brief déposé", ton: "alerte" },
  documents: { libelle: "Préparation du terrain", ton: "info" },
  terrain: { libelle: "Terrain en cours", ton: "info" },
  livre: { libelle: "Livrée", ton: "ok" },
};

export function StatutProjet({ statut }: { statut: string }): ReactNode {
  const s = STATUTS_PROJET[statut] ?? { libelle: statut, ton: "neutre" as const };
  return <Badge ton={s.ton}>{s.libelle}</Badge>;
}
