import { useState, type ReactNode } from "react";
import { EnTete, Kpi, Badge } from "../ui";

export function UsineTerrain(): ReactNode {
  const [horsLigne, setHorsLigne] = useState(false); const [fiches, setFiches] = useState(18); const [message, setMessage] = useState("");
  const signaler = (): void => setMessage("Incident enregistré localement. Il sera envoyé à la prochaine synchronisation.");
  return <>
    <EnTete titre="Espace terrain" sous_titre="Collecte mobile : mission active, quotas, qualité et synchronisation." actions={<button className={horsLigne ? "secondaire" : ""} onClick={() => setHorsLigne((x) => !x)}>{horsLigne ? "Mode hors ligne" : "Connexion active"}</button>} />
    <div className="panneau lecture"><strong>Mission : DEMO_A · ENQ1</strong><span className="mention">Douala · session sécurisée · collecte autorisée</span></div>
    <div className="kpis"><Kpi icone="fiches" etiquette="Fiches envoyées" valeur={fiches} detail="objectif 25 / jour" jauge={100 * fiches / 25} /><Kpi icone="projets" etiquette="Quota restant" valeur={57 - fiches} /><Kpi icone="bouclier" etiquette="Qualité" valeur="Bonne" /><Kpi icone="audit" etiquette="Synchronisation" valeur={horsLigne ? "En attente" : "À jour"} /></div>
    <div className="grille-2"><section className="panneau"><h2>Actions de collecte</h2><div className="actions"><button onClick={() => { setFiches((x) => x + 1); setMessage(horsLigne ? "Fiche enregistrée dans la file locale." : "Fiche envoyée et synchronisée."); }}>Enregistrer une fiche test</button><button className="secondaire" onClick={() => setMessage("Synchronisation terminée : 0 fiche en attente.")}>Synchroniser</button></div><p className="mention">Le mode hors ligne conserve les fiches chiffrées sur l’appareil avant envoi.</p></section><section className="panneau"><h2>Signalement</h2><p className="mention">Une anomalie de cible, de quota ou de formulaire ?</p><button className="secondaire" onClick={signaler}>Signaler un incident</button>{message && <p className="succes" role="status">{message}</p>}</section></div>
    <p><Badge ton={horsLigne ? "alerte" : "ok"}>{horsLigne ? "Hors ligne : données en file locale" : "Connecté : données synchronisées"}</Badge></p>
  </>;
}
