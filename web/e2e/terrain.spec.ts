import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("105 fiches hors ligne survivent au rechargement et les lots restent idempotents", async ({ page }) => {
  const lots: unknown[][] = [];
  let autorisation = "";
  page.on("request", (request) => {
    if (request.url().endsWith("/api/terrain/fiches")) {
      lots.push((request.postDataJSON() as { fiches: unknown[] }).fiches);
      autorisation = request.headers().authorization ?? "";
    }
  });

  await page.goto("/terrain");
  await page.getByLabel("Code de mission").fill("DEMO-ENQ1-A2026-FICTIF");
  await page.getByLabel("Créer un PIN local (6 caractères minimum)").fill("123456");
  await page.getByRole("button", { name: "Activer" }).click();
  await expect(page.getByRole("heading", { name: "ENQ1 · Douala" })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByLabel("PIN de l’appareil")).toBeVisible();

  await page.context().setOffline(true);
  await page.reload();
  await page.getByLabel("PIN de l’appareil").fill("123456");
  await page.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(page.getByRole("heading", { name: "ENQ1 · Douala" })).toBeVisible();

  for (let index = 0; index < 105; index += 1) {
    await page.locator(".terrain-formulaire").evaluate((element) => {
      const formulaire = element as HTMLFormElement;
      for (const select of formulaire.querySelectorAll<HTMLSelectElement>("select[required]")) {
        const option = Array.from(select.options).find((candidate) => candidate.value !== "");
        if (option) {
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, option.value);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      for (const input of formulaire.querySelectorAll<HTMLInputElement>("input[required]")) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, input.type === "number" ? "1" : "Réponse fictive");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      for (const textarea of formulaire.querySelectorAll<HTMLTextAreaElement>("textarea[required]")) {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "Réponse fictive");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  }
  await expect(page.getByText("105 en attente")).toBeVisible();

  await page.context().setOffline(false);
  await expect(page.getByRole("status")).toContainText("105 nouvelle(s)", { timeout: 30_000 });
  await expect(page.getByText("0 en attente")).toBeVisible();
  expect(autorisation).toMatch(/^Bearer /);
  expect(lots.map((lot) => lot.length)).toEqual([100, 5]);

  for (const lot of lots) {
    const renvoi = await page.request.post("/api/terrain/fiches", {
      data: { fiches: lot }, headers: { Authorization: autorisation },
    });
    expect(renvoi.ok()).toBeTruthy();
    expect(await renvoi.json()).toMatchObject({ nouvelles: 0, deja_recues: lot.length, refusees: [] });
  }
});