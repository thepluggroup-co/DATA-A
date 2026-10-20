import { useState, type ReactNode } from "react";
import { EnTete, Icone, Badge } from "../ui";

type Section = { id: string; titre: string; description: string; icone: string; etat: string };
const sections: Section[] = [
  { id: "cabinet", titre: "Cabinet", description: "Identité, fuseau horaire, devise et règles de facturation.", icone: "clients", etat: "Disponible" },
  { id: "roles", titre: "Rôles & permissions", description: "Droits des clients, consultants juniors, seniors, experts et enquêteurs.", icone: "bouclier", etat: "Disponible" },
  { id: "collecte", titre: "Collecte & qualité", description: "Seuils de remplissage, fiches vides, doublons, rattrapage et contrôle superviseur.", icone: "fiches", etat: "Disponible" },
  { id: "echantillon", titre: "Échantillonnage", description: "Taille, quotas, villes, quartiers, effet de plan et capacité terrain.", icone: "projets", etat: "Disponible" },
  { id: "analyse", titre: "Analyses", description: "Procédures autorisées, bases minimales, pondérations et règles de confidentialité.", icone: "croisement", etat: "Disponible" },
  { id: "notifications", titre: "Notifications", description: "Alertes terrain, validation, rapport, e-mail et canaux d’équipe.", icone: "brief", etat: "À connecter" },
  { id: "apparence", titre: "Apparence", description: "Mode clair ou nuit et densité d’affichage de la console.", icone: "tableau", etat: "Disponible" },
];

export function UsineParametrage(): ReactNode {
  const [selection, setSelection] = useState("cabinet");
  const [objectif, setObjectif] = useState(() => localStorage.getItem("dataa-objectif-jour") ?? "25");
  const [message, setMessage] = useState("");
  const [police, setPolice] = useState(() => localStorage.getItem("dataa-police") ?? "Inter");
  const [palette, setPalette] = useState(() => localStorage.getItem("dataa-palette") ?? "bleu");
  const appliquerApparence = (): void => {
    const couleurs: Record<string, string> = { bleu: "#123d78", ardoise: "#334155", vert: "#166534", violet: "#5b21b6" };
    document.documentElement.style.setProperty("--accent", couleurs[palette] ?? couleurs.bleu);
    document.documentElement.style.setProperty("--police", police);
    localStorage.setItem("dataa-police", police); localStorage.setItem("dataa-palette", palette);
    setMessage("Apparence enregistrée."); setTimeout(() => setMessage(""), 3000);
  };
  const enregistrer = (): void => { localStorage.setItem("dataa-objectif-jour", objectif); setMessage("Paramètres locaux enregistrés."); setTimeout(() => setMessage(""), 3000); };
  return (
    <>
      <EnTete titre="Paramétrage" sous_titre="Configurez les règles qui pilotent une étude de marché de bout en bout." />
      <div className="parametrage-layout">
        <nav className="panneau parametres-nav" aria-label="Sections de paramétrage">
          {sections.map((s) => <button key={s.id} className={selection === s.id ? "parametre-actif" : ""} onClick={() => setSelection(s.id)}><Icone nom={s.icone} /><span>{s.titre}</span><small>{s.etat}</small></button>)}
        </nav>
        <section className="panneau parametres-contenu">
          <h2>{sections.find((s) => s.id === selection)?.titre}</h2>
          <p className="sous-titre">{sections.find((s) => s.id === selection)?.description}</p>
          {selection === "collecte" && <><label htmlFor="objectif">Objectif fiches / enquêteur / jour</label><input id="objectif" type="number" min="1" max="200" value={objectif} onChange={(e) => setObjectif(e.target.value)} /><p className="mention">Le moteur utilise aussi les règles de fiches vides, délais, doublons et décisions qualité.</p></>}
          {selection === "apparence" && <div className="apparence-reglages"><label htmlFor="police">Police</label><select id="police" value={police} onChange={(e) => setPolice(e.target.value)}><option>Inter</option><option>Arial</option><option>Verdana</option><option>system-ui</option></select><label htmlFor="palette">Palette</label><select id="palette" value={palette} onChange={(e) => setPalette(e.target.value)}><option value="bleu">Bleu profond</option><option value="ardoise">Ardoise</option><option value="vert">Vert accessible</option><option value="violet">Violet contrasté</option></select><p className="lecture">Palettes lisibles sur mobile, tablette et bureau.</p><button onClick={appliquerApparence}>Appliquer l’apparence</button></div>}
          {selection !== "collecte" && selection !== "apparence" && <div className="parametre-placeholder"><Badge ton={selection === "notifications" ? "alerte" : "info"}>{selection === "notifications" ? "Connexion requise" : "Socle disponible"}</Badge><p>Cette section est prête à recevoir les paramètres détaillés du module. Les valeurs métier restent versionnées avec chaque étude.</p></div>}
          <div className="actions"><button onClick={enregistrer}>Enregistrer</button>{message && <span className="succes" role="status">{message}</span>}</div>
        </section>
      </div>
    </>
  );
}
