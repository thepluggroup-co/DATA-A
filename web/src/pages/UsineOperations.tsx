import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { EnTete, Icone, Badge } from "../ui";

type Module = { titre: string; description: string; icone: string; etat: string; vers?: string };

const modules: Module[] = [
  { titre: "Cadrage & briefs", description: "Comprendre le besoin, le marché, les produits et les décisions attendues.", icone: "brief", etat: "Actif", vers: "/usine" },
  { titre: "Formulaires & dictionnaire", description: "Construire le questionnaire, les variables, les contrôles et les versions.", icone: "fiches", etat: "À configurer" },
  { titre: "Échantillonnage & villes", description: "Calculer la taille, les quotas, les zones et le plan de terrain.", icone: "projets", etat: "À configurer" },
  { titre: "Terrain & enquêteurs", description: "Former, affecter, suivre les missions et contrôler la qualité des fiches.", icone: "clients", etat: "Actif", vers: "/usine" },
  { titre: "Codification & traitement", description: "Coder les réponses, traiter les rejets et produire la base d'analyse.", icone: "croisement", etat: "À configurer" },
  { titre: "Analyses & synthèse", description: "Programmer les tableaux, calculs, croisements et livrables de l'expert.", icone: "etudes", etat: "À configurer" },
  { titre: "Ressources humaines", description: "Gérer les profils, régions, formations et habilitations des équipes.", icone: "clients", etat: "À configurer" },
  { titre: "Portefeuille & facturation", description: "Suivre les clients, devis, factures, paiements et rentabilité.", icone: "argent", etat: "Actif", vers: "/usine/factures" },
];

export function UsineOperations(): ReactNode {
  return (
    <>
      <EnTete titre="Centre opérations" sous_titre="Le cockpit ERP de THE PLUG : une étude, de la description client à la synthèse livrée." />
      <div className="panneau lecture">
        <strong>Chaîne de production d'une étude</strong>
        <p className="mention">Cadrage → formulaire → échantillonnage → formation → terrain → traitement → analyse → synthèse.</p>
      </div>
      <div className="grille-modules">
        {modules.map((module) => (
          <article className="module-erp" key={module.titre}>
            <div className="module-icone"><Icone nom={module.icone} /></div>
            <div className="module-corps"><h2>{module.titre}</h2><p>{module.description}</p></div>
            <div className="module-pied"><Badge ton={module.etat === "Actif" ? "ok" : "neutre"}>{module.etat}</Badge>{module.vers && <Link className="bouton" to={module.vers}>Ouvrir</Link>}</div>
          </article>
        ))}
      </div>
    </>
  );
}
