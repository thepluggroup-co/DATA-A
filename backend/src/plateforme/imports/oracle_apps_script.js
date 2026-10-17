/**
 * Oracle Apps Script : exécute un script EDM_ELECTRIQUE_TEMPS_REEL_Vn.gs dans une
 * machine virtuelle Node isolée (aucun service Google n'est appelé) et écrit sur la
 * sortie standard, en JSON, le dictionnaire et les colonnes de masque qu'il définit.
 *
 * Usage : node oracle_apps_script.js <chemin du script .gs>
 *
 * Les constantes de premier niveau (ITEMS, EN, IDENT, ZONES, QUOTAS, CONFIG,
 * VARS_ADMIN, VARS_CONTROLE) ne sont pas exportées par les scripts : on les lit en
 * évaluant une expression à la fin du script, dans le même contexte.
 */
"use strict";
const fs = require("fs");
const vm = require("vm");

const chemin = process.argv[2];
if (!chemin) {
  process.stderr.write("Usage : node oracle_apps_script.js <script.gs>\n");
  process.exit(2);
}
const source = fs.readFileSync(chemin, "utf8").replace(/^﻿/, "");

const NOMS = ["ITEMS", "EN", "IDENT", "ZONES", "QUOTAS", "CONFIG", "VARS_ADMIN", "VARS_CONTROLE"];
const lecture = NOMS.map(function (n) {
  return JSON.stringify(n) + ": (typeof " + n + " !== 'undefined' ? " + n + " : null)";
}).join(", ");
const expression = "\n;({" + lecture + ", colonnes: (typeof colonnesMasque_ === 'function' ? colonnesMasque_() : null) })";

const contexte = vm.createContext({ console: console });
const resultat = vm.runInContext(source + expression, contexte, { filename: chemin, timeout: 10000 });
process.stdout.write(JSON.stringify(resultat));
