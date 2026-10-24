import { expect, test, type Page } from "@playwright/test";
import { COMPTES, connecter } from "./outils";

// Atelier du formulaire, de bout en bout dans le navigateur (projet FICTIF DEMO_B) : ajout d'une question dont le code
// suit le libellé, changement de type, vérification à blanc, enregistrement en version suivante, aperçu, puis
// diffusion d'un lien par poste du plan de terrain (création des codes, QR code) et activation du téléphone par le lien.

async function ouvrirDemoB(p: Page): Promise<void> {
  const choix = p.getByLabel("Projet", { exact: true });
  const valeur = (await choix.locator("option", { hasText: /^DEMO_B/ }).getAttribute("value"))!;
  if ((await choix.inputValue()) !== valeur) {
    const reponse = p.waitForResponse((r) => r.request().method() === "GET" && r.url().endsWith(`/api/usine/projets/${valeur}/dictionnaire`));
    await choix.selectOption(valeur);
    await reponse;
  }
  await expect(p.getByLabel("Libellé FREQACHA")).toBeVisible();
}

const version = (p: Page) => p.locator(".kpi", { hasText: "Version" }).locator(".valeur");

test("usine : question ajoutée, vérifiée, enregistrée, puis liens diffusés et activés", async ({ page, browser }) => {
  await connecter(page, COMPTES.usine, true);
  await page.getByRole("link", { name: "Formulaire & dictionnaire" }).click();
  await ouvrirDemoB(page);
  const initiale = Number((await version(page).textContent())!.trim());

  // Ajout dans la dernière section : le code proposé suit le libellé saisi (convention des 8 lettres)
  const ajouts = page.getByRole("button", { name: /^Ajouter une question dans/ });
  await ajouts.last().click();
  const nouvelle = page.getByLabel(/^Libellé NOQU/);
  await nouvelle.fill("Marques de cahiers connues");
  await expect(page.getByLabel("Libellé MACACOXX")).toHaveValue("Marques de cahiers connues");
  await page.getByLabel("Type MACACOXX").selectOption("choix_multiple");
  await page.getByLabel("Modalité 1 de MACACOXX").fill("Marque fictive A");
  await page.getByRole("button", { name: "Ajouter une modalité" }).last().click();
  await page.getByLabel("Modalité 2 de MACACOXX").fill("Marque fictive B");

  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page.getByRole("status")).toContainText(`enregistrable en version ${String(initiale + 1).padStart(2, "0")}`);
  await expect(page.getByRole("table", { name: "Changements prévus" })).toContainText("question ajoutée");

  await page.getByRole("button", { name: "Enregistrer le dictionnaire" }).click();
  await expect(page.getByRole("status")).toContainText("Dictionnaire enregistré : version");
  await expect(version(page)).toHaveText(String(initiale + 1).padStart(2, "0"));
  await expect(page.getByRole("button", { name: "Enregistrer le dictionnaire" })).toBeDisabled();

  await page.getByRole("tab", { name: "Aperçu" }).click();
  await expect(page.getByLabel("Aperçu du formulaire")).toContainText("Marques de cahiers connues");

  // Diffusion : un lien par poste du plan de terrain
  await page.getByRole("tab", { name: "Diffusion des liens" }).click();
  const liens = page.getByRole("table", { name: "Liens par enquêteur" });
  await expect(liens).toBeVisible();
  const creer = page.getByRole("button", { name: /^Créer les liens manquants/ });
  await creer.click();
  await expect(page.getByRole("status")).toContainText("lien(s) créé(s)");
  const premiereLigne = liens.locator("tbody tr").first();
  const code = (await premiereLigne.locator("code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){4}$/);
  await premiereLigne.getByRole("button", { name: "QR code" }).click();
  await expect(page.getByRole("img", { name: /^QR code Mission/ })).toBeVisible();

  // Le lien pré-remplit l'activation sur le téléphone, puis disparaît de la barre d'adresse
  const telephone = await browser.newPage();
  await telephone.goto(`/terrain#code=${encodeURIComponent(code)}`);
  await expect(telephone.getByLabel("Code de mission")).toHaveValue(code);
  expect(new URL(telephone.url()).hash).toBe("");
  await telephone.close();
});
