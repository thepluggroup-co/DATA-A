import { useState, type FormEvent, type ReactNode } from "react";
import { api, fcfa } from "../api";
import { EnTete } from "../ui";

type Pre = { effectif: number; par_ville: Record<string, number>; enqueteurs: Record<string, number>; jours_terrain: number;
  cout_collecte: number } | null;

const VILLES = [["DOUALA", "Douala"], ["YAOUNDE", "Yaoundé"], ["BAFOUSSAM", "Bafoussam"], ["DSCHANG", "Dschang"]] as const;

export function Brief(): ReactNode {
  const [titre, setTitre] = useState("");
  const [besoin, setBesoin] = useState("");
  const [antecedents, setAntecedents] = useState("");
  const [marche, setMarche] = useState("");
  const [produits, setProduits] = useState("");
  const [attentes, setAttentes] = useState("");
  const [objectifs, setObjectifs] = useState("");
  const [cibles, setCibles] = useState("");
  const [villes, setVilles] = useState<string[]>(["DOUALA", "YAOUNDE"]);
  const [taille, setTaille] = useState(300);
  const [debut, setDebut] = useState("");
  const [echeance, setEcheance] = useState("");
  const [pre, setPre] = useState<Pre>(null);
  const [envoye, setEnvoye] = useState("");
  const [erreur, setErreur] = useState("");
  const lignes = (t: string): string[] => t.split("\n").map((x) => x.trim()).filter(Boolean);

  const envoyer = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErreur("");
    try {
      const r = await api<{ code: string; pre_estimation: Pre }>("/api/projets/brief", { methode: "POST", corps: {
        titre, besoin, antecedents, marche, produits, attentes, objectifs: lignes(objectifs), cibles: lignes(cibles), villes, taille, debut, echeance } });
      setPre(r.pre_estimation);
      setEnvoye(r.code);
    } catch (err) {
      setErreur((err as Error).message);
    }
  };
  return (
    <>
            <EnTete titre="Nouveau brief" sous_titre="Décrivez votre besoin : la plateforme pré-estime l'échantillon, les enquêteurs, les jours et le coût de collecte ; l'équipe DATA'A valide ensuite le devis." />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      {envoye ? (
        <div className="succes" role="status">
          <p>Brief {envoye} déposé : l'équipe DATA'A le prend en charge.</p>
          {pre && (
            <p>Pré-estimation : {pre.effectif} fiches ({Object.entries(pre.par_ville).map(([v, n]) => `${v} ${n}`).join(", ")}),
              {" "}{Object.values(pre.enqueteurs).reduce((a, b) => a + b, 0)} enquêteurs, {pre.jours_terrain} jours de collecte,
              coût de collecte estimé {fcfa(pre.cout_collecte)}.</p>
          )}
        </div>
      ) : (
        <div className="panneau">
        <form className="grille" onSubmit={(e) => void envoyer(e)}>
          <label htmlFor="titre">Titre de l'étude</label>
          <input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} required minLength={3} />
          <label htmlFor="besoin">Besoin d'information</label>
          <textarea id="besoin" rows={3} value={besoin} onChange={(e) => setBesoin(e.target.value)} required />
          <label htmlFor="antecedents">Antécédents et contexte</label>
          <textarea id="antecedents" rows={3} value={antecedents} onChange={(e) => setAntecedents(e.target.value)} placeholder="Étude précédente, business plan, financement, formation…" />
          <label htmlFor="marche">Description du marché</label>
          <textarea id="marche" rows={4} value={marche} onChange={(e) => setMarche(e.target.value)} placeholder="Marché visé, zones, concurrents, tendances, contraintes…" />
          <label htmlFor="produits">Produits ou services</label>
          <textarea id="produits" rows={3} value={produits} onChange={(e) => setProduits(e.target.value)} placeholder="Offre, usages, prix, proposition de valeur…" />
          <label htmlFor="attentes">Résultats et projections attendus</label>
          <textarea id="attentes" rows={3} value={attentes} onChange={(e) => setAttentes(e.target.value)} placeholder="Décisions à prendre, scénarios, indicateurs, livrables…" />
          <label htmlFor="objectifs">Objectifs (un par ligne)</label>
          <textarea id="objectifs" rows={3} value={objectifs} onChange={(e) => setObjectifs(e.target.value)} required />
          <label htmlFor="cibles">Cibles (une par ligne)</label>
          <textarea id="cibles" rows={3} value={cibles} onChange={(e) => setCibles(e.target.value)} required />
          <span id="villes-l">Villes</span>
          <div role="group" aria-labelledby="villes-l" className="actions">
            {VILLES.map(([code, nom]) => (
              <label key={code}><input type="checkbox" style={{ width: "auto" }} checked={villes.includes(code)}
                onChange={(e) => setVilles(e.target.checked ? [...villes, code] : villes.filter((v) => v !== code))} /> {nom}</label>))}
          </div>
          <label htmlFor="taille">Nombre de fiches</label>
          <input id="taille" type="number" min={30} value={taille} onChange={(e) => setTaille(Number(e.target.value))} />
          <label htmlFor="debut">Démarrage souhaité</label>
          <input id="debut" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} required />
          <label htmlFor="echeance">Échéance</label>
          <input id="echeance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} required />
          <span />
          <button type="submit">Déposer le brief</button>
        </form>
        </div>
      )}
    </>
  );
}
