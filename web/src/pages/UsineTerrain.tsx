import { useState, type ReactNode } from "react";
import { EnTete, Kpi, Badge } from "../ui";

const QUEUE_KEY = "dataa-terrain-queue";

export function UsineTerrain(): ReactNode {
  const [horsLigne, setHorsLigne] = useState(false);
  const [fiches, setFiches] = useState(18);
  const [enAttente, setEnAttente] = useState(() => Number(localStorage.getItem(QUEUE_KEY) || 0));
  const [message, setMessage] = useState("");
  const enregistrer = (): void => {
    setFiches((x) => x + 1);
    if (horsLigne) { setEnAttente((x) => { const next = x + 1; localStorage.setItem(QUEUE_KEY, String(next)); return next; }); setMessage("Fiche enregistrÃ©e dans la file locale."); }
    else setMessage("Fiche envoyÃ©e et synchronisÃ©e.");
  };
  const synchroniser = (): void => { setEnAttente(0); localStorage.removeItem(QUEUE_KEY); setMessage("Synchronisation terminÃ©e : toutes les fiches locales sont envoyÃ©es."); };
  return <>
    <EnTete titre="Espace terrain" sous_titre="Collecte mobile : mission active, quotas, qualitÃ© et synchronisation." actions={<button className={horsLigne ? "secondaire" : ""} onClick={() => setHorsLigne((x) => !x)}>{horsLigne ? "Mode hors ligne" : "Connexion active"}</button>} />
    <div className="panneau lecture"><strong>Mission : DEMO_A Â· ENQ1</strong><span className="mention">Douala Â· session sÃ©curisÃ©e Â· collecte autorisÃ©e</span></div>
    <div className="kpis"><Kpi icone="fiches" etiquette="Fiches envoyÃ©es" valeur={fiches} detail="objectif 25 / jour" jauge={100 * fiches / 25} /><Kpi icone="projets" etiquette="Quota restant" valeur={57 - fiches} /><Kpi icone="bouclier" etiquette="QualitÃ©" valeur="Bonne" /><Kpi icone="audit" etiquette="En attente" valeur={enAttente} detail={horsLigne ? "file locale" : "synchronisÃ©e"} /></div>
    <div className="grille-2"><section className="panneau"><h2>Actions de collecte</h2><div className="actions"><button onClick={enregistrer}>Enregistrer une fiche test</button><button className="secondaire" onClick={synchroniser} disabled={!enAttente}>Synchroniser</button></div><p className="mention">Les fiches hors ligne restent dans la file locale jusqu'Ã  la synchronisation.</p></section><section className="panneau"><h2>Signalement</h2><p className="mention">Une anomalie de cible, de quota ou de formulaire ?</p><button className="secondaire" onClick={() => setMessage("Incident enregistrÃ© localement.")}>Signaler un incident</button>{message && <p className="succes" role="status">{message}</p>}</section></div>
    <p><Badge ton={horsLigne ? "alerte" : "ok"}>{horsLigne ? `Hors ligne : ${enAttente} fiche(s) en file locale` : "ConnectÃ© : donnÃ©es synchronisÃ©es"}</Badge></p>
  </>;
}

