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
import { UsineOperations } from "./pages/UsineOperations";
import { UsineConnexions } from "./pages/UsineConnexions";
import { UsineParametrage } from "./pages/UsineParametrage";
import { UsineSupervision } from "./pages/UsineSupervision";
import { UsineAnalyses } from "./pages/UsineAnalyses";
import { UsineFormulaire } from "./pages/UsineFormulaire";
import { UsineEchantillonnage } from "./pages/UsineEchantillonnage";
import { UsineFormation } from "./pages/UsineFormation";
import { UsineNotifications } from "./pages/UsineNotifications";
import { UsineTerrain } from "./pages/UsineTerrain";
import { UsineRecommandations } from "./pages/UsineRecommandations";
import { Assistant } from "./pages/Assistant";

type Session = { moi: Moi | null; definir: (m: Moi | null) => void };
const ContexteSession = createContext<Session>({ moi: null, definir: () => undefined });
type Apparence = { nuit: boolean; basculer: () => void };
const ContexteApparence = createContext<Apparence>({ nuit: true, basculer: () => undefined });
export const useSession = (): Session => useContext(ContexteSession);
export const estCabinet = (m: Moi | null): boolean => !!m && (m.role.startsWith("usine") || m.role.startsWith("cabinet") || m.role.startsWith("consultant") || m.role === "expert_etude") && !m.second_facteur_requis;
export const estUsine = estCabinet;

