import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Moi } from "../api";
import { estUsine, useSession } from "../App";

export function Connexion(): ReactNode {
  const { moi, definir } = useSession();
  const aller = useNavigate();
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const etapeTotp = !!moi && moi.second_facteur_requis;

  const suite = (m: Moi): void => {
    definir(m);
    if (!m.second_facteur_requis) aller(estUsine(m) ? "/usine" : "/");
  };
  const envoyer = async (e: FormEvent, chemin: string, corps: unknown): Promise<void> => {
    e.preventDefault();
    setErreur("");
    setOccupe(true);
    try {
      suite(await api<Moi>(chemin, { methode: "POST", corps }));
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="ecran-connexion">
      <section className="vitrine" aria-hidden="true">
        <span className="orbe a" /><span className="orbe b" />
        <span className="chip-role" style={{ alignSelf: "flex-start" }}>Plateforme d'études de marché</span>
        <h2>Des données <span className="texte-degrade">aux décisions</span>.</h2>
        <p>Du brief au rapport : échantillon, terrain, contrôle qualité, analyses et croisements à la demande, dans un seul espace.</p>
        <ul>
          <li>Suivi du terrain en temps réel, quotas cible × ville</li>
          <li>Croisements à la demande avec garde-fous statistiques</li>
          <li>Données isolées par client, journal d'audit inaltérable</li>
        </ul>
      </section>
      <section className="formulaire-connexion">
        <div className="connexion panneau">
          <span className="puce-logo"><img src="/logo_data_a.png" alt="DATA'A — Des données aux décisions" /></span>
          <h1>{etapeTotp ? "Double authentification" : "Connexion"}</h1>
          <p className="sous-titre">{etapeTotp ? "Saisissez le code à 6 chiffres de votre application d'authentification." : "Accédez à votre espace DATA'A."}</p>
          {erreur && <p className="erreur" role="alert">{erreur}</p>}
          {etapeTotp ? (
            <form onSubmit={(e) => void envoyer(e, "/api/auth/totp", { code })} className="grille">
              <label htmlFor="code">Code à 6 chiffres</label>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                     onChange={(e) => setCode(e.target.value)} required autoFocus
                     style={{ fontSize: "1.6rem", letterSpacing: "0.5em", textAlign: "center" }} />
              <span />
              <button type="submit" disabled={occupe}>Vérifier</button>
            </form>
          ) : (
            <form onSubmit={(e) => void envoyer(e, "/api/auth/connexion", { email, mot_de_passe: mdp })} className="grille">
              <label htmlFor="email">Adresse e-mail</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              <label htmlFor="mdp">Mot de passe</label>
              <input id="mdp" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} required />
              <span />
              <button type="submit" disabled={occupe}>Se connecter</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
