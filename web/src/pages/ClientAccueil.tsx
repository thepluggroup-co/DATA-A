import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, fcfa } from "../api";
import { Badge, EnTete, Kpi, StatutProjet } from "../ui";

type Projet = { id: string; code: string; nom: string; statut: string; base_disponible: boolean };
type Abonnement = { formule: string | null; croisements_par_mois?: number; croisements_ce_mois: number };
type Facture = { id: string; numero: string; montant_ht: number; statut: string; emise_le: string };

export function ClientAccueil(): ReactNode {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [ab, setAb] = useState<Abonnement | null>(null);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    Promise.all([api<Projet[]>("/api/projets"), api<Abonnement>("/api/abonnement"), api<Facture[]>("/api/factures")])
      .then(([p, a, f]) => { setProjets(p); setAb(a); setFactures(f); })
      .catch((e: Error) => setErreur(e.message));
  }, []);
  const aRegler = factures.filter((f) => f.statut !== "payee");
  const plafond = ab?.croisements_par_mois;
  return (
    <>
      <EnTete titre="Mes études" sous_titre="Vue d'ensemble de vos études, de votre abonnement et de vos factures." />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="kpis">
        <Kpi icone="etudes" etiquette="Études" valeur={projets.length}
             detail={`${projets.filter((p) => p.statut === "livre").length} livrée(s)`} />
        <Kpi icone="fiches" etiquette="Bases d'analyse" valeur={projets.filter((p) => p.base_disponible).length}
             detail="prêtes pour les croisements" />
        <Kpi icone="croisement" etiquette="Croisements du mois" valeur={ab?.croisements_ce_mois ?? "—"}
             detail={plafond !== undefined ? `sur ${plafond} inclus` : "sans plafond"}
             jauge={plafond ? (100 * (ab?.croisements_ce_mois ?? 0)) / plafond : undefined} />
        <Kpi icone="argent" etiquette="À régler" valeur={fcfa(aRegler.reduce((s, f) => s + f.montant_ht, 0))}
             detail={`${aRegler.length} facture(s) en attente`} />
      </div>
      <h2>Portefeuille d'études</h2>
      <div className="tableau">
        <table aria-label="Mes études">
          <thead><tr><th>Étude</th><th>Statut</th><th>Base d'analyse</th></tr></thead>
          <tbody>
            {projets.length === 0 && <tr><td colSpan={3} className="vide">Aucune étude pour l'instant : déposez un brief.</td></tr>}
            {projets.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/projets/${p.id}`}>{p.nom}</Link></td>
                <td><StatutProjet statut={p.statut} /></td>
                <td>{p.base_disponible ? <Badge ton="ok">Disponible</Badge> : <Badge ton="neutre">En attente</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grille-2">
        {ab && (
          <section className="panneau" aria-label="Mon abonnement">
            <h2>Mon abonnement</h2>
            <p>Formule : <strong>{ab.formule ?? "aucune"}</strong></p>
            <p className="mention">Croisements utilisés ce mois : {ab.croisements_ce_mois}{plafond !== undefined && ` / ${plafond}`}</p>
          </section>
        )}
        <section className="panneau" aria-label="Facturation">
          <h2>Mes factures</h2>
          <div className="tableau" style={{ marginBottom: 0 }}>
            <table aria-label="Mes factures">
              <thead><tr><th>N°</th><th>Émise le</th><th className="nombre">Montant HT</th><th>Statut</th></tr></thead>
              <tbody>
                {factures.length === 0 && <tr><td colSpan={4} className="vide">Aucune facture.</td></tr>}
                {factures.map((f) => (
                  <tr key={f.id}><td>{f.numero}</td><td>{f.emise_le}</td><td className="nombre">{fcfa(f.montant_ht)}</td>
                    <td>{f.statut === "payee" ? <Badge ton="ok">Payée</Badge> : <Badge ton="alerte">À régler</Badge>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