const MODULES_CLIENT = [
  { vers: "/", nom: "Mes études", icone: "tableau", fin: true },
  { vers: "/brief", nom: "Nouveau brief", icone: "brief" },
  { vers: "/assistant", nom: "Copilote IA", icone: "brief" },
];
const MODULES_USINE = [
  { vers: "/assistant", nom: "Copilote IA", icone: "brief" },
  { vers: "/usine/operations", nom: "Centre opérations", icone: "tableau" },
  { vers: "/usine/connexions", nom: "Connexions", icone: "bouclier" },
  { vers: "/usine/parametrage", nom: "Paramétrage", icone: "audit" },
  { vers: "/usine/supervision", nom: "Supervision terrain", icone: "fiches" },
  { vers: "/usine/analyses", nom: "Analyses & validations", icone: "croisement" },
  { vers: "/usine/formulaire", nom: "Formulaire & dictionnaire", icone: "fiches" },
  { vers: "/usine/echantillonnage", nom: "Échantillonnage", icone: "projets" },
  { vers: "/usine/formation", nom: "Formation enquêteurs", icone: "clients" },
  { vers: "/usine/notifications", nom: "Alertes", icone: "audit" },
  { vers: "/usine/terrain", nom: "Espace terrain", icone: "fiches" },
  { vers: "/usine/recommandations", nom: "Recommandations", icone: "brief" },
  { vers: "/usine", nom: "Projets", icone: "projets", fin: true },
  { vers: "/usine/clients", nom: "Clients", icone: "clients" },
  { vers: "/usine/factures", nom: "Facturation", icone: "facture" },
  { vers: "/usine/audit", nom: "Journal d'audit", icone: "audit" },
];
const SOUS_ONGLETS: Record<string, { vers: string; nom: string }[]> = {
  "/usine/operations": [{ vers: "/usine/operations", nom: "Vue générale" }, { vers: "/usine/supervision", nom: "Activité" }, { vers: "/usine/notifications", nom: "Alertes" }],
  "/usine/parametrage": [{ vers: "/usine/parametrage", nom: "Paramètres" }, { vers: "/usine/connexions", nom: "Connexions" }],
  "/usine/connexions": [{ vers: "/usine/connexions", nom: "Connecteurs" }, { vers: "/usine/parametrage", nom: "Paramètres" }],
  "/usine/analyses": [{ vers: "/usine/analyses", nom: "Validation" }, { vers: "/usine/recommandations", nom: "Recommandations" }],
  "/usine/formulaire": [{ vers: "/usine/formulaire", nom: "Questions" }, { vers: "/usine/echantillonnage", nom: "Échantillon" }],
  "/usine/terrain": [{ vers: "/usine/terrain", nom: "Collecte" }, { vers: "/usine/supervision", nom: "Supervision" }, { vers: "/usine/formation", nom: "Formation" }],
  "/assistant": [{ vers: "/assistant", nom: "Copilote" }, { vers: "/usine/parametrage", nom: "Garde-fous" }],
};
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
  const { nuit, basculer } = useContext(ContexteApparence);
  const usine = estUsine(moi);
  const modules = usine ? MODULES_USINE : MODULES_CLIENT;
  const titre = TITRES.find(([r]) => r.test(lieu.pathname))?.[1] ?? "";
  const deconnexion = async (): Promise<void> => {
    await api("/api/auth/deconnexion", { methode: "POST" }).catch(() => undefined);
    definir(null);
    aller("/connexion");
  };
  return (
    <div className={`coquille ${nuit ? "theme-nuit" : "theme-clair"}`}>
      <aside className="laterale">
        <div className="marque">
          <span className="puce-logo"><img src="/logo_data_a.png" alt="DATA'A" /></span>
          <div><small>{usine ? "Console cabinet" : "Espace client"}</small></div>
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
          <span className="fil">DATA'A <span aria-hidden="true">›</span> {usine ? "Cabinet" : moi.organisation} <span aria-hidden="true">›</span> <strong>{titre}</strong></span>
          <div className="droite">
            <Horloge />
            <button className="bouton-theme" onClick={basculer} aria-label={nuit ? "Activer le mode clair" : "Activer le mode nuit"}>{nuit ? "☼ Clair" : "☾ Nuit"}</button>
            <span className="chip-role">{usine ? ({ cabinet_admin: "Cabinet · admin", cabinet_operateur: "Cabinet · opérateur", consultant_junior: "Consultant junior", consultant_senior: "Consultant senior", expert_etude: "Expert étude", enqueteur: "Enquêteur", usine_admin: "Cabinet · admin", usine_operateur: "Cabinet · opérateur" } as Record<string, string>)[moi.role] ?? "Cabinet" : moi.role === "client_admin" ? "Administrateur" : "Lecteur"}</span>
          </div>
        </header>
        {SOUS_ONGLETS[lieu.pathname] && <nav className="sous-onglets" aria-label="Sous-navigation">{SOUS_ONGLETS[lieu.pathname].map((s) => <NavLink key={s.vers} to={s.vers}>{s.nom}</NavLink>)}</nav>}
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
  const [nuit, setNuit] = useState(() => localStorage.getItem("dataa-theme") !== "clair");
  const basculer = (): void => setNuit((v) => { const prochain = !v; localStorage.setItem("dataa-theme", prochain ? "nuit" : "clair"); return prochain; });
  useEffect(() => { document.body.classList.toggle("theme-clair", !nuit); }, [nuit]);
  const definir = (m: Moi | null): void => {
    if (m) retenirCsrf(m.csrf);
    setMoi(m);
  };
  useEffect(() => {
    api<Moi>("/api/moi").then(definir).catch(() => definir(null)).finally(() => setPret(true));
  }, []);
  if (!pret) return <main className="vide">Chargement…</main>;
  return (
    <ContexteApparence.Provider value={{ nuit, basculer }}>
    <ContexteSession.Provider value={{ moi, definir }}>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/" element={<Protege enfants={<ClientAccueil />} />} />
        <Route path="/projets/:id" element={<Protege enfants={<ClientProjet />} />} />
        <Route path="/brief" element={<Protege enfants={<Brief />} />} />
        <Route path="/assistant" element={<Protege enfants={<Assistant />} />} />
        <Route path="/usine" element={<Protege usine enfants={<UsineProjets />} />} />
        <Route path="/usine/operations" element={<Protege usine enfants={<UsineOperations />} />} />
        <Route path="/usine/connexions" element={<Protege usine enfants={<UsineConnexions />} />} />
        <Route path="/usine/parametrage" element={<Protege usine enfants={<UsineParametrage />} />} />
        <Route path="/usine/supervision" element={<Protege usine enfants={<UsineSupervision />} />} />
        <Route path="/usine/analyses" element={<Protege usine enfants={<UsineAnalyses />} />} />
        <Route path="/usine/formulaire" element={<Protege usine enfants={<UsineFormulaire />} />} />
        <Route path="/usine/echantillonnage" element={<Protege usine enfants={<UsineEchantillonnage />} />} />
        <Route path="/usine/formation" element={<Protege usine enfants={<UsineFormation />} />} />
        <Route path="/usine/notifications" element={<Protege usine enfants={<UsineNotifications />} />} />
        <Route path="/usine/terrain" element={<Protege usine enfants={<UsineTerrain />} />} />
        <Route path="/usine/recommandations" element={<Protege usine enfants={<UsineRecommandations />} />} />
        <Route path="/usine/clients" element={<Protege usine enfants={<UsineClients />} />} />
        <Route path="/usine/factures" element={<Protege usine enfants={<UsineFactures />} />} />
        <Route path="/usine/audit" element={<Protege usine enfants={<UsineAudit />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ContexteSession.Provider>
    </ContexteApparence.Provider>
  );
}
