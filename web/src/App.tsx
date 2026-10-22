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
import { UsineSynthese } from "./pages/UsineSynthese";
import { TerrainMobile } from "./pages/TerrainMobile";

type Session = { moi: Moi | null; definir: (m: Moi | null) => void };
const ContexteSession = createContext<Session>({ moi: null, definir: () => undefined });
type Apparence = { nuit: boolean; basculer: () => void };
const ContexteApparence = createContext<Apparence>({ nuit: true, basculer: () => undefined });
export const useSession = (): Session => useContext(ContexteSession);
export const estCabinet = (m: Moi | null): boolean => !!m && (m.role.startsWith("usine") || m.role.startsWith("cabinet") || m.role.startsWith("consultant") || m.role === "expert_etude") && !m.second_facteur_requis;
export const estUsine = estCabinet;

const ACCUEIL_ROLE: Record<string, string> = {
  client_admin: "/", client_lecteur: "/", enqueteur: "/terrain",
  consultant_junior: "/usine/supervision", consultant_senior: "/usine/analyses", expert_etude: "/usine/analyses",
  usine_admin: "/usine", usine_operateur: "/usine", cabinet_admin: "/usine", cabinet_operateur: "/usine",
};
const PERMISSIONS_MODULE: Record<string, string[]> = {
  "/": ["projet.lire"], "/brief": ["brief.creer"], "/assistant": ["projet.lire", "projet.piloter", "analyse.executer", "analyse.programmer", "analyse.valider", "analyse.superviser"],
  "/usine/operations": ["projet.piloter"], "/usine": ["projet.piloter"],
  "/usine/formulaire": ["projet.piloter"], "/usine/echantillonnage": ["projet.piloter"],
  "/usine/formation": ["terrain.deployer"], "/usine/supervision": ["terrain.superviser"], "/usine/terrain": ["terrain.deployer"],
  "/usine/notifications": ["qualite.signaler", "qualite.valider"],
  "/usine/analyses": ["analyse.executer", "analyse.programmer", "analyse.valider", "analyse.superviser"],
  "/usine/synthese": ["livraison.valider", "analyse.valider", "analyse.superviser"],
  "/usine/recommandations": ["recommandations.ecrire"],
  "/usine/clients": ["equipe.lire", "equipe.ecrire"], "/usine/factures": ["facturation.gerer"],
  "/usine/audit": ["equipe.ecrire"], "/usine/parametrage": ["equipe.ecrire"], "/usine/connexions": ["equipe.ecrire"],
};

function accueilRole(moi: Moi): string {
  return ACCUEIL_ROLE[moi.role] ?? "/connexion";
}

function peutAcceder(moi: Moi, route: string): boolean {
  if (route === "/brief" && moi.role !== "client_admin") return false;
  const permissions = PERMISSIONS_MODULE[route];
  return !permissions || permissions.some((permission) => moi.permissions?.includes(permission));
}

type ModuleNavigation = { vers: string; nom: string; icone: string; groupe: string; fin?: boolean };

