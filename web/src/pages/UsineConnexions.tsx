import type { ReactNode } from "react";
import { EnTete, Icone, Badge } from "../ui";

type Connexion = { nom: string; famille: string; description: string; etat: "Actif" | "Prêt" | "À configurer"; icone: string; details: string };

const connexions: Connexion[] = [
  { nom: "Packages applicatifs", famille: "Dépendances", description: "React, TypeScript, FastAPI, Pydantic, moteur statistique et génération de documents.", etat: "Actif", icone: "projets", details: "Frontend et backend installés" },
  { nom: "Comptes et rôles ERP", famille: "Identité", description: "Session sécurisée, CSRF, Argon2id, double facteur et rôles client/cabinet.", etat: "Actif", icone: "bouclier", details: "Client · consultant junior · senior · expert · enquêteur" },
  { nom: "Google Forms & Sheets", famille: "Collecte", description: "Création du formulaire depuis le dictionnaire, lecture des réponses et rattrapage.", etat: "Prêt", icone: "fiches", details: "Nécessite les identifiants Google et le classeur cible" },
  { nom: "PostgreSQL", famille: "Données", description: "Stockage multi-organisation, migrations Alembic, synchronisation idempotente et RLS.", etat: "Prêt", icone: "tableau", details: "URL de base à fournir au déploiement" },
  { nom: "E-mail transactionnel", famille: "Communication", description: "Notifications de brief, suivi terrain, alertes qualité et livraison des résultats.", etat: "À configurer", icone: "brief", details: "SMTP ou fournisseur API à choisir" },
  { nom: "WhatsApp équipe terrain", famille: "Communication", description: "Relances des enquêteurs, notifications des consultants et support opérationnel.", etat: "À configurer", icone: "clients", details: "WhatsApp Business Cloud et numéro vérifié" },
  { nom: "Paiements", famille: "Finance", description: "Suivi des règlements et rapprochement des paiements Mobile Money ou virement.", etat: "Prêt", icone: "argent", details: "Paiement manuel déjà disponible ; API à brancher" },
];

export function UsineConnexions(): ReactNode {
  return (
    <>
      <EnTete titre="Packages de connexion" sous_titre="Centre de contrôle des dépendances, identités, données et services externes de DATA’A." />
      <div className="kpis">
        <div className="kpi"><div className="etiquette">Connexions actives</div><div className="valeur">{connexions.filter((x) => x.etat === "Actif").length}</div></div>
        <div className="kpi"><div className="etiquette">Prêtes à brancher</div><div className="valeur">{connexions.filter((x) => x.etat === "Prêt").length}</div></div>
        <div className="kpi"><div className="etiquette">À configurer</div><div className="valeur">{connexions.filter((x) => x.etat === "À configurer").length}</div></div>
      </div>
      <div className="grille-modules">
        {connexions.map((c) => <article className="module-erp" key={c.nom}>
          <div className="module-icone"><Icone nom={c.icone} /></div>
          <div className="module-corps"><p className="mention">{c.famille}</p><h2>{c.nom}</h2><p>{c.description}</p></div>
          <div className="module-pied"><Badge ton={c.etat === "Actif" ? "ok" : c.etat === "Prêt" ? "info" : "alerte"}>{c.etat}</Badge><span className="mention">{c.details}</span></div>
        </article>)}
      </div>
    </>
  );
}
