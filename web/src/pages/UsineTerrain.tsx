import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { EnTete, Badge } from "../ui";

export function UsineTerrain(): ReactNode {
  return <>
        <EnTete titre="Terrain & enquêteurs" sous_titre="Accédez aux missions réelles et à la supervision des collectes." />
    <div className="panneau lecture"><Badge ton="info">Données réelles</Badge><p>Cette console ne simule plus de fiches ni de synchronisation. Les enquêteurs collectent depuis l’application terrain; l’équipe suit les missions et les fiches reçues dans la supervision.</p></div>
    <div className="actions"><Link className="bouton" to="/usine/supervision">Ouvrir la supervision</Link><Link className="bouton secondaire" to="/terrain">Ouvrir l’application enquêteur</Link></div>
  </>;
}