const MODULES_CLIENT: ModuleNavigation[] = [
  { vers: "/", nom: "Mes études", icone: "tableau", groupe: "Études", fin: true },
  { vers: "/brief", nom: "Nouveau brief", icone: "brief", groupe: "Études" },
  { vers: "/assistant", nom: "Copilote IA", icone: "brief", groupe: "Aide" },
];
const MODULES_USINE: ModuleNavigation[] = [
  { vers: "/usine/operations", nom: "Centre opérations", icone: "tableau", groupe: "Pilotage" },
  { vers: "/usine", nom: "Projets", icone: "projets", groupe: "Pilotage", fin: true },
  { vers: "/usine/formulaire", nom: "Formulaire & dictionnaire", icone: "fiches", groupe: "Préparation" },
  { vers: "/usine/echantillonnage", nom: "Échantillonnage", icone: "projets", groupe: "Préparation" },
  { vers: "/usine/formation", nom: "Formation enquêteurs", icone: "clients", groupe: "Préparation" },
  { vers: "/usine/supervision", nom: "Supervision terrain", icone: "fiches", groupe: "Terrain" },
  { vers: "/usine/terrain", nom: "Espace terrain", icone: "fiches", groupe: "Terrain" },
  { vers: "/usine/notifications", nom: "Alertes", icone: "audit", groupe: "Terrain" },
  { vers: "/usine/analyses", nom: "Analyses & validations", icone: "croisement", groupe: "Analyse et livraison" },
  { vers: "/usine/synthese", nom: "Synthèse exécutive", icone: "rapport", groupe: "Analyse et livraison" },
  { vers: "/usine/recommandations", nom: "Recommandations", icone: "brief", groupe: "Analyse et livraison" },
  { vers: "/assistant", nom: "Copilote IA", icone: "brief", groupe: "Analyse et livraison" },
  { vers: "/usine/clients", nom: "Clients", icone: "clients", groupe: "Administration" },
  { vers: "/usine/factures", nom: "Facturation", icone: "facture", groupe: "Administration" },
  { vers: "/usine/audit", nom: "Journal d'audit", icone: "audit", groupe: "Administration" },
  { vers: "/usine/parametrage", nom: "Paramétrage", icone: "audit", groupe: "Administration" },
  { vers: "/usine/connexions", nom: "Connexions", icone: "bouclier", groupe: "Administration" },
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
  [/^\/usine\/operations$/, "Centre opérations"], [/^\/usine\/clients/, "Clients"], [/^\/usine\/factures/, "Facturation"],
  [/^\/usine\/audit/, "Journal d'audit"], [/^\/usine\/connexions/, "Connexions"], [/^\/usine\/parametrage/, "Paramétrage"],
  [/^\/usine\/supervision/, "Supervision terrain"], [/^\/usine\/analyses/, "Analyses & validations"],
  [/^\/usine\/synthese/, "Synthèse exécutive"], [/^\/usine\/formulaire/, "Formulaire & dictionnaire"],
  [/^\/usine\/echantillonnage/, "Échantillonnage"], [/^\/usine\/formation/, "Formation enquêteurs"],
  [/^\/usine\/notifications/, "Alertes"], [/^\/usine\/terrain/, "Espace terrain"],
  [/^\/usine\/recommandations/, "Recommandations"], [/^\/usine$/, "Projets"], [/^\/usine/, "Pilotage des projets"],
  [/^\/brief/, "Nouveau brief"], [/^\/assistant/, "Copilote IA"], [/^\/projets\//, "Étude"], [/^\/$/, "Mes études"],
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
  const [etatApi, setEtatApi] = useState<"verification" | "ok" | "erreur">("verification");
  const [commande, setCommande] = useState(false);
  const [rechercheCommande, setRechercheCommande] = useState("");
  const [rechercheNavigation, setRechercheNavigation] = useState("");
  useEffect(() => { const clavier = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommande(true); } if (e.key === "Escape") setCommande(false); }; window.addEventListener("keydown", clavier); return () => window.removeEventListener("keydown", clavier); }, []);
  useEffect(() => {
    let actif = true;
    const verifierApi = (): void => {
      void api<Moi>("/api/moi").then(() => { if (actif) setEtatApi("ok"); })
        .catch(() => { if (actif) setEtatApi("erreur"); });
    };
    verifierApi();
    const intervalle = window.setInterval(verifierApi, 30_000);
    return () => { actif = false; window.clearInterval(intervalle); };
  }, []);
  const usine = estUsine(moi);
  const modules = (usine ? MODULES_USINE : MODULES_CLIENT).filter((m) => peutAcceder(moi, m.vers));
  const modulesFiltres = modules.filter((m) => m.nom.toLocaleLowerCase("fr").includes(rechercheNavigation.trim().toLocaleLowerCase("fr")));
  const groupes = [...new Set(modulesFiltres.map((m) => m.groupe))];
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
        <label className="recherche-navigation"><span className="sr-only">Rechercher un module</span><input type="search" aria-label="Rechercher un module" placeholder="Rechercher un module" value={rechercheNavigation} onChange={(e) => setRechercheNavigation(e.target.value)} /></label>
        {groupes.length ? groupes.map((groupe) => (
          <div className="navigation-bloc" key={groupe}>
            <div className="navigation-titre">{groupe}</div>
            <nav aria-label={`Navigation ${groupe}`}>
              {modulesFiltres.filter((m) => m.groupe === groupe).map((m) =>
                <NavLink key={m.vers} to={m.vers} end={m.fin}><Icone nom={m.icone} /><span>{m.nom}</span></NavLink>
              )}
            </nav>
          </div>
        )) : <p className="mention navigation-vide">Aucun module ne correspond à cette recherche.</p>}
        <div className="pied-laterale">
          <div className="etat-systeme" aria-live="polite"><span className={`point ${etatApi}`} aria-hidden="true" />
            {etatApi === "verification" ? "Vérification API…" : etatApi === "ok" ? "API disponible" : "API indisponible"}
          </div>
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
      {commande && <div className="commande-fond" role="dialog" aria-label="Commande globale" onClick={() => setCommande(false)}><div className="commande" onClick={(e) => e.stopPropagation()}><input autoFocus value={rechercheCommande} onChange={(e) => setRechercheCommande(e.target.value)} placeholder="Rechercher un module…" aria-label="Rechercher un module" onKeyDown={(e) => { if (e.key === "Escape") setCommande(false); }} /><div className="commande-liens">{modules.filter((m) => m.nom.toLowerCase().includes(rechercheCommande.toLowerCase())).slice(0, 10).map((m) => <NavLink key={m.vers} to={m.vers} onClick={() => { setCommande(false); setRechercheCommande(""); }}>{m.nom}</NavLink>)}{!modules.some((m) => m.nom.toLowerCase().includes(rechercheCommande.toLowerCase())) && <span className="mention">Aucun module correspondant.</span>}</div><small>Échap pour fermer · Ctrl + K pour ouvrir</small></div></div>}
    </div>
  );
}

