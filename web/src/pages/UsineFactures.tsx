import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, fcfa } from "../api";
import { Badge, EnTete, Kpi } from "../ui";

type Organisation = { id: string; nom: string; type: string };
type Facture = { id: string; numero: string; montant_ht: number; statut: string; emise_le: string };

export function UsineFactures(): ReactNode {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [org, setOrg] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState(0);
  const [paiement, setPaiement] = useState<Record<string, { montant: number; moyen: string; reference: string }>>({});
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const charger = (): void => {
    api<Organisation[]>("/api/usine/organisations").then((o) => {
      const clients = o.filter((x) => x.type === "client");
      setOrgs(clients);
      setOrg((v) => v || clients[0]?.id || "");
    }).catch(() => undefined);
    api<Facture[]>("/api/factures").then(setFactures).catch(() => undefined);
  };
  useEffect(charger, []);
  const emettre = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      const f = await api<{ numero: string }>("/api/usine/factures", { methode: "POST", corps: { organisation_id: org, lignes: [[libelle, montant]] } });
      setMessage({ ok: true, texte: `Facture ${f.numero} émise.` });
      charger();
    } catch (err) {
      setMessage({ ok: false, texte: (err as Error).message });
    }
  };
  const encaisser = async (f: Facture): Promise<void> => {
    const p = paiement[f.id] ?? { montant: f.montant_ht, moyen: "virement", reference: "" };
    try {
      const r = await api<{ statut: string }>(`/api/usine/factures/${f.id}/paiements`, { methode: "POST", corps: p });
      setMessage({ ok: true, texte: `Paiement enregistré sur ${f.numero} : ${r.statut === "payee" ? "facture payée" : "paiement partiel"}.` });
      charger();
    } catch (err) {
      setMessage({ ok: false, texte: (err as Error).message });
    }
  };
  return (
    <>
            <EnTete titre="Facturation" sous_titre="Factures, encaissements (virement ou Mobile Money hors ligne) et suivi des soldes." />
      <div className="kpis">
        <Kpi icone="facture" etiquette="Factures" valeur={factures.length} />
        <Kpi icone="argent" etiquette="Encaissé" valeur={fcfa(factures.filter((f) => f.statut === "payee").reduce((s, f) => s + f.montant_ht, 0))} />
        <Kpi icone="argent" etiquette="À encaisser" valeur={fcfa(factures.filter((f) => f.statut !== "payee").reduce((s, f) => s + f.montant_ht, 0))}
             detail={`${factures.filter((f) => f.statut !== "payee").length} facture(s)`} />
      </div>
      <p className="mention">Taxes selon le régime fiscal du client et du cabinet, en sus.</p>
      {message && <p className={message.ok ? "succes" : "erreur"} role="status">{message.texte}</p>}
      <section className="panneau" aria-label="Émission">
      <h2>Émettre une facture</h2>
      <form className="grille" onSubmit={(e) => void emettre(e)}>
        <label htmlFor="client">Client</label>
        <select id="client" value={org} onChange={(e) => setOrg(e.target.value)}>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
        <label htmlFor="libelle">Libellé</label>
        <input id="libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} required />
        <label htmlFor="montant">Montant HT (FCFA)</label>
        <input id="montant" type="number" min={1} value={montant || ""} onChange={(e) => setMontant(Number(e.target.value))} required />
        <span />
        <button type="submit">Émettre</button>
      </form>
      </section>
      <h2>Factures</h2>
      <div className="tableau">
      <table aria-label="Factures">
        <thead><tr><th>N°</th><th className="nombre">Montant HT</th><th>Statut</th><th>Encaisser</th></tr></thead>
        <tbody>{factures.map((f) => (
          <tr key={f.id}><td>{f.numero}</td><td className="nombre">{fcfa(f.montant_ht)}</td>
            <td>{f.statut === "payee" ? <Badge ton="ok">Payée</Badge> : <Badge ton="alerte">À régler</Badge>}</td>
            <td>{f.statut !== "payee" && (
              <span className="actions">
                <select aria-label={`Moyen de paiement ${f.numero}`} value={paiement[f.id]?.moyen ?? "virement"}
                        onChange={(e) => setPaiement({ ...paiement, [f.id]: { ...(paiement[f.id] ?? { montant: f.montant_ht, reference: "" }), moyen: e.target.value } })}>
                  <option value="virement">Virement</option><option value="mobile_money">Mobile Money</option><option value="especes">Espèces</option>
                </select>
                <button aria-label={`Encaisser ${f.numero}`} onClick={() => void encaisser(f)}>Encaisser le solde</button>
              </span>)}</td></tr>))}
        </tbody>
      </table>
      </div>
    </>
  );
}
