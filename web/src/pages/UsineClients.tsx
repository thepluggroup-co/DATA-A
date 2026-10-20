import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "../api";
import { Badge, EnTete } from "../ui";

type Organisation = { id: string; nom: string; type: string };

export function UsineClients(): ReactNode {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState("");
  const [mdp, setMdp] = useState("");
  const [formule, setFormule] = useState("forfait");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const charger = (): void => { api<Organisation[]>("/api/usine/organisations").then(setOrgs).catch(() => undefined); };
  useEffect(charger, []);
  const creer = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await api("/api/usine/organisations", { methode: "POST", corps: { nom, admin_email: email, admin_nom: admin, mot_de_passe: mdp, formule } });
      setMessage({ ok: true, texte: `Client « ${nom} » créé.` });
      charger();
    } catch (err) {
      setMessage({ ok: false, texte: (err as Error).message });
    }
  };
  return (
    <>
      <EnTete titre="Clients" sous_titre="Organisations, accès et formules d'abonnement." />
      <div className="grille-2">
      <section className="panneau" aria-label="Annuaire des organisations">
      <h2>Organisations</h2>
      <div className="tableau" style={{ marginBottom: 0 }}>
      <table aria-label="Organisations">
        <thead><tr><th>Organisation</th><th>Type</th></tr></thead>
        <tbody>{orgs.map((o) => <tr key={o.id}><td>{o.nom}</td><td>{o.type === "usine" ? <Badge ton="info">Usine</Badge> : <Badge ton="ok">Client</Badge>}</td></tr>)}</tbody>
      </table>
      </div>
      </section>
      <section className="panneau" aria-label="Création d'un client">
      <h2>Nouveau client</h2>
      {message && <p className={message.ok ? "succes" : "erreur"} role="status">{message.texte}</p>}
      <form className="grille" onSubmit={(e) => void creer(e)}>
        <label htmlFor="org">Organisation</label>
        <input id="org" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <label htmlFor="adm-nom">Administrateur</label>
        <input id="adm-nom" value={admin} onChange={(e) => setAdmin(e.target.value)} required />
        <label htmlFor="adm-email">E-mail de l'administrateur</label>
        <input id="adm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="adm-mdp">Mot de passe initial</label>
        <input id="adm-mdp" type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} required />
        <label htmlFor="formule">Formule</label>
        <select id="formule" value={formule} onChange={(e) => setFormule(e.target.value)}>
          <option value="acces_credits">Accès + crédits d'études</option>
          <option value="forfait">À l'étude (forfait)</option>
          <option value="barometre">Baromètre</option>
        </select>
        <span />
        <button type="submit">Créer le client</button>
      </form>
      </section>
      </div>
    </>
  );
}
