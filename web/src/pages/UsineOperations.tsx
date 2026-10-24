import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { EnTete, Icone, Badge } from "../ui";

type EtatModule = "Actif" | "Partiel" | "Prototype" | "Ligne de commande";
type Module = { titre: string; description: string; icone: string; etat: EtatModule; vers?: string };

const modules: Module[] = [
  { titre: "Cadrage & briefs", description: "Créer les briefs client, les projets et les pré-estimations.", icone: "brief", etat: "Actif", vers: "/usine" },
  { titre: "Formulaires & dictionnaire", description: "Libellés, aides, libellés des modalités et caractère obligatoire modifiables et enregistrés dans le dossier du projet (versionnés, audités, refusés une fois la collecte commencée). Ajout et suppression de questions, conditions d’affichage et règles de cohérence restent hors de l’éditeur.", icone: "fiches", etat: "Partiel", vers: "/usine/formulaire" },
  { titre: "Échantillonnage & villes", description: "Quotas par cible et par ville modifiables et enregistrés dans le dossier du projet (versionnés, audités, refusés une fois la collecte commencée). Cibles et villes viennent du brief.", icone: "projets", etat: "Partiel", vers: "/usine/echantillonnage" },
  { titre: "Terrain & enquêteurs", description: "Missions et supervision sont reliées à l’API; l’essai sur un téléphone Android reste à faire.", icone: "clients", etat: "Partiel", vers: "/usine/supervision" },
  { titre: "Codification & traitement", description: "Codification, contrôles et exports disponibles par les commandes du backend.", icone: "croisement", etat: "Ligne de commande" },
  { titre: "Analyses & synthèse", description: "Les analyses et validations sont accessibles; toutes les procédures statistiques ne sont pas encore validées.", icone: "etudes", etat: "Partiel", vers: "/usine/analyses" },
  { titre: "Ressources humaines", description: "Le vivier et les règles métier existent; la gestion des équipes n’a pas encore d’écran complet.", icone: "clients", etat: "Ligne de commande" },
  { titre: "Portefeuille & facturation", description: "Clients, projets, factures et paiements saisis par l’usine; aucun paiement en ligne n’est branché.", icone: "argent", etat: "Partiel", vers: "/usine/factures" },
];

const tonEtat: Record<EtatModule, "ok" | "info" | "alerte" | "neutre"> = {
  Actif: "ok",
  Partiel: "info",
  Prototype: "alerte",
  "Ligne de commande": "neutre",
};

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
            <div className="module-pied"><Badge ton={tonEtat[module.etat]}>{module.etat}</Badge>{module.vers && <Link className="bouton" to={module.vers}>Ouvrir</Link>}</div>
          </article>
        ))}
      </div>
    </>
  );
}
