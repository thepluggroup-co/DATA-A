import { expect, test } from "@playwright/test";
import { COMPTES, connecter, MDP } from "./outils";

// Parcours de bout en bout, dans l'ordre réel du métier : le client consulte et croise ses données, dépose un brief ;
// l'usine contrôle, génère et partage les documents, facture et encaisse ; le client voit le résultat. Les deux clients
// restent isolés. Données entièrement fictives (jeu de démonstration).

test("accès protégé : sans session, retour à la connexion ; mauvais mot de passe refusé", async ({ page }) => {
  await page.goto("/usine");
  await expect(page).toHaveURL(/\/connexion$/);
  await page.getByLabel("Adresse e-mail").fill(COMPTES.a);
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe-1");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert")).toHaveText("identifiants incorrects");
});

test("client A : ses études, suivi agrégé, croisement, refus sous la base minimale, livrables, abonnement", async ({ page }) => {
  await connecter(page, COMPTES.a);
  const etudes = page.getByRole("table", { name: "Mes études" });
  await expect(etudes.getByRole("row")).toHaveCount(2);                              // en-tête + une seule étude : la sienne
  await expect(page.getByText("Formule : Accès + crédits d'études")).toBeVisible();
  await etudes.getByRole("link").first().click();

  // Suivi agrégé : quotas cible × ville, sans aucune donnée personnelle
  await expect(page.getByText(/271\s*fiches réalisées sur\s*300\s*prévues/)).toBeVisible();
  await expect(page.getByRole("table", { name: "Quotas par cible et par ville" }).getByRole("row")).toHaveCount(10);
  await expect(page.getByText(/non probabiliste/)).toBeVisible();

  // Croisement à la demande
  await page.getByRole("tab", { name: "Croisements" }).click();
  await page.getByLabel("En lignes").selectOption({ label: "Fréquence d'achat de fournitures scolaires" });
  await page.getByLabel("En colonnes").selectOption({ label: "Ville" });
  await page.getByRole("button", { name: "Calculer le croisement" }).click();
  const resultat = page.getByLabel("Résultat du croisement");
  await expect(resultat.getByText("Base (n)")).toBeVisible();
  await expect(resultat.getByText(/^Lecture :/)).toBeVisible();
  await expect(resultat.getByText(/non probabiliste/)).toBeVisible();
  const telechargement = page.waitForEvent("download");
  await resultat.getByRole("link", { name: /Exporter/ }).click();
  expect((await telechargement).suggestedFilename()).toMatch(/^croisement_\d+\.xlsx$/);

  // Garde-fou : sous-population trop petite → refus
  await page.getByLabel("Filtre (facultatif)").fill("VILLEREG == 3 and VOUSETES == 2");
  await page.getByRole("button", { name: "Calculer le croisement" }).click();
  await expect(page.getByRole("alert")).toContainText("Croisement refusé");
  await expect(page.getByRole("alert")).toContainText("base minimale");

  // Livrables partagés : la base d'analyse
  await page.getByRole("tab", { name: "Livrables" }).click();
  await expect(page.getByRole("link", { name: "BASE_ANALYSE_DEMO.sav" })).toBeVisible();
});