function Protege({ enfants, usine, permissions }: { enfants: ReactNode; usine?: boolean; permissions?: string[] }): ReactNode {
  const { moi } = useSession();
  const lieu = useLocation();
  if (!moi || moi.second_facteur_requis) return <Navigate to="/connexion" replace />;
  const accueil = accueilRole(moi);
  if (moi.role === "enqueteur") return lieu.pathname === "/terrain" ? enfants : <Navigate to={accueil} replace />;
  if (usine && !estUsine(moi)) return <Navigate to={accueil} replace />;
  if (!usine && estUsine(moi)) return <Navigate to={accueil} replace />;
  if (usine && lieu.pathname === "/usine" && accueil !== "/usine") return <Navigate to={accueil} replace />;
  const permissionsRequises = permissions ?? PERMISSIONS_MODULE[lieu.pathname];
  if (permissionsRequises && !permissionsRequises.some((permission) => moi.permissions?.includes(permission))) return <Navigate to={accueil} replace />;
  if (!usine && !["client_admin", "client_lecteur"].includes(moi.role)) return <Navigate to={accueil} replace />;
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
        <Route path="/terrain" element={<TerrainMobile />} />
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/" element={<Protege permissions={["projet.lire"]} enfants={<ClientAccueil lectureSeule={moi?.role === "client_lecteur"} />} />} />
        <Route path="/projets/:id" element={<Protege permissions={["projet.lire"]} enfants={<ClientProjet lectureSeule={moi?.role === "client_lecteur"} />} />} />
        <Route path="/brief" element={<Protege permissions={["brief.creer"]} enfants={<Brief />} />} />
        <Route path="/assistant" element={<Protege permissions={PERMISSIONS_MODULE["/assistant"]} enfants={<Assistant usine={estUsine(moi)} />} />} />
        <Route path="/usine" element={<Protege usine enfants={<UsineProjets />} />} />
        <Route path="/usine/operations" element={<Protege usine enfants={<UsineOperations />} />} />
        <Route path="/usine/connexions" element={<Protege usine enfants={<UsineConnexions />} />} />
        <Route path="/usine/parametrage" element={<Protege usine enfants={<UsineParametrage />} />} />
        <Route path="/usine/supervision" element={<Protege usine enfants={<UsineSupervision />} />} />
        <Route path="/usine/analyses" element={<Protege usine enfants={<UsineAnalyses />} />} />
        <Route path="/usine/synthese" element={<Protege usine enfants={<UsineSynthese />} />} />
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
