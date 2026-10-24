import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../../api";
import { Badge, Kpi } from "../../ui";

// Diffusion : un lien par poste du plan de terrain (le nombre de liens suit le nombre d'enquêteurs du plan).
// Application enquêteur : lien « /terrain#code=… » qui pré-remplit l'activation. Un code n'est connu qu'au moment où il est
// créé (le serveur ne garde que son empreinte) : un lien perdu se rediffuse en régénérant le code du poste.
// Google Forms (V1) : liens pré-remplis (identifiant + ville) calculés depuis UN lien modèle enregistré pour le projet.
type Poste = {
  poste: string; role: string; ville: string | null; ville_libelle: string | null; zones: string[]; localites: number;
  mission: { id: string; actif: boolean; fiches: number } | null; lien_google: string | null;
};
type Diffusion = { projet: string; postes: Poste[]; sans_mission: number; google: { modele: string | null; enqueteur_modele: string | null; erreur: string } };

const lienTerrain = (code: string): string => `${window.location.origin}/terrain#code=${encodeURIComponent(code)}`;
const whatsapp = (texte: string): string => `https://wa.me/?text=${encodeURIComponent(texte)}`;

export function DiffusionLiens({ projetId, pilote }: { projetId: string; pilote: boolean }): ReactNode {
  const [d, setD] = useState<Diffusion | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [qr, setQr] = useState<{ titre: string; png: string } | null>(null);
  const [modele, setModele] = useState(""), [posteModele, setPosteModele] = useState("");
  const [erreur, setErreur] = useState(""), [message, setMessage] = useState("");

  const charger = useCallback((): void => {
    setErreur("");
    api<Diffusion>(`/api/usine/projets/${projetId}/diffusion`).then((x) => {
      setD(x); setModele(x.google.modele ?? ""); setPosteModele(x.google.enqueteur_modele ?? x.postes[0]?.poste ?? "");
    }).catch((e: Error) => setErreur(e.message));
  }, [projetId]);
  useEffect(() => { setCodes({}); setQr(null); setMessage(""); charger(); }, [charger]);

  const action = async (f: () => Promise<void>): Promise<void> => {
    setErreur(""); setMessage("");
    try { await f(); } catch (e) { setErreur((e as Error).message); }
  };
  const creer = (): Promise<void> => action(async () => {
    const r = await api<{ codes: Record<string, string>; deja_crees: string[] }>(`/api/usine/projets/${projetId}/missions`, { methode: "POST" });
    setCodes((c) => ({ ...c, ...r.codes }));
    setMessage(Object.keys(r.codes).length ? `${Object.keys(r.codes).length} lien(s) créé(s). Diffusez-les maintenant : les codes ne seront plus affichés après rechargement.`
      : "Tous les postes ont déjà une mission. Régénérez le code d’un poste pour rediffuser son lien.");
    charger();
  });
  const regenerer = (p: Poste): Promise<void> => action(async () => {
    if (!p.mission || !window.confirm(`Nouveau code pour ${p.poste} ? L’ancien lien n’activera plus de nouveau téléphone (les téléphones déjà activés restent connectés).`)) return;
    const r = await api<{ poste: string; code: string }>(`/api/usine/missions/${p.mission.id}/code`, { methode: "POST" });
    setCodes((c) => ({ ...c, [r.poste]: r.code }));
    setMessage(`Nouveau lien prêt pour ${r.poste}.`);
  });
  const basculer = (p: Poste): Promise<void> => action(async () => {
    if (!p.mission) return;
    if (p.mission.actif && !window.confirm(`Révoquer la mission ${p.poste} ? Le téléphone ne pourra plus envoyer de fiches (les fiches reçues sont conservées).`)) return;
    await api(`/api/usine/missions/${p.mission.id}`, { methode: "PATCH", corps: { actif: !p.mission.actif } });
    charger();
  });
  const voirQr = (titre: string, texte: string): Promise<void> => action(async () => {
    const r = await api<{ png: string }>("/api/usine/qr", { methode: "POST", corps: { texte } });
    setQr({ titre, png: r.png });
  });
  const copier = (texte: string, quoi: string): Promise<void> => action(async () => {
    await navigator.clipboard.writeText(texte);
    setMessage(`${quoi} copié dans le presse-papiers.`);
  });
  const enregistrerModele = (): Promise<void> => action(async () => {
    const x = await api<Diffusion>(`/api/usine/projets/${projetId}/diffusion/google`, { methode: "PUT", corps: { modele, enqueteur_modele: posteModele } });
    setD(x);
    setMessage(modele.trim() ? `Lien modèle enregistré : ${x.postes.filter((p) => p.lien_google).length} lien(s) Google Forms calculé(s).` : "Lien modèle effacé.");
  });
  const exporter = (): void => {
    if (!d) return;
    const cellule = (v: string): string => `"${v.replace(/"/g, '""')}"`;
    const lignes = [["Poste", "Rôle", "Ville", "Zones", "Lien application", "Code", "Lien Google Forms"].map(cellule).join(";"),
      ...d.postes.map((p) => [p.poste, p.role, p.ville_libelle ?? "", p.zones.join(", "), codes[p.poste] ? lienTerrain(codes[p.poste]) : "",
        codes[p.poste] ?? "", p.lien_google ?? ""].map(cellule).join(";"))];
    const url = URL.createObjectURL(new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `LIENS_${d.projet}.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  if (!d) return erreur ? <p className="erreur" role="alert">{erreur}</p> : <p className="mention">Chargement des postes…</p>;
  const connus = d.postes.filter((p) => codes[p.poste]).length;
  return <section aria-label="Diffusion des liens">
    <div className="kpis">
      <Kpi icone="clients" etiquette="Postes du plan" valeur={d.postes.length} detail={`${d.postes.filter((p) => p.role === "titulaire").length} titulaire(s)`} />
      <Kpi icone="fiches" etiquette="Missions créées" valeur={d.postes.length - d.sans_mission} detail={`${d.sans_mission} sans lien`} />
      <Kpi icone="bouclier" etiquette="Liens à diffuser" valeur={connus} detail="codes affichés dans cette session" />
      <Kpi icone="projets" etiquette="Google Forms" valeur={d.postes.filter((p) => p.lien_google).length} detail={d.google.modele ? "lien modèle enregistré" : "aucun lien modèle"} />
    </div>
    <p className="mention">Le nombre de liens suit les postes d’enquêteurs du plan de terrain : ajoutez ou retirez un poste dans l’organisation du terrain, puis créez les liens manquants.</p>
    {erreur && <p className="erreur" role="alert">{erreur}</p>}
    {message && <p className="succes" role="status">{message}</p>}
    <div className="actions">
      {pilote && <button onClick={() => void creer()}>Créer les liens manquants ({d.sans_mission})</button>}
      <button className="secondaire" onClick={exporter}>Exporter la liste (CSV)</button>
      <button className="secondaire" onClick={() => window.print()}>Imprimer</button>
    </div>
    <div className="tableau"><table aria-label="Liens par enquêteur">
      <thead><tr><th>Poste</th><th>Ville et zones</th><th>Mission</th><th>Lien de l’application</th><th>Google Forms</th></tr></thead>
      <tbody>{d.postes.map((p) => {
        const code = codes[p.poste];
        return <tr key={p.poste}>
          <td><strong>{p.poste}</strong><br /><span className="mention">{p.role === "reserve" ? "Réserve" : "Titulaire"}</span></td>
          <td>{p.ville_libelle ?? "—"}<br /><span className="mention">{p.zones.join(", ") || "sans zone"} · {p.localites} lieu(x)</span></td>
          <td>{!p.mission ? <Badge ton="neutre">Sans lien</Badge> : p.mission.actif ? <Badge ton="ok">Active</Badge> : <Badge ton="alerte">Révoquée</Badge>}
            {p.mission && <><br /><span className="mention">{p.mission.fiches} fiche(s)</span></>}
            {pilote && p.mission && <><br /><button className="secondaire" onClick={() => void basculer(p)}>{p.mission.actif ? "Révoquer" : "Réactiver"}</button></>}</td>
          <td>{code ? <span className="actions">
            <code>{code}</code>
            <button className="secondaire" onClick={() => void copier(lienTerrain(code), `Lien de ${p.poste}`)}>Copier le lien</button>
            <a className="bouton secondaire" href={whatsapp(`Bonjour ${p.poste}, voici votre lien de mission DATA'A : ${lienTerrain(code)}`)} target="_blank" rel="noreferrer">WhatsApp</a>
            <button className="secondaire" onClick={() => void voirQr(`Mission ${p.poste}`, lienTerrain(code))}>QR code</button>
          </span> : p.mission ? <>{pilote && p.mission.actif && <button className="secondaire" onClick={() => void regenerer(p)}>Régénérer le lien</button>}
            <br /><span className="mention">code déjà remis (non conservé)</span></> : <span className="mention">créez le lien</span>}</td>
          <td>{p.lien_google ? <span className="actions">
            <button className="secondaire" onClick={() => void copier(p.lien_google!, `Lien Google Forms de ${p.poste}`)}>Copier</button>
            <a className="bouton secondaire" href={whatsapp(`Bonjour ${p.poste}, voici votre formulaire DATA'A : ${p.lien_google}`)} target="_blank" rel="noreferrer">WhatsApp</a>
            <button className="secondaire" onClick={() => void voirQr(`Google Forms ${p.poste}`, p.lien_google!)}>QR code</button>
            <a className="bouton secondaire" href={p.lien_google} target="_blank" rel="noreferrer">Ouvrir</a>
          </span> : <span className="mention">—</span>}</td>
        </tr>;
      })}</tbody>
    </table></div>
    {qr && <div className="panneau" role="dialog" aria-label={`QR code ${qr.titre}`}>
      <h3>{qr.titre}</h3><img src={qr.png} alt={`QR code ${qr.titre}`} style={{ width: 220, height: 220, background: "#fff", borderRadius: 8 }} />
      <div className="actions"><a className="bouton secondaire" href={qr.png} download={`QR_${qr.titre.replace(/\W+/g, "_")}.png`}>Télécharger</a>
        <button className="secondaire" onClick={() => setQr(null)}>Fermer</button></div>
    </div>}
    <section className="panneau" aria-label="Liens Google Forms">
      <h3>Liens pré-remplis Google Forms</h3>
      <p className="mention">Dans Google Forms : « Obtenir le lien prérempli », choisissez un poste et sa ville, copiez le lien et collez-le ici.
        La plateforme en déduit le lien de chaque enquêteur (identifiant et ville remplacés). L’API Google Forms ne fournit pas ce calcul.</p>
      {d.google.erreur && <p className="avertissement" role="alert">Lien modèle enregistré devenu inutilisable : {d.google.erreur}</p>}
      <form className="grille" onSubmit={(e) => { e.preventDefault(); void enregistrerModele(); }}>
        <label htmlFor="lien-modele">Lien pré-rempli modèle</label>
        <input id="lien-modele" value={modele} disabled={!pilote} placeholder="https://docs.google.com/forms/d/e/…/viewform?usp=pp_url&entry.…"
          onChange={(e) => setModele(e.target.value)} />
        <label htmlFor="poste-modele">Poste choisi dans ce lien</label>
        <select id="poste-modele" value={posteModele} disabled={!pilote} onChange={(e) => setPosteModele(e.target.value)}>
          {d.postes.map((p) => <option key={p.poste} value={p.poste}>{p.poste} ({p.ville_libelle ?? "sans ville"})</option>)}
        </select>
        <span />
        {pilote && <button type="submit">{modele.trim() ? "Enregistrer le lien modèle" : "Effacer le lien modèle"}</button>}
      </form>
    </section>
  </section>;
}