test("copilote client : réponse métier et preuves du suivi", async ({ page }) => {
  await connecter(page, COMPTES.a);
  const projetsCharges = page.waitForResponse((r) => r.url().endsWith("/api/projets") && r.request().method() === "GET");
  await page.getByRole("link", { name: "Copilote IA" }).click();
  const projets = await projetsCharges;
  expect(projets.status()).toBe(200);
  const liste = await projets.json() as { id: string }[];
  expect(liste).toHaveLength(1);
  await expect(page.getByLabel("Étude active")).toHaveValue(liste[0].id);
  await page.getByLabel("Question à DATA'A").fill("Où en sont les quotas par ville ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/271 fiches réalisées sur 300 prévues/)).toBeVisible();
  await expect(page.getByText(/Rédaction : réponse structurée/)).toBeVisible();
  await page.locator("details.assistant-preuves summary").click();
  await expect(page.getByText(/quota\..*Douala/).first()).toBeVisible();
  await expect(page.getByText("Aucune publication automatique")).toBeVisible();
});

test("client A dépose un brief : pré-estimation, puis l'étude apparaît dans sa liste", async ({ page }) => {
  await connecter(page, COMPTES.a);
  await page.getByRole("link", { name: "Nouveau brief" }).click();
  await page.getByLabel("Titre de l'étude").fill("Étude fictive — habitudes de lecture");
  await page.getByLabel("Besoin d'information").fill("Comprendre les achats de livres (fictif).");
  await page.getByLabel("Objectifs (un par ligne)").fill("Mesurer la fréquence d'achat\nIdentifier les lieux d'achat");
  await page.getByLabel("Cibles (une par ligne)").fill("Ménages\nLibrairies");
  await page.getByLabel("Nombre de fiches").fill("200");
  await page.getByLabel("Démarrage souhaité").fill("2026-11-02");
  await page.getByLabel("Échéance").fill("2026-12-18");
  await page.getByRole("button", { name: "Déposer le brief" }).click();
  await expect(page.getByRole("status")).toContainText("Pré-estimation : 200 fiches (DOUALA 100, YAOUNDE 100)");
  await page.getByRole("link", { name: "Mes études" }).click();
  await expect(page.getByRole("table", { name: "Mes études" }).getByText("Brief déposé")).toBeVisible();
});

test("isolation : le client B ne voit ni l'étude ni les données du client A", async ({ browser }) => {
  const a = await browser.newPage();
  await connecter(a, COMPTES.a);
  await a.getByRole("table", { name: "Mes études" }).getByRole("link").first().click();
  const urlA = a.url();
  const idA = urlA.split("/").pop();
  const b = await (await browser.newContext()).newPage();
  await connecter(b, COMPTES.b);
  await expect(b.getByRole("table", { name: "Mes études" }).getByText("Client B (fictif)")).toBeVisible();
  await expect(b.getByRole("table", { name: "Mes études" }).getByText("Client A (fictif)")).toHaveCount(0);
  await b.goto(urlA);
  await expect(b.getByRole("alert")).toHaveText("Étude introuvable.");
  const reponse = await b.request.get(`/api/projets/${idA}/suivi`);
  expect(reponse.status()).toBe(404);
});

test("usine : double authentification, cohérence, documents, partage, facture, encaissement, audit — vus par le client", async ({ browser }) => {
  const u = await browser.newPage();
  await connecter(u, COMPTES.usine, true);
  const file = u.getByRole("table", { name: "File des projets" });
  await expect(file.getByText("DEMO_A")).toBeVisible();
  await expect(file.getByText("DEMO_B")).toBeVisible();
  await u.getByRole("button", { name: "Ouvrir DEMO_A" }).click();
  await u.getByRole("button", { name: "Vérifier la cohérence" }).click();
  await expect(u.getByText("Sources du projet cohérentes.")).toBeVisible();
  await u.getByRole("button", { name: "Générer les documents" }).click();
  await expect(u.getByText(/\d+ documents générés\./)).toBeVisible({ timeout: 60_000 });
  await u.getByRole("button", { name: "Partager BADGES.docx" }).click();
  await expect(u.getByRole("button", { name: "Retirer BADGES.docx" })).toBeVisible();

  await u.getByRole("link", { name: "Facturation" }).click();
  await u.getByLabel("Client", { exact: true }).selectOption({ label: "Client A (fictif)" });
  await u.getByLabel("Libellé").fill("Étude fictive — acompte");
  await u.getByLabel("Montant HT (FCFA)").fill("500000");
  await u.getByRole("button", { name: "Émettre" }).click();
  await expect(u.getByRole("status")).toContainText(/Facture F-\d{4}-\d{4} émise\./);
  const numero = (await u.getByRole("status").textContent())!.match(/F-\d{4}-\d{4}/)![0];
  await u.getByLabel(`Moyen de paiement ${numero}`).selectOption("mobile_money");
  await u.getByRole("button", { name: `Encaisser ${numero}` }).click();
  await expect(u.getByRole("status")).toContainText("facture payée");

  await u.getByRole("link", { name: "Journal d'audit" }).click();
  await expect(u.getByText(/Chaîne d'empreintes intègre/)).toBeVisible();
  await expect(u.getByRole("table", { name: "Dernières entrées du journal" }).getByText("paiement_enregistre")).toBeVisible();

  // Le client A voit le document partagé et la facture payée
  const a = await (await browser.newContext()).newPage();
  await connecter(a, COMPTES.a);
  const factures = a.getByRole("table", { name: "Mes factures" });
  await expect(factures.getByRole("row", { name: new RegExp(numero) })).toContainText("Payée");
  await a.getByRole("table", { name: "Mes études" }).getByRole("link").first().click();
  await a.getByRole("tab", { name: "Livrables" }).click();
  await expect(a.getByRole("link", { name: "BADGES.docx" })).toBeVisible();
  const dl = a.waitForEvent("download");
  await a.getByRole("link", { name: "BADGES.docx" }).click();
  expect((await dl).suggestedFilename()).toBe("BADGES.docx");
});

test("usine : création d'un client et refus d'un mot de passe faible", async ({ page }) => {
  await connecter(page, COMPTES.usine, true);
  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByLabel("Organisation", { exact: true }).fill("Client D (fictif)");
  await page.getByLabel("Administrateur", { exact: true }).fill("Administrateur D (démo)");
  await page.getByLabel("E-mail de l'administrateur").fill("admin@client-d.demo.invalid");
  await page.getByLabel("Mot de passe initial").fill("court");
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("status")).toContainText("mot de passe trop faible");
  await page.getByLabel("Mot de passe initial").fill(MDP + "-D");
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("status")).toContainText("Client « Client D (fictif) » créé.");
  await expect(page.getByRole("table", { name: "Organisations" }).getByText("Client D (fictif)")).toBeVisible();
});

test("navigation client : recherche filtre et ouvre un module", async ({ page }) => {
  await connecter(page, COMPTES.a);
  const recherche = page.getByRole("searchbox", { name: "Rechercher un module" });
  await recherche.fill("brief");
  const navigation = page.getByRole("navigation", { name: "Navigation Études" });
  const lienBrief = navigation.getByRole("link", { name: "Nouveau brief" });
  await expect(lienBrief).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Mes études" })).toHaveCount(0);

  await lienBrief.click();
  await expect(page.getByRole("heading", { name: "Nouveau brief" })).toBeVisible();
});
