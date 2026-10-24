import { expect, test, type Page } from "@playwright/test";
import { COMPTES, connecter } from "./outils";

// Éditeur du dictionnaire (console usine) : modification d'un libellé, enregistrement versionné, relecture après
// rechargement, puis refus d'un enregistrement fait sur une version périmée (409). Projet FICTIF DEMO_B : aucune
// mission ni fiche, donc dictionnaire modifiable quel que soit l'ordre des autres tests.

async function ouvrirDemoB(p: Page): Promise<void> {
  const choix = p.getByLabel("Projet", { exact: true });
  const valeur = (await choix.locator("option", { hasText: /^DEMO_B/ }).getAttribute("value"))!;
  if ((await choix.inputValue()) !== valeur) {
    // attendre la réponse de CE projet : sinon on lirait la version du projet affiché avant
    const reponse = p.waitForResponse((r) => r.request().method() === "GET" && r.url().endsWith(`/api/usine/projets/${valeur}/dictionnaire`));
    await choix.selectOption(valeur);
    await reponse;
  }
  await expect(choix).toHaveValue(valeur);
  await expect(p.getByLabel("Libellé FREQACHA")).toBeVisible();
}

const version = (p: Page) => p.locator(".kpi", { hasText: "Version" }).locator(".valeur");

test("usine : libellé modifié, version suivante après rechargement, refus sur version périmée", async ({ browser }) => {
  const contexte = await browser.newContext();
  const u = await contexte.newPage();
  await connecter(u, COMPTES.usine, true);
  await u.getByRole("link", { name: "Formulaire & dictionnaire" }).click();
  await ouvrirDemoB(u);
  const initiale = (await version(u).textContent())!.trim();
  await expect(u.getByRole("button", { name: "Enregistrer le dictionnaire" })).toBeDisabled();   // rien de modifié

  // Deuxième onglet, même session : il garde la version initiale et deviendra périmé
  const vieux = await contexte.newPage();
  await vieux.goto("/usine/formulaire");
  await ouvrirDemoB(vieux);
  await expect(version(vieux)).toHaveText(initiale);

  const champ = u.getByLabel("Libellé FREQACHA");
  const nouveau = `${await champ.inputValue()} (reformulé)`;
  await champ.fill(nouveau);
  await u.getByRole("button", { name: "Enregistrer le dictionnaire" }).click();
  await expect(u.getByRole("status")).toContainText("Dictionnaire enregistré : version");
  const suivante = (await version(u).textContent())!.trim();
  expect(suivante).not.toBe(initiale);
  expect(Number(suivante)).toBe(Number(initiale) + 1);
  const liste = u.getByRole("table", { name: "Liste des changements" });
  await expect(liste.getByRole("row", { name: /FREQACHA/ })).toContainText("libellé modifié");

  await u.reload();
  await ouvrirDemoB(u);
  await expect(version(u)).toHaveText(suivante);
  await expect(u.getByLabel("Libellé FREQACHA")).toHaveValue(nouveau);

  // Onglet périmé : le serveur refuse (409) et l'écran le dit
  await vieux.getByLabel("Libellé FREQACHA").fill("Fréquence d'achat (autre reformulation)");
  await vieux.getByRole("button", { name: "Enregistrer le dictionnaire" }).click();
  await expect(vieux.getByRole("alert").filter({ hasText: "rechargez la page" })).toContainText(`version ${suivante}`);
  await vieux.getByRole("button", { name: "Recharger le dictionnaire" }).click();
  await expect(version(vieux)).toHaveText(suivante);
  await expect(vieux.getByLabel("Libellé FREQACHA")).toHaveValue(nouveau);
  await contexte.close();
});
