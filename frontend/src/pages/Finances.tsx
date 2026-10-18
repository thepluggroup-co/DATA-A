const COLONNES = ["Statut", "Ville", "Honoraires", "Formation (PU × qté)", "Collecte (PU × jours)", "Transport", "Hébergement", "Dépouillement",
  "Total", "Avance", "Reste", "Part partenaire"];

export default function PageFinances() {
  return (
    <>
      <div className="entete">
        <div>
          <span className="gris petit">Module M13 · phase 6</span>
          <h1>Finances du terrain</h1>
        </div>
        <span className="pastille p-neutre">à construire</span>
      </div>
      <div className="bandeau info">
        Aucun module de finances n’existe encore dans le moteur. Cet écran affichera la fiche profil des paiements (modèle SOLINA) générée depuis le
        plan de terrain, sans aucun montant codé en dur : barème paramétré par étude, avances, restes, transfert du reste d’un titulaire sorti vers son
        remplaçant, contrôle « somme des lignes = total général ».
      </div>
      <section className="carte">
        <h2>Colonnes prévues</h2>
        <div className="puces">{COLONNES.map((c) => <span key={c} className="pastille p-neutre">{c}</span>)}</div>
        <span className="petit gris">Paiement Mobile Money seulement après vérification d’un prestataire disponible au Cameroun ; sinon liste de paiement exportable.</span>
      </section>
    </>
  );
}
