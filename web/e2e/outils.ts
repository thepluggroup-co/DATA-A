import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Comptes et secret du jeu de DÉMONSTRATION (backend/src/plateforme/saas/demo.py), fictifs et publics.
export const MDP = "Demo-DATAA-2026";
export const COMPTES = { usine: "usine@demo.invalid", a: "admin@client-a.demo.invalid", b: "admin@client-b.demo.invalid" };
const TOTP_DEMO = "JBSWY3DPEHPK3PXP";

function base32(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "")) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const octets = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) octets.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(octets);
}

/** Code TOTP (RFC 6238, SHA-1, 6 chiffres, 30 s), comme une application d'authentification. */
export function totp(secret = TOTP_DEMO, t = Date.now()): string {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / 30)));
  const h = createHmac("sha1", base32(secret)).update(compteur).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return (n % 1_000_000).toString().padStart(6, "0");
}

export async function connecter(page: Page, email: string, usine = false): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(MDP);
  await page.getByRole("button", { name: "Se connecter" }).click();
  if (usine) {
    await expect(page.getByRole("heading", { name: "Double authentification" })).toBeVisible();
    await page.getByLabel("Code à 6 chiffres").fill(totp());
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page.getByRole("heading", { name: "File des projets" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Mes études" })).toBeVisible();
  }
}
