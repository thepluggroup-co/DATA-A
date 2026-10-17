/**
 * Oracle de codification : fait passer des fiches par `construireLigne_` de V11 (exécuté sous Node).
 *
 * Entrée (stdin, JSON) : { script, enqueteurs: {ENQ1: "DOUALA"|""}, seuilDelai, fiches: [{ liste: [{titre, rep, lignes}], horodatage: ms, seqForce? }] }
 * Sortie (stdout, JSON) : [{ ligne: [67 valeurs], contact: [17 valeurs] }]
 *
 * `Utilities.formatDate` (Google) est remplacé par un formatage au fuseau Africa/Douala.
 * Les fiches sont traitées dans l'ordre fourni, avec un état partagé (numérotation, délais,
 * téléphones déjà vus), exactement comme dans `reconstruire_` de V11.
 */
"use strict";
const fs = require("fs");
const entree = JSON.parse(fs.readFileSync(0, "utf8"));
const m = require(entree.script);

const parties = (d) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).formatToParts(d).map((p) => [p.type, p.value]));
const fmt = (d, f) => {
  const p = parties(d);
  if (f === "yyyy-MM-dd") return `${p.year}-${p.month}-${p.day}`;
  if (f === "HH:mm") return `${p.hour}:${p.minute}`;
  throw new Error("format non géré : " + f);
};

const etat = { seq: {}, dernier: {} }, telsVus = {};
const sortie = entree.fiches.map((f) => {
  const fiche = { lu: m.structurer_(f.liste), horodatage: new Date(f.horodatage), enqueteurs: entree.enqueteurs,
                  seuilDelai: entree.seuilDelai, telsVus: telsVus, seqForce: f.seqForce || 0 };
  const ligne = m.construireLigne_(fiche, etat, fmt);
  return { ligne: ligne, contact: fiche.contact };
});
process.stdout.write(JSON.stringify(sortie));
