/**
 * Oracle du rapport journalier : appelle `calculerRapport_` de V11 (exécuté sous Node).
 * Entrée (stdin, JSON) : { script, base: [fiches avec _jour, _heure, _rej], p: paramètres au format de V11 }
 * Sortie (stdout, JSON) : le rapport calculé par V11.
 */
"use strict";
const fs = require("fs");
const entree = JSON.parse(fs.readFileSync(0, "utf8"));
const m = require(entree.script);
process.stdout.write(JSON.stringify(m.calculerRapport_(entree.base, entree.p)));
