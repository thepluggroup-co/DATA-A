import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, retenirCsrf, type Moi } from "./api";
import { Icone } from "./ui";
import { Connexion } from "./pages/Connexion";
import { ClientAccueil } from "./pages/ClientAccueil";
import { ClientProjet } from "./pages/ClientProjet";
import { Brief } from "./pages/Brief";
import { UsineProjets } from "./pages/UsineProjets";
import { UsineClients } from "./pages/UsineClients";
import { UsineFactures } from "./pages/UsineFactures";
import { UsineAudit } from "./pages/UsineAudit";

type Session = { moi: Moi | null; definir: (m: Moi | null) => void };
const ContexteSession = createContext<Session>({ moi: null, definir: () => undefined });
export const useSession = (): Session => useContext(ContexteSession);
export const estUsine = (m: Moi | null): boolean => !!m && m.role.startsWith("usine") && !m.second_facteur_requis;

const MODULES_CLIENT = [
  { vers: "/", nom: "Mes études", icone: "tableau", fin: true },
  { vers: "/brief", nom: "Nouveau brief", icone: "brief" },
];
const MODULES_USINE = [
  { vers: "/usine", nom: "Projets", icone: "projets", fin: true },
  { vers: "/usine/clients", nom: "Clients", icone: "clients" },
  { vers: "/usine/factures", nom: "Facturation", icone: "facture" },
  { vers: "/usine/audit", nom: "Journal d'audit", icone: "audit" },
];
const TITRES: [RegExp, string][] = [
  [/^\/usine\/clients/, "Clients"], [/^\/usine\/factures/, "Facturation"], [/^\/usine\/audit/, "Journal d'audit"],
  [/^\/usine/, "Pilotage des projets"], [/^\/brief/, "Nouveau brief"], [/^\/projets\//, "Étude"], [/^\//, "Tableau de bord"],
];

function Horloge(): ReactNode {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 30_000); return () => clearInterval(i); }, []);
  return <span className="horloge">{t.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })} · {t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>;
}

function Coquille({ moi, enfants }: { moi: Moi; enfants: ReactNode }): ReactNode {
  const { definir } = useSession();
  const aller = useNavigate();
  const lieu = useLocation();
  const usine = estUsine(moi);
  const modules = usine ? MODULES_USINE : MODULES_CLIENT;
  const titre = TITRES.find(([r]) => r.test(lieu.pathname))?.[1] ?? "";
  const deconnexion = async (): Promise<void> => {
    await api("/api/auth/deconnexion", { methode: "POST" }).catch(() => undefined);
    definir(null);
    aller("/connexion");
  };
  return (
    <div className="coquille">
      <aside className="laterale">
        <div className="marque">
          <span className="puce-logo"><img src="/logo_data_a.png" alt="DATA'A" /></span>
          <div><small>{usine ? "Console usine" : "Espace client"}</small></div>
        </div>
        <div className="espace">{usine ? "Pilotage" : "Mes données"}</div>
        <nav aria-label="Navigation principale">
          {modules.map((m) => (
            <NavLink key={m.vers} to={m.vers} end={m.fin}><Icone nom={m.icone} />{m.nom}</NavLink>
          ))}
        </nav>
        <div className="pied-laterale">
          <div className="etat-systeme"><span className="point" aria-hidden="true" />Systèmes opérationnels</div>
          <div className="nom">{moi.nom}</div>
          <div className="org">{moi.organisation}</div>
          <button className="secondaire" onClick={() => void deconnexion()}>Se déconnecter</button>
        </div>
      </aside>
      <div className="principal">
        <header className="barre-haute">
          <span className="fil">DATA'A <span aria-hidden="true">›</span> {usine ? "Usine" : moi.organisation} <span aria-hidden="true">›</span> <strong>{titre}</strong></span>
          <div className="droite">
            <Horloge />
            <span className="chip-role">{usine ? "Usine · 2FA" : moi.role === "client_admin" ? "Administrateur" : "Lecteur"}</span>
          </div>
        </header>
        <main>{enfants}</main>
      </div>
    </div>
  );
}

function Protege({ enfants, usine }: { enfants: ReactNode; usine?: boolean }): ReactNode {
  const { moi } = useSession();
  if (!moi || moi.second_facteur_requis) return <Navigate to="/connexion" replace />;
  if (usine && !estUsine(moi)) return <Navigate to="/" replace />;
  if (!usine && estUsine(moi)) return <Navigate to="/usine" replace />;
  return <Coquille moi={moi} enfants={enfants} />;
}

export function Application(): ReactNode {
  const [moi, setMoi] = useState<Moi | null>(null);
  const [pret, setPret] = useState(false);
  const definir = (m: Moi | null): void => {
    if (m) retenirCsrf(m.csrf);
    setMoi(m);
  };
  useEffect(() => {
    api<Moi>("/api/moi").then(definir).catch(() => definir(null)).finally(() => setPret(true));
  }, []);
  if (!pret) return <main className="vide">Chargement…</main>;
  return (
    <ContexteSession.Provider value={{ moi, definir }}>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/" element={<Protege enfants={<ClientAccueil />} />} />
        <Route path="/projets/:id" element={<Protege enfants={<ClientProjet />} />} />
        <Route path="/brief" element={<Protege enfants={<Brief />} />} />
        <Route path="/usine" element={<Protege usine enfants={<UsineProjets />} />} />
        <Route path="/usine/clients" element={<Protege usine enfants={<UsineClients />} />} />
        <Route path="/usine/factures" element={<Protege usine enfants={<UsineFactures />} />} />
        <Route path="/usine/audit" element={<Protege usine enfants={<UsineAudit />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ContexteSession.Provider>
  );
}
