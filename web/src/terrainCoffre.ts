export type Coffre = { sel: string; iv: string; contenu: string };

function encoder(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (octet) => String.fromCharCode(octet)).join(""));
}

function decoder(valeur: string): Uint8Array {
  return Uint8Array.from(atob(valeur), (caractere) => caractere.charCodeAt(0));
}

export async function derivierCle(pin: string, sel = crypto.getRandomValues(new Uint8Array(16))): Promise<{ cle: CryptoKey; sel: string }> {
  const materiau = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  const cle = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sel, iterations: 310_000, hash: "SHA-256" },
    materiau,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { cle, sel: encoder(sel) };
}

export async function chiffrer<T>(donnees: T, cle: CryptoKey, sel: string): Promise<Coffre> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const contenu = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cle, new TextEncoder().encode(JSON.stringify(donnees)));
  return { sel, iv: encoder(iv), contenu: encoder(new Uint8Array(contenu)) };
}

export async function dechiffrer<T>(coffre: Coffre, pin: string): Promise<{ donnees: T; cle: CryptoKey }> {
  const { cle } = await derivierCle(pin, decoder(coffre.sel));
  const brut = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decoder(coffre.iv) }, cle, decoder(coffre.contenu));
  return { donnees: JSON.parse(new TextDecoder().decode(brut)) as T, cle };
}