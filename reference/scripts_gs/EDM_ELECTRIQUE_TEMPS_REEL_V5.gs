/**
 * =====================================================================
 *  EDM ELECTRIQUE CAMEROUN - MASQUE CODIFIE TEMPS REEL
 *  Version 5 (05/10/2026) - CORRECTIF DE SYNCHRONISATION, terrain en cours
 *  Formulaire : https://docs.google.com/forms/d/e/1FAIpQLSdEmfwEHV-E0wI1IcUgGthmc7pB9UaOnIjz0NyeCMX7bqEzhw/viewform
 * =====================================================================
 *
 *  >>> MISE A JOUR PENDANT LE TERRAIN (5 minutes, les enqueteurs continuent) <<<
 *   1. Ouvrir le projet Apps Script ou tourne la version actuelle
 *      (formulaire en mode edition > ⋮ > Editeur de scripts).
 *   2. Remplacer TOUT le code par ce fichier, enregistrer.
 *   3. Executer la fonction « reparer » (PAS « installer »).
 *   4. Ouvrir l'onglet SANTE_SYNC du classeur : tout doit etre « ✔ ».
 *   5. Sur https://script.google.com > « Mes declencheurs » : il ne doit rester
 *      que 2 declencheurs, tous deux dans CE projet (surSoumission, filetDeSecurite).
 *      Supprimer tout declencheur « surSoumission » d'un AUTRE projet (ancien script V2/V3).
 *   Aucune reponse n'est perdue : tout est relu depuis le formulaire. Les liens des
 *   enqueteurs, les statuts REJETE et les N° de fiche sont conserves.
 *
 *  DEFAUTS DE LA V4 CORRIGES
 *   a. Une soumission qui echouait (classeur occupe, plusieurs envois simultanes,
 *      erreur passagere de Google) n'etait JAMAIS rattrapee : fiche absente du masque.
 *      -> V5 : chaque passage compare le masque au formulaire et ajoute ce qui manque ;
 *         un declencheur de secours verifie tout toutes les 10 minutes.
 *   b. Si un ancien script (V2/V3) avait encore son declencheur sur ce formulaire,
 *      chaque fiche etait ecrite deux fois. -> V5 : chaque ligne porte l'identifiant
 *      de sa reponse ; doublons et lignes etrangeres sont retires automatiquement.
 *   c. Une reponse supprimee du formulaire (essais) restait dans le masque.
 *      -> V5 : retiree automatiquement.
 *   d. La date etait ecrite dans le fuseau du projet de script : s'il n'etait pas
 *      regle sur Africa/Douala, les colonnes J1/J2/J3 et AUJOURD'HUI restaient a 0
 *      (ou la fiche basculait sur la veille). -> V5 : date toujours a minuit, heure de Douala.
 *   e. Les erreurs etaient silencieuses. -> V5 : onglets JOURNAL_SYNC et SANTE_SYNC.
 *   Rien ne change pour SPSS : memes 67 variables, memes codes. La colonne technique
 *   IDREPONSE (68e colonne du masque) n'est pas exportee.
 *
 *  PREMIERE INSTALLATION (si le script n'a jamais ete installe sur ce formulaire)
 *   Formulaire en mode edition > ⋮ > Editeur de scripts > coller > executer « installer »,
 *   lire DIAGNOSTIC_FORMULAIRE, saisir noms et zones dans ENQUETEURS, executer « actualiser ».
 *
 *  FONCTIONS
 *   - reparer()             -> en cas de doute : remet tout d'aplomb + bilan SANTE_SYNC
 *   - sante()               -> bilan seul (ne modifie rien)
 *   - actualiser()          -> apres modification de l'onglet ENQUETEURS (zones, noms)
 *   - reconstruireMasque()  -> recode toutes les reponses
 *   - diagnostiquer()       -> compare le formulaire au dictionnaire
 *   - exporterPourSPSS()    -> onglet EXPORT_SPSS, a telecharger en EXPORT_SPSS.csv
 *
 *  CONTROLE QUALITE : colonne STATUTQC = OK / A_VERIFIER (automatique) ; le superviseur
 *  peut ecrire REJETE (fiche exclue du suivi, du tri a plat et de l'export).
 *  NE PAS trier, filtrer par suppression ni inserer de lignes dans MASQUE_DEPOUILLEMENT.
 */

// =====================================================================
// 1. PARAMETRES
// =====================================================================
const CONFIG = {
  NOM_CLASSEUR: "EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL_V4",
  FUSEAU: "Africa/Douala",
  OBJECTIF_JOUR: 25,
  NB_JOURS: 3,
  SEUIL_DELAI_MIN: 6,
  SEUIL_VOLUME_JOUR: 30,
  CODE_NA: 97, CODE_NSP: 98, CODE_NR: 99,
  PREMIERE_LIGNE_DONNEES: 4,
  // Facultatif : URL d'EDITION du formulaire (…/forms/d/<ID>/edit) si le script n'est PAS
  // ouvert depuis le formulaire. Le lien public (…/forms/d/e/…/viewform) ne convient pas.
  FORM_URL_EDITION: ""
};

const ZONES = [
  { code: 1, id: "DOUALA",    libelle: "Douala",    prefixe: "DLA" },
  { code: 2, id: "YAOUNDE",   libelle: "Yaoundé",   prefixe: "YDE" },
  { code: 3, id: "BAFOUSSAM", libelle: "Bafoussam", prefixe: "BAF" }
];

// Zones par defaut (plan de terrain initial). ENQ9 a ENQ11 : zone a saisir dans l'onglet ENQUETEURS.
const ZONES_PAR_DEFAUT = { ENQ1: "DOUALA", ENQ2: "DOUALA", ENQ3: "DOUALA", ENQ4: "YAOUNDE", ENQ5: "YAOUNDE",
                           ENQ6: "YAOUNDE", ENQ7: "BAFOUSSAM", ENQ8: "BAFOUSSAM" };

// Quotas du cahier des charges 02 (code Q1 -> [cible, Douala, Yaounde, Bafoussam])
const QUOTAS = {
  1: ["Particulier", 35, 35, 15],
  2: ["Entreprises (PME, Industries…)", 35, 35, 15],
  3: ["Électricien/artisan", 40, 40, 20],
  4: ["Entreprise BTP", 40, 40, 20],
  5: ["Revendeur/Grossiste/Distributeur", 50, 50, 30]
};

// =====================================================================
// 2. DICTIONNAIRE (identique a la V3 : memes codes, memes modalites)
//    n = numero de la question dans le formulaire (« Qn. »)
// =====================================================================
const ITEMS = [
  { n: 1, code: "VOUSETES", section: "1. Profil du répondant", q: "Q1. Vous êtes", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Particulier"], [2, "Entreprises (PME, Industries…)"], [3, "Électricien/artisan"], [4, "Entreprise BTP"], [5, "Revendeur/Grossiste/Distributeur"]],
    alias: { "Revendeur/grossiste": 5 } },
  { n: 2, code: "SEXMAFEM", section: "1. Profil du répondant", q: "Q2. Genre", type: "radio", mesure: "NOMINAL", choix: [[1, "Homme"], [2, "Femme"]] },
  { n: 3, code: "AGEREPON", section: "1. Profil du répondant", q: "Q3. Âge", type: "radio", mesure: "ORDINAL",
    choix: [[1, "<25"], [2, "25–34"], [3, "35–44"], [4, "45–54"], [5, "55+"]] },
  { n: 4, code: "VILLEREG", section: "1. Profil du répondant", q: "Q4. Ville / région", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Douala"], [2, "Yaoundé"], [3, "Bafoussam"]] },
  { n: 5, code: "REVMENME", section: "1. Profil du répondant", q: "Q5. Revenu mensuel du ménage (FCFA)", type: "radio", mesure: "ORDINAL",
    choix: [[1, "<100k"], [2, "100k–250k"], [3, "250k–500k"], [4, "500k–1M"], [5, ">1M"], [98, "NSP"]] },
  { n: 6, code: "FREQACHA", section: "2. Habitudes d'achat", q: "Q6. Fréquence d'achat", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Chaque semaine"], [2, "1–3×/mois"], [3, "Quelques fois/an"], [4, "Rarement"]] },
  { n: 7, code: "LIEACHPR", section: "2. Habitudes d'achat", q: "Q7. Lieu d'achat principal", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Quincaillerie"], [2, "Grossiste spécialisé"], [3, "Magasin spécialisé"], [4, "Marché"], [5, "Importateur"], [6, "En ligne"]] },
  { n: 8, code: "MONMOYAC", section: "2. Habitudes d'achat", q: "Q8. Montant moyen par achat (FCFA)", type: "radio", mesure: "ORDINAL",
    choix: [[1, "<25k"], [2, "25k–100k"], [3, "100k–500k"], [4, "500k–2M"], [5, ">2M"]] },
  { n: 9, code: "PRODACHE", section: "2. Habitudes d'achat", q: "Q9. Produits achetés (plusieurs réponses)", type: "multi",
    sousItems: [["PRACCABL", "Câbles/fils"], ["PRACAPPA", "Appareillage/disjoncteurs"], ["PRACPRIS", "Prises/interrupteurs"],
                ["PRACLUMI", "Luminaires"], ["PRACSOLA", "Solaire/onduleurs"], ["PRACGROU", "Groupes électrogènes"]] },
  { n: 10, code: "PAIEPRIV", section: "2. Habitudes d'achat", q: "Q10. Paiement privilégié", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Espèces"], [2, "Mobile Money"], [3, "Virement"], [4, "Crédit fournisseur"]] },
  { n: 11, code: "IMPOMARQ", section: "3. Marques", q: "Q11. Importance de la marque", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Très importante"], [2, "Importante"], [3, "Peu importante"], [4, "Pas importante"]] },
  { n: 12, code: "MAACPLSO", section: "3. Marques", q: "Q12. Marque achetée le plus souvent", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Schneider"], [2, "Legrand"], [3, "Vectron"], [4, "Hager"], [5, "ABB"], [6, "Siemens"], [7, "Chint/chinoise"],
            [8, "Philips"], [9, "JA Solar"], [10, "Longi"], [11, "Growatt"]],
    autre: { code: 12, libelle: "Autre", variable: "MAACAUTR" } },
  { n: 13, code: "PRCRICHO", section: "3. Marques", q: "Q13. Principal critère de choix", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Prix"], [2, "Qualité/durabilité"], [3, "Disponibilité"], [4, "Notoriété"], [5, "Garantie/SAV"], [6, "Conformité normes"]] },
  { n: 14, code: "ORIGPRIV", section: "4. Origine des produits", q: "Q14. Origine privilégiée", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [4, "Aucune préférence"]] },
  { n: 15, code: "MEQUAFIA", section: "4. Origine des produits", q: "Q15. Meilleure qualité/fiabilité selon vous", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [98, "Sans avis"]] },
  { n: 16, code: "MEILPRIX", section: "4. Origine des produits", q: "Q16. Meilleur prix selon vous", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [98, "Sans avis"]] },
  { n: 17, code: "ORINFACH", section: "4. Origine des produits", q: "Q17. L'origine influence votre achat", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Fortement"], [2, "Modérément"], [3, "Faiblement"], [4, "Pas du tout"]] },
  { n: 18, code: "GAACPLSO", section: "5. Gammes", q: "Q18. Gamme achetée le plus souvent", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Haut de gamme"], [2, "Moyenne gamme"], [3, "Bas de gamme"], [4, "Selon le projet"]] },
  { n: 19, code: "DEAVHAGA", section: "5. Gammes", q: "Q19. Pour vous, ce qui définit AVANT TOUT un produit HAUT DE GAMME", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Un prix élevé"], [2, "Une marque reconnue"], [3, "La durabilité / fiabilité"], [4, "L'origine (Europe, Asie, etc.)"],
            [5, "Les certifications / conformité aux normes"], [6, "Une garantie longue"]] },
  { n: 20, code: "CAAVBAGA", section: "5. Gammes", q: "Q20. Pour vous, ce qui caractérise AVANT TOUT un produit BAS DE GAMME", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Un prix bas"], [2, "Une origine asiatique générique"], [3, "L'absence de marque connue"], [4, "Une durée de vie courte"],
            [5, "L'absence de garantie"], [6, "Un risque de non-conformité"]] },
  { n: 21, code: "ORASHAGA", section: "5. Gammes", q: "Q21. À quelle origine associez-vous spontanément le HAUT DE GAMME ?", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [98, "Sans avis"]] },
  { n: 22, code: "ORASBAGA", section: "5. Gammes", q: "Q22. À quelle origine associez-vous spontanément le BAS DE GAMME ?", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [98, "Sans avis"]] },
  { n: 23, code: "FOPRGAMM", section: "5. Gammes", q: "Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme ?",
    type: "grille", mesure: "ORDINAL",
    lignes: [["PXHAUTGA", "Haut de gamme"], ["PXMOYEGA", "Moyenne gamme"], ["PXBASGAM", "Bas de gamme"]],
    choix: [[1, "< 5 000 FCFA"], [2, "5 000 – 15 000"], [3, "15 000 – 40 000"], [4, "> 40 000 FCFA"]] },
  { n: 24, code: "ECQUHABA", section: "5. Gammes", q: "Q24. Selon vous, l'écart de qualité entre le haut et le bas de gamme est", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Très important"], [2, "Important"], [3, "Modéré"], [4, "Faible"], [5, "Inexistant"]] },
  { n: 25, code: "PRIOPRIN", section: "5. Gammes", q: "Q25. Priorité principale", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Le moins cher"], [2, "Meilleur rapport qualité/prix"], [3, "Meilleure qualité quel que soit le prix"]] },
  { n: 26, code: "SUACMOGA", section: "5. Gammes", q: "Q26. Surcoût accepté pour monter en gamme", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Aucun"], [2, "Jusqu'à +10 %"], [3, "+10–25 %"], [4, "+25–50 %"], [5, ">+50 %"]] },
  { n: 27, code: "PRINFREI", section: "6. Freins à l'achat", q: "Q27. Principal frein", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Prix élevé"], [2, "Doute qualité/contrefaçon"], [3, "Indisponibilité"], [4, "Manque de conseil"], [5, "Absence de garantie"], [6, "Délais de livraison"]] },
  { n: 28, code: "CRACPRCO", section: "6. Freins à l'achat", q: "Q28. Crainte d'acheter un produit contrefait/non conforme", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Souvent"], [2, "Parfois"], [3, "Rarement"], [4, "Jamais"]] },
  { n: 29, code: "DEJDECAC", section: "6. Freins à l'achat", q: "Q29. Déjà déçu par un achat", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Oui, plusieurs fois"], [2, "Oui, une fois"], [3, "Non"]] },
  { n: 30, code: "IMSECSAV", section: "7. Service client & SAV", q: "Q30. Importance du service client et du SAV", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Très importante"], [2, "Importante"], [3, "Peu importante"], [4, "Pas importante"]] },
  { n: 31, code: "SEATPRIO", section: "7. Service client & SAV", q: "Q31. Service attendu en priorité", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Garantie/remplacement"], [2, "Conseil technique"], [3, "Réparation/pièces"], [4, "Réactivité du contact"], [5, "Livraison/installation"]] },
  { n: 32, code: "DUGAJUAC", section: "7. Service client & SAV", q: "Q32. Durée de garantie jugée acceptable", type: "radio", mesure: "ORDINAL",
    choix: [[1, "<6 mois"], [2, "6 mois–1 an"], [3, "1–2 ans"], [4, ">2 ans"]] },
  { n: 33, code: "CACOPREF", section: "7. Service client & SAV", q: "Q33. Canal de contact préféré", type: "radio", mesure: "NOMINAL",
    choix: [[1, "En personne"], [2, "Téléphone"], [3, "WhatsApp"], [4, "E-mail"], [5, "Réseaux sociaux"]] },
  { n: 34, code: "BOSAPACH", section: "7. Service client & SAV", q: "Q34. Un bon SAV/service vous ferait payer plus cher", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Oui"], [2, "Peut-être"], [3, "Non"]] },
  { n: 35, code: "CANAPREF", section: "8. Canaux & achat en ligne", q: "Q35. Canal préféré", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Quincaillerie"], [2, "Grossiste spécialisé"], [3, "Magasin spécialisé"], [4, "Marché"], [5, "Importateur"], [6, "En ligne"]] },
  { n: 36, code: "CRCHCANA", section: "8. Canaux & achat en ligne", q: "Q36. Critère de choix du canal", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Proximité"], [2, "Prix"], [3, "Largeur du choix"], [4, "Disponibilité"], [5, "Conseil"], [6, "Confiance"]] },
  { n: 37, code: "DEJACHLI", section: "8. Canaux & achat en ligne", q: "Q37. Déjà acheté en ligne", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Oui"], [2, "Non"]] },
  { n: 38, code: "PRETACLI", section: "8. Canaux & achat en ligne", q: "Q38. Prêt à acheter en ligne", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Oui"], [2, "Peut-être"], [3, "Non"]] },
  { n: 39, code: "PRFRACLI", section: "8. Canaux & achat en ligne", q: "Q39. Principal frein à l'achat en ligne", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Qualité/conformité"], [2, "Ne pas voir le produit"], [3, "Confiance paiement"], [4, "Livraison"], [5, "Absence de SAV"]] },
  { n: 40, code: "FIMEFOUR", section: "9. Fidélisation", q: "Q40. Fidèle à un même fournisseur", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Toujours"], [2, "Souvent"], [3, "Parfois"], [4, "Rarement"], [5, "Jamais"]] },
  { n: 41, code: "RENFFIDE", section: "9. Fidélisation", q: "Q41. Ce qui renforcerait votre fidélité (plusieurs réponses)", type: "multi",
    sousItems: [["RFIDPRIX", "Prix/promotions"], ["RFIDQUAL", "Qualité constante"], ["RFIDSTOC", "Disponibilité du stock"],
                ["RFIDCONS", "Bon conseil"], ["RFIDSAVF", "SAV fiable"], ["RFIDPROG", "Programme de fidélité"], ["RFIDPAIE", "Facilités de paiement"]] },
  { n: 42, code: "SUGGATTE", section: "9. Fidélisation", q: "Q42. Une suggestion / attente (facultatif)", type: "text" }
];

// Questions d'identification (reperees par mots-cles du titre, sans accents)
const IDENT = [
  { champ: "enq",      cles: ["identifiantenqueteur"],          titre: "Identifiant enquêteur" },
  { champ: "accord",   cles: ["recontacte"],                    titre: "L'enquêté accepte d'être recontacté à des fins commerciales" },
  { champ: "site",     cles: ["siteprecis"],                    titre: "Site précis / repère" },
  { champ: "quartier", cles: ["quartier"],                      titre: "Quartier / zone" },
  { champ: "tel",      cles: ["telephone"],                     titre: "Téléphone de l'enquêté" },
  { champ: "mail",     cles: ["email", "mail"],                 titre: "E-mail de l'enquêté" },
  { champ: "nom",      cles: ["nomdelenquete", "raisonsociale"], titre: "Nom de l'enquêté ou raison sociale" }
];

const VARS_ADMIN = [
  { code: "NUMFICHE", label: "N° de fiche", spss: "A20" },
  { code: "CODEENQU", label: "Identifiant enquêteur", spss: "A6" },
  { code: "CODEZONE", label: "Zone d'étude", spss: "F2.0", mesure: "NOMINAL",
    valeurs: ZONES.map(function (z) { return [z.code, z.libelle]; }).concat([[99, "Enquêteur inconnu"]]) },
  { code: "QUARTIER", label: "Quartier / zone", spss: "A60" },
  { code: "SITEENQU", label: "Site précis / repère", spss: "A80" },
  { code: "DATEENQU", label: "Date de l'enquête", spss: "SDATE10" },
  { code: "HEUREENQ", label: "Heure de soumission", spss: "A5" },
  { code: "DELAIPRE", label: "Minutes depuis la fiche précédente du même enquêteur", spss: "F4.0", mesure: "SCALE" },
  { code: "ACCRECON", label: "Accepte d'être recontacté à des fins commerciales", spss: "F2.0", mesure: "NOMINAL",
    valeurs: [[1, "Oui"], [2, "Non"], [99, "Non-réponse"]] }
];
const VARS_CONTROLE = [
  { code: "ANOMALIE", label: "Anomalies détectées automatiquement", spss: "A200" },
  { code: "STATUTQC", label: "Statut contrôle qualité", spss: "A10" }
];
const ENTETE_CONTACTS = ["N° FICHE", "DATE", "HEURE", "ENQUÊTEUR", "VILLE", "QUARTIER / ZONE", "SITE PRÉCIS",
  "NOM / RAISON SOCIALE", "PROFIL (Q1)", "TÉLÉPHONE", "E-MAIL", "ACCORD RECONTACT",
  "PRODUITS ACHETÉS (Q9)", "MARQUE PRINCIPALE (Q12)", "MONTANT MOYEN (Q8)", "CANAL DE CONTACT PRÉFÉRÉ (Q33)", "STATUT QC"];

// =====================================================================
// 3. FONCTIONS PURES (aucun service Google) : lecture, codification
// =====================================================================
function norm_(s) {
  return String(s === null || s === undefined ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim();
}
/** Cle de comparaison : sans accents, minuscules, uniquement lettres, chiffres et < > + % */
function cle_(s) {
  return norm_(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/×/g, "x").replace(/[^a-z0-9<>+%]/g, "");
}
function vide_(r) {
  if (r === null || r === undefined) return true;
  if (Array.isArray(r)) return r.every(function (x) { return vide_(x); });
  return norm_(r) === "";
}
/** Numero de question d'un titre « Q12. … » (null sinon) */
function numeroQuestion_(titre) {
  const m = norm_(titre).match(/^Q\s*(\d{1,2})\s*[.:)\-–]/i);
  return m ? Number(m[1]) : null;
}
function champIdent_(titre) {
  const k = cle_(titre);
  for (let i = 0; i < IDENT.length; i++) {
    if (IDENT[i].cles.some(function (c) { return k.indexOf(c) >= 0; })) return IDENT[i].champ;
  }
  return null;
}
function itemParCode_(code) { return ITEMS.filter(function (x) { return x.code === code; })[0]; }

/**
 * Transforme une liste de reponses [{titre, rep, lignes}] en {id:{…}, q:{n:{rep, lignes}}}.
 * (lignes = libelles des lignes d'une grille, dans l'ordre du formulaire)
 */
function structurer_(liste) {
  const out = { id: {}, q: {} };
  liste.forEach(function (x) {
    const n = numeroQuestion_(x.titre);
    if (n) { if (!(n in out.q)) out.q[n] = { rep: x.rep, lignes: x.lignes || null }; return; }
    const c = champIdent_(x.titre);
    if (c && !(c in out.id)) out.id[c] = x.rep;
  });
  return out;
}

function chercherCode_(choix, rep) {
  const k = cle_(rep);
  const t = choix.filter(function (c) { return cle_(c[1]) === k; })[0];
  return t ? t[0] : null;
}

/** Codifie une fiche structuree. @return {{valeurs:Object, anomalies:string[]}} */
function coderFiche_(lu) {
  const NR = CONFIG.CODE_NR, valeurs = {}, anomalies = [];
  ITEMS.forEach(function (it) {
    const src = lu.q[it.n];
    const brut = src ? src.rep : null;
    const absent = vide_(brut);
    if (it.type === "radio") {
      if (it.autre) valeurs[it.autre.variable] = "";
      if (absent) { valeurs[it.code] = NR; return; }
      const r = norm_(Array.isArray(brut) ? brut[0] : brut);
      let code = chercherCode_(it.choix, r);
      if (code === null && it.alias) {
        const a = Object.keys(it.alias).filter(function (x) { return cle_(x) === cle_(r); })[0];
        if (a) code = it.alias[a];
      }
      if (code !== null) { valeurs[it.code] = code; return; }
      if (it.autre) { valeurs[it.code] = it.autre.code; valeurs[it.autre.variable] = r; return; }
      valeurs[it.code] = NR; anomalies.push("CODE_INCONNU:" + it.code);
    } else if (it.type === "multi") {
      if (absent) { it.sousItems.forEach(function (s) { valeurs[s[0]] = NR; }); return; }
      const coches = (Array.isArray(brut) ? brut : [brut]).map(cle_);
      it.sousItems.forEach(function (s) { valeurs[s[0]] = coches.indexOf(cle_(s[1])) >= 0 ? 1 : 0; });
      const connus = it.sousItems.map(function (s) { return cle_(s[1]); });
      if (coches.some(function (c) { return c && connus.indexOf(c) < 0; })) anomalies.push("CODE_INCONNU:" + it.code);
    } else if (it.type === "grille") {
      const rep = absent ? [] : (Array.isArray(brut) ? brut : [brut]);
      const lignesForm = src && src.lignes ? src.lignes.map(cle_) : null;
      it.lignes.forEach(function (li, k) {
        const idx = lignesForm ? lignesForm.indexOf(cle_(li[1])) : k;
        const r = idx >= 0 ? rep[idx] : null;
        if (vide_(r)) { valeurs[li[0]] = NR; return; }
        const code = chercherCode_(it.choix, r);
        if (code !== null) valeurs[li[0]] = code;
        else { valeurs[li[0]] = NR; anomalies.push("CODE_INCONNU:" + li[0]); }
      });
    } else {
      valeurs[it.code] = absent ? "" : norm_(brut);
    }
  });
  // Coherences (memes regles qu'en V3 ; ignorees si une des deux reponses manque)
  const ok = function (x) { return typeof x === "number" && x < 97; };
  if (valeurs.CANAPREF === 6 && valeurs.PRETACLI === 3) anomalies.push("INCOHERENCE_Q35_Q38");
  if (valeurs.LIEACHPR === 6 && valeurs.DEJACHLI === 2) anomalies.push("INCOHERENCE_Q7_Q37");
  if (ok(valeurs.PXHAUTGA) && ok(valeurs.PXBASGAM) && valeurs.PXHAUTGA < valeurs.PXBASGAM) anomalies.push("INCOHERENCE_Q23");
  if (valeurs.PRIOPRIN === 3 && valeurs.SUACMOGA === 1) anomalies.push("INCOHERENCE_Q25_Q26");
  return { valeurs: valeurs, anomalies: anomalies };
}

/** Colonnes du masque (ordre = SPSS) : [{section, code, label, spss, mesure, valeurs, groupe}] */
function colonnesMasque_() {
  const NR = CONFIG.CODE_NR, cols = [];
  VARS_ADMIN.forEach(function (v) { cols.push(Object.assign({ section: "Administratif" }, v)); });
  ITEMS.forEach(function (it) {
    if (it.type === "radio") {
      const v = it.choix.slice();
      if (it.autre) v.push([it.autre.code, it.autre.libelle]);
      v.push([NR, "Non-réponse"]);
      cols.push({ section: it.section, code: it.code, label: it.q, spss: "F2.0", mesure: it.mesure, valeurs: v });
      if (it.autre) cols.push({ section: it.section, code: it.autre.variable, label: it.q + " - Autre (précisez)", spss: "A80" });
    } else if (it.type === "multi") {
      it.sousItems.forEach(function (s) {
        cols.push({ section: it.section, code: s[0], label: it.q.replace(/\s*\(plusieurs réponses\)/, "") + " - " + s[1], spss: "F2.0",
          mesure: "NOMINAL", valeurs: [[1, "Cité"], [0, "Non cité"], [NR, "Non-réponse"]], groupe: it.code });
      });
    } else if (it.type === "grille") {
      it.lignes.forEach(function (li) {
        cols.push({ section: it.section, code: li[0], label: it.q.replace(/\s*\?$/, "") + " - " + li[1], spss: "F2.0",
          mesure: it.mesure, valeurs: it.choix.concat([[NR, "Non-réponse"]]) });
      });
    } else cols.push({ section: it.section, code: it.code, label: it.q, spss: "A500" });
  });
  VARS_CONTROLE.forEach(function (v) { cols.push(Object.assign({ section: "Contrôle qualité" }, v)); });
  return cols;
}

/**
 * Construit la ligne du masque + la ligne contact.
 * fiche = {lu, horodatage:Date, enqueteurs:{ENQ1:"DOUALA" ou ""}, seuilDelai, telsVus:{}}
 * etat  = {seq:{}, dernier:{}} (modifie) ; fmt(date, format) -> texte (fuseau Douala)
 */
function construireLigne_(fiche, etat, fmt) {
  const code = coderFiche_(fiche.lu), v = code.valeurs, anomalies = code.anomalies.slice();
  const id = fiche.lu.id, txt = function (x) { return Array.isArray(x) ? x.filter(function (y) { return y; }).join(", ") : norm_(x); };
  const enq = txt(id.enq).toUpperCase();

  let zone = null;
  if (!(enq in fiche.enqueteurs)) anomalies.push("ENQUETEUR_INCONNU");
  else {
    zone = ZONES.filter(function (z) { return z.id === fiche.enqueteurs[enq]; })[0] || null;
    if (!zone) {                                                   // enqueteur connu mais zone non saisie
      zone = ZONES.filter(function (z) { return z.code === v.VILLEREG; })[0] || null;
      anomalies.push("ZONE_ENQ_NON_PARAMETREE");
    }
  }
  const seq = fiche.seqForce > 0 ? fiche.seqForce : (etat.seq[enq] || 0) + 1;      // seqForce : N° deja attribue, conserve
  etat.seq[enq] = Math.max(etat.seq[enq] || 0, seq);
  v.NUMFICHE = (zone ? zone.prefixe : "XXX") + "-" + (enq || "SANSID") + "-" + String(seq).padStart(3, "0");
  v.CODEENQU = enq;
  v.CODEZONE = zone ? zone.code : CONFIG.CODE_NR;
  v.QUARTIER = txt(id.quartier);
  v.SITEENQU = txt(id.site);
  const accord = txt(id.accord);
  v.ACCRECON = cle_(accord) === "oui" ? 1 : (cle_(accord) === "non" ? 2 : CONFIG.CODE_NR);

  const tel = txt(id.tel), telCle = tel.replace(/\D/g, "").replace(/^237/, "");
  if (telCle && fiche.telsVus) {
    if (fiche.telsVus[telCle]) anomalies.push("TEL_DOUBLON");
    fiche.telsVus[telCle] = true;
  }
  const jour = fmt(fiche.horodatage, "yyyy-MM-dd");
  v.DATEENQU = jour;
  v.HEUREENQ = fmt(fiche.horodatage, "HH:mm");
  v.DELAIPRE = "";
  const prec = etat.dernier[enq];
  if (prec && fmt(new Date(prec), "yyyy-MM-dd") === jour) {
    v.DELAIPRE = Math.round((fiche.horodatage.getTime() - prec) / 60000);
    if (v.DELAIPRE < 0) v.DELAIPRE = "";                       // fiche rattrapee hors ordre chronologique
    else if (v.DELAIPRE < fiche.seuilDelai) anomalies.push("DELAI_COURT");
  }
  etat.dernier[enq] = Math.max(prec || 0, fiche.horodatage.getTime());
  if (zone && v.VILLEREG !== CONFIG.CODE_NR && v.VILLEREG !== zone.code) anomalies.push("VILLE_DIFFERENTE_ZONE");

  v.ANOMALIE = anomalies.join(" | ");
  v.STATUTQC = anomalies.length ? "A_VERIFIER" : "OK";

  const q = fiche.lu.q, r = function (n) { return q[n] ? txt(q[n].rep) : ""; };
  fiche.contact = [v.NUMFICHE, jour, v.HEUREENQ, enq, zone ? zone.libelle : "", v.QUARTIER, v.SITEENQU,
    txt(id.nom), r(1), tel, txt(id.mail), accord || "NR", r(9), r(12), r(8), r(33), v.STATUTQC];

  return colonnesMasque_().map(function (c) { return (c.code in v) ? v[c.code] : ""; });
}

function lettreColonne_(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// =====================================================================
// 4. ACCES AU FORMULAIRE ET AU CLASSEUR
// =====================================================================
function formulaire_() {
  let f = null;
  try { f = FormApp.getActiveForm(); } catch (e) { f = null; }
  if (!f && CONFIG.FORM_URL_EDITION) f = FormApp.openByUrl(CONFIG.FORM_URL_EDITION);
  if (!f) {
    const id = PropertiesService.getScriptProperties().getProperty("FORM_ID");
    if (id) f = FormApp.openById(id);
  }
  if (!f) throw new Error("Formulaire introuvable : ouvrez ce script depuis le formulaire (⋮ > Éditeur de scripts) " +
    "ou renseignez CONFIG.FORM_URL_EDITION (lien …/edit, pas le lien public).");
  return f;
}

function classeur_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  const form = formulaire_();
  let ss = null;
  try { if (form.getDestinationId()) ss = SpreadsheetApp.openById(form.getDestinationId()); } catch (e) { ss = null; }
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.NOM_CLASSEUR);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  }
  ss.setSpreadsheetTimeZone(CONFIG.FUSEAU);
  props.setProperties({ SHEET_ID: ss.getId(), FORM_ID: form.getId() });
  return ss;
}

const LIGNES_GRILLE_ = {};                 // libelles des lignes de grille, lus une seule fois par execution
function reponseEnListe_(formResponse) {
  return formResponse.getItemResponses().map(function (r) {
    const it = r.getItem(), titre = it.getTitle(), rep = r.getResponse();
    let lignes = null;
    if (Array.isArray(rep) && numeroQuestion_(titre) === 23) {
      if (!(titre in LIGNES_GRILLE_)) LIGNES_GRILLE_[titre] = it.getType() === FormApp.ItemType.GRID ? it.asGridItem().getRows() : null;
      lignes = LIGNES_GRILLE_[titre];
    }
    return { titre: titre, rep: rep, lignes: lignes };
  });
}

function lireEnqueteurs_(ss) {
  const sh = ss.getSheetByName("ENQUETEURS"), map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (l) {
    if (norm_(l[0])) map[norm_(l[0]).toUpperCase()] = norm_(l[2]).toUpperCase();
  });
  return map;
}

function fmtDouala_(d, f) { return Utilities.formatDate(d, CONFIG.FUSEAU, f); }

function styleEntete_(range) {
  range.setFontWeight("bold").setBackground("#1F4E78").setFontColor("#FFFFFF").setVerticalAlignment("middle");
}

function refMasque_(code) {
  const i = colonnesMasque_().map(function (c) { return c.code; }).indexOf(code) + 1;
  const L = lettreColonne_(i);
  return "MASQUE_DEPOUILLEMENT!$" + L + "$" + CONFIG.PREMIERE_LIGNE_DONNEES + ":$" + L;
}

function supprimerOnglet_(ss, s) {
  if (!s) return;
  const autre = ss.getSheets().filter(function (x) { return x.getSheetId() !== s.getSheetId(); })[0];
  if (!autre) return;
  try { ss.setActiveSheet(autre); } catch (e) { /* rien */ }
  ss.deleteSheet(s);
  SpreadsheetApp.flush();
}

function ongletNeuf_(ss, nom) {
  supprimerOnglet_(ss, ss.getSheetByName(nom));
  return ss.insertSheet(nom, ss.getSheets().length);
}

// =====================================================================
// 5. INSTALLATION
// =====================================================================
function installer() {
  if (Session.getScriptTimeZone() !== CONFIG.FUSEAU) {
    Logger.log("ATTENTION : fuseau du projet = " + Session.getScriptTimeZone() + ". Réglez-le sur " + CONFIG.FUSEAU + " (Paramètres du projet).");
  }
  const form = formulaire_();
  const ss = classeur_();

  creerParametres_(ss);
  creerEnqueteurs_(ss, form);
  creerMasque_(ss);
  feuilleContacts_(ss);
  creerDictionnaire_(ss);
  const diag = diagnostiquer();

  installerDeclencheurs_(form);         // a la soumission + filet de securite (10 min)
  synchroniser_("INSTALLER", null, true, true);   // reprend les reponses deja recues
  creerTableauDeBord_(ss);
  creerTriAPlat_(ss);
  creerSuiviCibles_(ss);
  ss.getSheets().forEach(function (s) {
    if (/^(Feuille|Sheet)\s?1$/.test(s.getName()) && s.getLastRow() === 0) supprimerOnglet_(ss, s);
  });
  ss.setActiveSheet(ss.getSheetByName("TABLEAU_DE_BORD")); ss.moveActiveSheet(1);

  Logger.log("Formulaire (édition) : " + form.getEditUrl());
  Logger.log("Formulaire (public)  : " + form.getPublishedUrl());
  Logger.log("Classeur             : " + ss.getUrl());
  Logger.log("Diagnostic           : " + diag);
  Logger.log("Synchronisation      : " + sante());
  Logger.log("ÉTAPE SUIVANTE : onglet ENQUETEURS (noms + zones de ENQ9 à ENQ11), puis exécuter actualiser().");
}

/** A relancer apres toute modification de l'onglet ENQUETEURS (zones, noms, ajout). */
function actualiser() {
  const ss = classeur_(), form = formulaire_();
  creerEnqueteurs_(ss, form);           // conserve noms et zones, regenere les liens
  synchroniser_("ACTUALISER", null, true, true);   // la zone de l'enqueteur fixe CODEZONE et le prefixe du N° de fiche
  creerTableauDeBord_(ss);
  creerTriAPlat_(ss);
  creerSuiviCibles_(ss);
  Logger.log("Actualisé : " + ss.getUrl());
}

function creerParametres_(ss) {
  let sh = ss.getSheetByName("PARAMETRES");
  if (sh && sh.getRange("A1").getValue() === "PARAMETRE") return sh;      // ne jamais ecraser les dates saisies
  sh = ongletNeuf_(ss, "PARAMETRES");
  const lignes = [
    ["PARAMETRE", "VALEUR", "DESCRIPTION"],
    ["DATE_J1", "", "Date du 1er jour de terrain (ex. 05/10/2026)"],
    ["DATE_J2", "", "Date du 2e jour de terrain"],
    ["DATE_J3", "", "Date du 3e jour de terrain"],
    ["OBJECTIF_JOUR", CONFIG.OBJECTIF_JOUR, "Fiches attendues par enquêteur et par jour"],
    ["NB_JOURS", CONFIG.NB_JOURS, "Nombre de jours de terrain"],
    ["SEUIL_DELAI_MIN", CONFIG.SEUIL_DELAI_MIN, "Alerte si moins de X minutes entre 2 fiches d'un même enquêteur"],
    ["SEUIL_VOLUME_JOUR", CONFIG.SEUIL_VOLUME_JOUR, "Alerte « volume suspect » au-delà de X fiches/jour pour un enquêteur"]
  ];
  sh.getRange(1, 1, lignes.length, 3).setValues(lignes);
  styleEntete_(sh.getRange(1, 1, 1, 3));
  sh.getRange("B2:B4").setNumberFormat("dd/MM/yyyy").setBackground("#FFF2CC");
  sh.getRange("B5:B8").setBackground("#FFF2CC");
  const noms = { P_J1: "B2", P_J2: "B3", P_J3: "B4", P_OBJ_JOUR: "B5", P_NB_JOURS: "B6", P_SEUIL_DELAI: "B7", P_SEUIL_VOLUME: "B8" };
  Object.keys(noms).forEach(function (n) { ss.setNamedRange(n, sh.getRange(noms[n])); });
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 480);
  sh.setFrozenRows(1);
  return sh;
}

/** Liste des enqueteurs = choix de la liste deroulante du formulaire (+ ceux deja dans l'onglet). */
function creerEnqueteurs_(ss, form) {
  const items = form.getItems();
  const itemEnq = items.filter(function (x) { return !numeroQuestion_(x.getTitle()) && champIdent_(x.getTitle()) === "enq"; })[0];
  if (!itemEnq) throw new Error("Question « Identifiant enquêteur » introuvable dans le formulaire.");
  const T = FormApp.ItemType;
  let ids = [];
  if (itemEnq.getType() === T.LIST) ids = itemEnq.asListItem().getChoices().map(function (c) { return c.getValue(); });
  else if (itemEnq.getType() === T.MULTIPLE_CHOICE) ids = itemEnq.asMultipleChoiceItem().getChoices().map(function (c) { return c.getValue(); });
  ids = ids.map(function (x) { return norm_(x).toUpperCase(); }).filter(function (x) { return x; });

  // Conserver noms et zones deja saisis
  const avant = {};
  const old = ss.getSheetByName("ENQUETEURS");
  if (old && old.getLastRow() > 1) old.getRange(2, 1, old.getLastRow() - 1, 3).getValues().forEach(function (l) {
    if (norm_(l[0])) avant[norm_(l[0]).toUpperCase()] = { nom: l[1], zone: norm_(l[2]).toUpperCase() };
  });
  Object.keys(avant).forEach(function (k) { if (ids.indexOf(k) < 0) ids.push(k); });

  const itemVille = items.filter(function (x) { return numeroQuestion_(x.getTitle()) === 4; })[0];
  const lignes = [["ENQ_ID", "NOM_ENQUETEUR", "ZONE", "OBJECTIF_TOTAL", "LIEN_PERSONNEL", "DANS LE FORMULAIRE"]];
  ids.forEach(function (e) {
    const zid = avant[e] ? avant[e].zone : (ZONES_PAR_DEFAUT[e] || "");
    const zone = ZONES.filter(function (z) { return z.id === zid; })[0];
    let url = "";
    const dansForm = itemEnq.getType() === T.LIST
      ? itemEnq.asListItem().getChoices().some(function (c) { return norm_(c.getValue()).toUpperCase() === e; })
      : itemEnq.asMultipleChoiceItem().getChoices().some(function (c) { return norm_(c.getValue()).toUpperCase() === e; });
    if (dansForm) {
      const valEnq = (itemEnq.getType() === T.LIST ? itemEnq.asListItem() : itemEnq.asMultipleChoiceItem()).getChoices()
        .map(function (c) { return c.getValue(); }).filter(function (v) { return norm_(v).toUpperCase() === e; })[0];
      let resp = form.createResponse().withItemResponse(
        (itemEnq.getType() === T.LIST ? itemEnq.asListItem() : itemEnq.asMultipleChoiceItem()).createResponse(valEnq));
      if (zone && itemVille && itemVille.getType() === T.MULTIPLE_CHOICE) {
        const mc = itemVille.asMultipleChoiceItem();
        const v = mc.getChoices().map(function (c) { return c.getValue(); }).filter(function (x) { return cle_(x) === cle_(zone.libelle); })[0];
        if (v) resp = resp.withItemResponse(mc.createResponse(v));
      }
      url = resp.toPrefilledUrl();
    }
    lignes.push([e, avant[e] ? avant[e].nom : "", zid, "=P_OBJ_JOUR*P_NB_JOURS", url, dansForm ? "Oui" : "NON : absent de la liste du formulaire"]);
  });
  // Onglet vide puis reecrit (jamais supprime : d'autres onglets y font reference)
  let sh = ss.getSheetByName("ENQUETEURS");
  if (sh) { sh.clear(); sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations(); sh.clearConditionalFormatRules(); }
  else sh = ss.insertSheet("ENQUETEURS", ss.getSheets().length);
  if (sh.getMaxColumns() < 6) sh.insertColumnsAfter(sh.getMaxColumns(), 6 - sh.getMaxColumns());
  sh.getRange(1, 1, lignes.length, 6).setValues(lignes);
  styleEntete_(sh.getRange(1, 1, 1, 6));
  sh.getRange(2, 2, ids.length, 2).setBackground("#FFF2CC");
  sh.getRange(2, 3, ids.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ZONES.map(function (z) { return z.id; }), true).build());
  sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenCellEmpty()
    .setBackground("#F4CCCC").setRanges([sh.getRange(2, 3, ids.length, 1)]).build()]);
  sh.setColumnWidth(2, 200); sh.setColumnWidth(5, 420); sh.setColumnWidth(6, 260);
  sh.setFrozenRows(1);
  sh.getRange(ids.length + 3, 1).setValue("Case ZONE en rouge = à saisir, puis exécuter actualiser() : sans zone, la fiche prend la ville de Q4 et est marquée ZONE_ENQ_NON_PARAMETREE.")
    .setFontStyle("italic").setFontColor("#666666");
  return sh;
}

function creerMasque_(ss) {
  let sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
  if (!sh) sh = ss.insertSheet("MASQUE_DEPOUILLEMENT", ss.getSheets().length);
  const cols = colonnesMasque_();
  if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
  const ent = sh.getRange(1, 1, 3, sh.getMaxColumns());
  ent.breakApart(); ent.clear();
  const couleurs = ["#D9E1F2", "#E2EFDA"];
  let c = 1, k = 0;
  while (c <= cols.length) {
    const lib = cols[c - 1].section, debut = c;
    while (c <= cols.length && cols[c - 1].section === lib) c++;
    const r = sh.getRange(1, debut, 1, c - debut);
    if (c - debut > 1) r.merge();
    r.setValue(lib).setFontWeight("bold").setHorizontalAlignment("center").setBackground(couleurs[k++ % 2]);
  }
  sh.getRange(2, 1, 1, cols.length).setValues([cols.map(function (x) { return x.code; })]);
  styleEntete_(sh.getRange(2, 1, 1, cols.length));
  sh.getRange(3, 1, 1, cols.length).setValues([cols.map(function (x) { return x.label; })])
    .setFontStyle("italic").setFontSize(8).setWrap(true).setVerticalAlignment("top");
  sh.setRowHeight(3, 60);
  sh.setFrozenRows(3); sh.setFrozenColumns(2);
  reglesMasque_(sh);
  SpreadsheetApp.flush();
  return sh;
}

function reglesMasque_(sh) {
  const cols = colonnesMasque_(), n = sh.getMaxRows() - 3, p0 = CONFIG.PREMIERE_LIGNE_DONNEES;
  const plage = sh.getRange(p0, 1, n, cols.length), L = lettreColonne_(cols.length);
  sh.getRange(p0, 1, n, sh.getMaxColumns()).clearDataValidations();
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + L + "4=\"REJETE\"")
      .setBackground("#F4CCCC").setFontColor("#990000").setRanges([plage]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + L + "4=\"A_VERIFIER\"")
      .setBackground("#FFF2CC").setRanges([plage]).build()
  ]);
  sh.getRange(p0, cols.length, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["OK", "A_VERIFIER", "REJETE"], true).build());
  const iDate = cols.map(function (c) { return c.code; }).indexOf("DATEENQU") + 1;
  sh.getRange(p0, iDate, n, 1).setNumberFormat("dd/MM/yyyy");
  sh.getRange(p0, iDate + 1, n, 1).setNumberFormat("@");
}

function feuilleContacts_(ss) {
  let sh = ss.getSheetByName("CONTACTS");
  if (!sh) {
    sh = ss.insertSheet("CONTACTS", ss.getSheets().length);
    sh.getRange(1, 1, 1, ENTETE_CONTACTS.length).setValues([ENTETE_CONTACTS]);
    styleEntete_(sh.getRange(1, 1, 1, ENTETE_CONTACTS.length));
    sh.setFrozenRows(1);
    sh.getRange("J:J").setNumberFormat("@");
    const pl = sh.getRange(2, 1, sh.getMaxRows() - 1, ENTETE_CONTACTS.length);
    sh.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$L2="Oui"').setBackground("#D9EAD3").setRanges([pl]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$L2="Non"').setFontColor("#999999").setRanges([pl]).build()
    ]);
    sh.setColumnWidth(8, 220); sh.setColumnWidth(13, 260);
  }
  return sh;
}

function creerDictionnaire_(ss) {
  const sh = ongletNeuf_(ss, "DICTIONNAIRE");
  const lignes = [["VARIABLE", "QUESTION / LIBELLÉ", "FORMAT SPSS", "MESURE", "CODE", "MODALITÉ"]];
  colonnesMasque_().forEach(function (c) {
    if (c.valeurs) c.valeurs.forEach(function (p, i) {
      lignes.push([i === 0 ? c.code : "", i === 0 ? c.label : "", i === 0 ? c.spss : "", i === 0 ? (c.mesure || "") : "", p[0], p[1]]);
    });
    else lignes.push([c.code, c.label, c.spss, c.mesure || "", "", "(texte / valeur libre)"]);
  });
  sh.getRange(1, 1, lignes.length, 6).setValues(lignes);
  styleEntete_(sh.getRange(1, 1, 1, 6));
  sh.setFrozenRows(1); sh.setColumnWidth(2, 380); sh.setColumnWidth(6, 260);
}

// =====================================================================
// 6. DIAGNOSTIC : le formulaire en ligne correspond-il au dictionnaire ?
// =====================================================================
function diagnostiquer() {
  const form = formulaire_(), ss = classeur_(), T = FormApp.ItemType;
  const L = [["ÉLÉMENT", "STATUT", "DÉTAIL"]];
  let nbKo = 0, nbAlerte = 0;
  const parNum = {}, vus = {};
  form.getItems().forEach(function (x) {
    const n = numeroQuestion_(x.getTitle());
    if (n) { if (parNum[n]) L.push([x.getTitle(), "⚠", "Numéro Q" + n + " en double : seule la 1re question est codée"]); else parNum[n] = x; }
  });
  const choixDe = function (x) {
    const t = x.getType();
    if (t === T.MULTIPLE_CHOICE) return x.asMultipleChoiceItem().getChoices().map(function (c) { return c.getValue(); });
    if (t === T.CHECKBOX) return x.asCheckboxItem().getChoices().map(function (c) { return c.getValue(); });
    if (t === T.LIST) return x.asListItem().getChoices().map(function (c) { return c.getValue(); });
    if (t === T.GRID) return x.asGridItem().getColumns();
    return [];
  };
  const requis = function (x) {
    try {
      const t = x.getType();
      if (t === T.MULTIPLE_CHOICE) return x.asMultipleChoiceItem().isRequired();
      if (t === T.CHECKBOX) return x.asCheckboxItem().isRequired();
      if (t === T.LIST) return x.asListItem().isRequired();
      if (t === T.GRID) return x.asGridItem().isRequired();
      if (t === T.TEXT) return x.asTextItem().isRequired();
      if (t === T.PARAGRAPH_TEXT) return x.asParagraphTextItem().isRequired();
    } catch (e) { /* type sans notion d'obligation */ }
    return null;
  };
  const attendu = { radio: [T.MULTIPLE_CHOICE, T.LIST], multi: [T.CHECKBOX], grille: [T.GRID], text: [T.TEXT, T.PARAGRAPH_TEXT] };

  IDENT.forEach(function (d) {
    const x = form.getItems().filter(function (y) { return champIdent_(y.getTitle()) === d.champ && !numeroQuestion_(y.getTitle()); })[0];
    if (!x) { L.push([d.titre, d.champ === "enq" ? "✘" : "⚠", "Absente du formulaire"]); if (d.champ === "enq") nbKo++; else nbAlerte++; return; }
    vus[x.getId()] = true;
    const r = requis(x);
    L.push([x.getTitle(), r === false && d.champ !== "mail" && d.champ !== "nom" && d.champ !== "tel" ? "⚠" : "✔",
      (r ? "Obligatoire" : "Facultative") + (r === false && (d.champ === "tel") ? " — sans téléphone, le contrôle TEL_DOUBLON ne fonctionne pas" : "")]);
  });

  ITEMS.forEach(function (it) {
    const x = parNum[it.n];
    if (!x) { L.push([it.q, "✘", "Question absente : la variable sera toujours vide (99)"]); nbKo++; return; }
    vus[x.getId()] = true;
    const msg = [];
    let statut = "✔";
    if (attendu[it.type].indexOf(x.getType()) < 0) { statut = "✘"; msg.push("Type « " + x.getType() + " » au lieu de « " + it.type + " »"); }
    const ch = choixDe(x).map(function (c) { return norm_(c); });
    const dico = it.type === "multi" ? it.sousItems.map(function (s) { return s[1]; }) : (it.choix || []).map(function (c) { return c[1]; });
    const kd = dico.map(cle_), kf = ch.map(cle_);
    const inconnues = ch.filter(function (c) { return kd.indexOf(cle_(c)) < 0 && !(it.alias && Object.keys(it.alias).some(function (a) { return cle_(a) === cle_(c); })); });
    const manquantes = dico.filter(function (c) { return kf.indexOf(cle_(c)) < 0; });
    if (inconnues.length) { statut = "✘"; msg.push("Modalités inconnues du dictionnaire (codées 99) : " + inconnues.join(" ; ")); }
    if (manquantes.length) { if (statut === "✔") statut = "⚠"; msg.push("Modalités du dictionnaire absentes du formulaire : " + manquantes.join(" ; ")); }
    if (it.type === "grille") {
      const lf = x.asGridItem().getRows().map(cle_);
      const lm = it.lignes.filter(function (l) { return lf.indexOf(cle_(l[1])) < 0; }).map(function (l) { return l[1]; });
      if (lm.length) { statut = "✘"; msg.push("Lignes de grille introuvables : " + lm.join(" ; ")); }
    }
    if (it.autre) {
      const autreOk = x.getType() === T.MULTIPLE_CHOICE && x.asMultipleChoiceItem().hasOtherOption();
      if (!autreOk) { if (statut === "✔") statut = "⚠"; msg.push("Option « Autre » désactivée : " + it.autre.variable + " restera vide"); }
    }
    const r = requis(x);
    if (r === false && it.type !== "text") { if (statut === "✔") statut = "⚠"; msg.push("Facultative : une question sautée sera codée 99"); }
    if (statut === "✘") nbKo++; else if (statut === "⚠") nbAlerte++;
    L.push([x.getTitle(), statut, msg.join(" | ") || "Conforme"]);
  });

  form.getItems().forEach(function (x) {
    const t = x.getType();
    if (vus[x.getId()] || t === T.SECTION_HEADER || t === T.PAGE_BREAK || t === T.IMAGE || t === T.VIDEO) return;
    L.push([x.getTitle(), "⚠", "Question hors dictionnaire : non codée, non exportée"]);
    nbAlerte++;
  });

  const verdict = nbKo ? "✘ " + nbKo + " blocage(s), " + nbAlerte + " alerte(s) : corriger avant le terrain" :
                         "✔ Codification possible — " + nbAlerte + " alerte(s) à lire";
  const sh = ongletNeuf_(ss, "DIAGNOSTIC_FORMULAIRE");
  sh.getRange(1, 1).setValue("DIAGNOSTIC DU FORMULAIRE — " + fmtDouala_(new Date(), "dd/MM/yyyy HH:mm")).setFontSize(13).setFontWeight("bold");
  sh.getRange(2, 1).setValue(verdict).setFontWeight("bold").setBackground(nbKo ? "#F4CCCC" : "#D9EAD3");
  sh.getRange(4, 1, L.length, 3).setValues(L);
  styleEntete_(sh.getRange(4, 1, 1, 3));
  const pl = sh.getRange(5, 2, L.length - 1, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("✘").setBackground("#F4CCCC").setRanges([pl]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("⚠").setBackground("#FFF2CC").setRanges([pl]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("✔").setBackground("#D9EAD3").setRanges([pl]).build()
  ]);
  sh.setColumnWidth(1, 420); sh.setColumnWidth(2, 70); sh.setColumnWidth(3, 700);
  sh.getRange(5, 3, L.length, 1).setWrap(true);
  sh.setFrozenRows(4);
  return verdict;
}

// =====================================================================
// 7. SYNCHRONISATION FORMULAIRE -> MASQUE (V5 : idempotente et auto-reparatrice)
//    Principe : chaque ligne du masque porte l'identifiant Google de sa reponse
//    (colonne technique IDREPONSE, apres STATUTQC, non exportee). A chaque passage,
//    le script compare le masque aux reponses du formulaire et :
//      - ajoute les reponses manquantes (meme si une soumission precedente a echoue) ;
//      - reconstruit le masque s'il contient des doublons, des lignes ecrites par
//        un autre script, des lignes vides ou des fiches supprimees du formulaire.
//    Une fiche ne peut donc plus etre perdue ni comptee deux fois.
// =====================================================================
const COL_ID = "IDREPONSE";

function telsDejaVus_(ss) {
  const sh = feuilleContacts_(ss), vus = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 10, sh.getLastRow() - 1, 1).getValues().forEach(function (l) {
    const k = String(l[0]).replace(/\D/g, "").replace(/^237/, "");
    if (k) vus[k] = true;
  });
  return vus;
}

function seuilDelai_(ss) {
  try {
    const r = ss.getRangeByName("P_SEUIL_DELAI");
    const v = r ? Number(r.getValue()) : 0;
    return v > 0 ? v : CONFIG.SEUIL_DELAI_MIN;
  } catch (e) { return CONFIG.SEUIL_DELAI_MIN; }
}

/** Onglet du masque, avec sa colonne technique IDREPONSE (creee si absente). */
function masque_(ss) {
  let sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
  if (!sh) sh = creerMasque_(ss);
  const nC = colonnesMasque_().length;
  if (sh.getMaxColumns() < nC + 1) sh.insertColumnsAfter(sh.getMaxColumns(), nC + 1 - sh.getMaxColumns());
  if (sh.getRange(2, nC + 1).getValue() !== COL_ID) {
    sh.getRange(1, nC + 1, 3, 1).setValues([["Technique"], [COL_ID], ["Identifiant Google de la réponse — ne pas modifier (non exporté vers SPSS)"]]);
    sh.getRange(CONFIG.PREMIERE_LIGNE_DONNEES, nC + 1, Math.max(sh.getMaxRows() - 3, 1), 1).setNumberFormat("@").setFontColor("#999999");
  }
  return sh;
}

/** Ecrit des lignes dans le masque. La date est ecrite a minuit heure de Douala,
 *  quel que soit le fuseau du projet de script (sinon J1/J2/J3 et AUJOURD'HUI restent a 0). */
function ecrireLignes_(sh, lignes, premiere) {
  if (!lignes.length) return;
  const iDate = colonnesMasque_().map(function (c) { return c.code; }).indexOf("DATEENQU");
  const out = lignes.map(function (l) {
    const x = l.slice();
    if (typeof x[iDate] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x[iDate])) {
      x[iDate] = Utilities.parseDate(x[iDate] + " 00:00:00", CONFIG.FUSEAU, "yyyy-MM-dd HH:mm:ss");
    }
    return x;
  });
  const besoin = premiere + out.length - 1;
  if (besoin > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), besoin - sh.getMaxRows() + 200);
  sh.getRange(premiere, 1, out.length, out[0].length).setValues(out);
}

/** Numero d'ordre d'un N° de fiche : « DLA-ENQ1-012 » -> 12 (0 si illisible). */
function numSeq_(num) {
  const m = String(num || "").match(/-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

/**
 * FONCTION PURE : compare le masque aux reponses et decide quoi faire.
 * @param {Array<{id:string,num:string}>} masque  une entree par ligne lue dans le masque
 * @param {Array<{id:string}>} reps               reponses du formulaire
 * @param {boolean} complet                       true si reps = TOUTES les reponses
 */
function planSync_(masque, reps, complet) {
  const dansMasque = {}, dansForm = {};
  let sansId = 0, doublons = 0, orphelines = 0, trous = 0;
  masque.forEach(function (m) {
    if (!m.id && !m.num) { trous++; return; }
    if (!m.id) { sansId++; return; }
    if (dansMasque[m.id]) doublons++;
    dansMasque[m.id] = true;
  });
  const aAjouter = [];
  reps.forEach(function (r) {
    if (!dansForm[r.id] && !dansMasque[r.id]) aAjouter.push(r.id);
    dansForm[r.id] = true;
  });
  if (complet) Object.keys(dansMasque).forEach(function (id) { if (!dansForm[id]) orphelines++; });
  const raisons = [];
  if (sansId) raisons.push(sansId + " ligne(s) sans identifiant (écrites par une ancienne version, un autre script ou à la main)");
  if (doublons) raisons.push(doublons + " fiche(s) en double");
  if (trous) raisons.push(trous + " ligne(s) vide(s) au milieu du masque");
  if (orphelines) raisons.push(orphelines + " fiche(s) dont la réponse a été supprimée du formulaire");
  return { mode: raisons.length ? "RECONSTRUIRE" : (aAjouter.length ? "AJOUTER" : "RIEN"), aAjouter: aAjouter, raisons: raisons,
           sansId: sansId, doublons: doublons, orphelines: orphelines, trous: trous, n: 0 };
}

function enqDe_(lu) {
  const x = lu.id.enq;
  return norm_(Array.isArray(x) ? x[0] : x).toUpperCase();
}

function journal_(ss, source, message) {
  try {
    let sh = ss.getSheetByName("JOURNAL_SYNC");
    if (!sh) {
      sh = ss.insertSheet("JOURNAL_SYNC", ss.getSheets().length);
      sh.getRange(1, 1, 1, 3).setValues([["DATE", "SOURCE", "ÉVÉNEMENT"]]);
      styleEntete_(sh.getRange(1, 1, 1, 3));
      sh.setColumnWidth(1, 140); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 900); sh.setFrozenRows(1);
    }
    sh.appendRow([fmtDouala_(new Date(), "dd/MM/yyyy HH:mm:ss"), source, String(message).substr(0, 1500)]);
  } catch (e) { Logger.log("Journal indisponible : " + e.message + " — " + message); }
}

/** Ajoute au masque les reponses manquantes (sans toucher aux lignes existantes). */
function ajouter_(ss, sh, data, reps, ids, props) {
  const nC = colonnesMasque_().length;
  let etat;
  try { etat = JSON.parse(props.getProperty("ETAT") || "{}"); } catch (e) { etat = {}; }
  if (!etat.seq) etat.seq = {};
  if (!etat.dernier) etat.dernier = {};
  data.forEach(function (l) {                                  // jamais deux fois le meme N° de fiche
    const enq = norm_(l[1]).toUpperCase(), s = numSeq_(l[0]);
    if (enq && s) etat.seq[enq] = Math.max(etat.seq[enq] || 0, s);
  });
  const voulu = {}, pris = {};
  ids.forEach(function (i) { voulu[i] = true; });
  const aFaire = reps.filter(function (r) { const i = r.getId(); if (!voulu[i] || pris[i]) return false; pris[i] = true; return true; })
    .sort(function (a, b) { return a.getTimestamp() - b.getTimestamp(); });
  if (!aFaire.length) return 0;
  const enqs = lireEnqueteurs_(ss), seuil = seuilDelai_(ss), telsVus = telsDejaVus_(ss), contacts = [];
  let tsMax = Number(props.getProperty("DERNIER_TS") || 0);
  const lignes = aFaire.map(function (r) {
    const f = { lu: structurer_(reponseEnListe_(r)), horodatage: r.getTimestamp(), enqueteurs: enqs, seuilDelai: seuil, telsVus: telsVus };
    const l = construireLigne_(f, etat, fmtDouala_);
    l.push(r.getId());
    contacts.push(f.contact);
    tsMax = Math.max(tsMax, r.getTimestamp().getTime());
    return l;
  });
  ecrireLignes_(sh, lignes, CONFIG.PREMIERE_LIGNE_DONNEES + data.length);
  const shc = feuilleContacts_(ss);
  shc.getRange(shc.getLastRow() + 1, 1, contacts.length, ENTETE_CONTACTS.length).setValues(contacts);
  props.setProperties({ ETAT: JSON.stringify(etat), DERNIER_TS: String(tsMax) });
  return lignes.length;
}

/** Reecrit tout le masque depuis les reponses du formulaire.
 *  Conserve : les statuts REJETE du superviseur et les N° de fiche deja attribues. */
function reconstruire_(ss, sh, data, reps, props) {
  const cols = colonnesMasque_(), nC = cols.length, iStat = nC - 1, p0 = CONFIG.PREMIERE_LIGNE_DONNEES;
  const rejId = {}, rejNum = {}, seqConnu = {};
  let nRej = 0;
  data.forEach(function (l) {
    const id = norm_(l[nC]), num = norm_(l[0]);
    if (l[iStat] === "REJETE") { if (id) rejId[id] = true; else if (num) rejNum[num] = true; }
    if (id && num && !(id in seqConnu)) { const s = numSeq_(num); if (s) seqConnu[id] = s; }
  });
  const pris = {};
  const fiches = reps.filter(function (r) { const i = r.getId(); if (pris[i]) return false; pris[i] = true; return true; })
    .sort(function (a, b) { return a.getTimestamp() - b.getTimestamp(); })
    .map(function (r) { return { r: r, id: r.getId(), lu: structurer_(reponseEnListe_(r)) }; });

  const etat = { seq: {}, dernier: {} }, utilises = {};
  fiches.forEach(function (f) {                                 // reserve les numeros deja attribues
    const s = seqConnu[f.id], enq = enqDe_(f.lu);
    if (s && !utilises[enq + "|" + s]) { utilises[enq + "|" + s] = true; f.seq = s; etat.seq[enq] = Math.max(etat.seq[enq] || 0, s); }
  });
  const enqs = lireEnqueteurs_(ss), seuil = seuilDelai_(ss), telsVus = {}, contacts = [];
  let tsMax = 0;
  const lignes = fiches.map(function (f) {
    const x = { lu: f.lu, horodatage: f.r.getTimestamp(), enqueteurs: enqs, seuilDelai: seuil, telsVus: telsVus, seqForce: f.seq || 0 };
    const l = construireLigne_(x, etat, fmtDouala_);
    if (rejId[f.id] || (!(f.id in seqConnu) && rejNum[l[0]])) { l[iStat] = "REJETE"; x.contact[x.contact.length - 1] = "REJETE"; nRej++; }
    l.push(f.id);
    contacts.push(x.contact);
    tsMax = Math.max(tsMax, f.r.getTimestamp().getTime());
    return l;
  });
  if (data.length) sh.getRange(p0, 1, data.length, nC + 1).clearContent();
  ecrireLignes_(sh, lignes, p0);
  const shc = feuilleContacts_(ss);
  if (shc.getLastRow() > 1) shc.getRange(2, 1, shc.getLastRow() - 1, ENTETE_CONTACTS.length).clearContent();
  if (contacts.length) shc.getRange(2, 1, contacts.length, ENTETE_CONTACTS.length).setValues(contacts);
  props.setProperties({ ETAT: JSON.stringify(etat), DERNIER_TS: String(tsMax) });
  return { n: lignes.length, rejetes: nRej };
}

/**
 * Coeur de la synchronisation.
 * @param {string} source          SOUMISSION | FILET | MANUEL | REPARER | EXPORT
 * @param {Object} reponseDirecte  reponse recue par le declencheur (ou null)
 * @param {boolean} complet        true = comparer a TOUTES les reponses du formulaire
 * @param {boolean} forcer         true = reconstruire le masque quoi qu'il arrive
 */
function synchroniser_(source, reponseDirecte, complet, forcer) {
  const props = PropertiesService.getScriptProperties();
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(source === "FILET" ? 15000 : 120000)) {
    props.setProperty("DERNIERE_ERREUR", fmtDouala_(new Date(), "dd/MM/yyyy HH:mm:ss") + " — " + source + " : synchronisation déjà en cours, rattrapage au prochain passage");
    return { mode: "OCCUPE", raisons: [], n: 0 };
  }
  try {
    const ss = classeur_(), form = formulaire_();
    if (ss.getSpreadsheetTimeZone() !== CONFIG.FUSEAU) ss.setSpreadsheetTimeZone(CONFIG.FUSEAU);
    const sh = masque_(ss), nC = colonnesMasque_().length, p0 = CONFIG.PREMIERE_LIGNE_DONNEES;
    const n = sh.getLastRow() - p0 + 1;
    const data = n > 0 ? sh.getRange(p0, 1, n, nC + 1).getValues() : [];
    const t0 = Number(props.getProperty("DERNIER_TS") || 0);
    if (forcer || !t0) complet = true;
    let reps = complet ? form.getResponses() : form.getResponses(new Date(t0 - 20 * 60000));
    if (reponseDirecte && !reps.some(function (r) { return r.getId() === reponseDirecte.getId(); })) reps.push(reponseDirecte);

    const plan = planSync_(data.map(function (l) { return { id: norm_(l[nC]), num: norm_(l[0]) }; }),
                           reps.map(function (r) { return { id: r.getId() }; }), complet);
    if (forcer && plan.mode !== "RECONSTRUIRE") { plan.mode = "RECONSTRUIRE"; plan.raisons.push("demande manuelle"); }

    if (plan.mode === "RECONSTRUIRE") {
      if (!complet) reps = form.getResponses();
      const r = reconstruire_(ss, sh, data, reps, props);
      plan.n = r.n;
      journal_(ss, source, "Masque reconstruit : " + r.n + " fiche(s) pour " + reps.length + " réponse(s), " + r.rejetes +
        " REJETE conservé(s). Motif : " + plan.raisons.join(" ; "));
    } else if (plan.mode === "AJOUTER") {
      plan.n = ajouter_(ss, sh, data, reps, plan.aAjouter, props);
      if (source !== "SOUMISSION" || plan.n > 1) journal_(ss, source, plan.n + " fiche(s) ajoutée(s) en rattrapage.");
    }
    if (plan.mode !== "RIEN") SpreadsheetApp.flush();
    props.setProperty("DERNIERE_SYNC", fmtDouala_(new Date(), "dd/MM/yyyy HH:mm:ss") + " (" + source + ")");
    return plan;
  } finally {
    verrou.releaseLock();
  }
}

/** Declencheur : a chaque soumission du formulaire. Une erreur n'est plus jamais silencieuse. */
function surSoumission(e) {
  try {
    synchroniser_("SOUMISSION", e && e.response ? e.response : null, false, false);
  } catch (err) {
    const msg = fmtDouala_(new Date(), "dd/MM/yyyy HH:mm:ss") + " — SOUMISSION : " + err.message;
    PropertiesService.getScriptProperties().setProperty("DERNIERE_ERREUR", msg);
    try { journal_(classeur_(), "ERREUR", err.message + (err.stack ? " | " + String(err.stack).substr(0, 600) : "")); } catch (e2) { /* rien */ }
    throw err;                                                  // visible dans « Exécutions » d'Apps Script
  }
}

/** Declencheur horaire (toutes les 10 min) : rattrape toute fiche manquante, retire tout doublon. */
function filetDeSecurite() {
  try { synchroniser_("FILET", null, true, false); }
  catch (err) {
    PropertiesService.getScriptProperties().setProperty("DERNIERE_ERREUR", fmtDouala_(new Date(), "dd/MM/yyyy HH:mm:ss") + " — FILET : " + err.message);
    try { journal_(classeur_(), "ERREUR", "FILET : " + err.message); } catch (e2) { /* rien */ }
  }
}

/** Recode toutes les reponses du formulaire (conserve les REJETE et les N° de fiche). */
function reconstruireMasque() {
  const plan = synchroniser_("MANUEL", null, true, true);
  Logger.log(plan.mode === "OCCUPE" ? "Synchronisation déjà en cours : relancez dans une minute." : plan.n + " fiche(s) dans le masque.");
}

function installerDeclencheurs_(form) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (["surSoumission", "filetDeSecurite"].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("surSoumission").forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger("filetDeSecurite").timeBased().everyMinutes(10).create();
}

/**
 * >>> A LANCER EN CAS DE PROBLEME (sans danger, autant de fois que necessaire) <<<
 * Remet les declencheurs de CE projet, le fuseau du classeur, reconstruit le masque
 * depuis les reponses du formulaire et ecrit le bilan dans l'onglet SANTE_SYNC.
 * Aucune reponse du formulaire n'est modifiee ni supprimee.
 */
function reparer() {
  const form = formulaire_(), ss = classeur_();
  if (ss.getSpreadsheetTimeZone() !== CONFIG.FUSEAU) ss.setSpreadsheetTimeZone(CONFIG.FUSEAU);
  installerDeclencheurs_(form);
  reglesMasque_(masque_(ss));
  const plan = synchroniser_("REPARER", null, true, true);
  const verdict = sante();
  Logger.log(plan.mode === "OCCUPE" ? "Synchronisation déjà en cours : relancez reparer() dans une minute." : "Masque reconstruit : " + plan.n + " fiche(s).");
  Logger.log("Bilan (onglet SANTE_SYNC) : " + verdict);
  Logger.log("Classeur : " + ss.getUrl());
}

/** Bilan de synchronisation : onglet SANTE_SYNC. Ne modifie ni le masque ni le formulaire. */
function sante() {
  const props = PropertiesService.getScriptProperties();
  const ss = classeur_(), form = formulaire_(), sh = masque_(ss);
  const nC = colonnesMasque_().length, p0 = CONFIG.PREMIERE_LIGNE_DONNEES, iDate = colonnesMasque_().map(function (c) { return c.code; }).indexOf("DATEENQU");
  const n = sh.getLastRow() - p0 + 1;
  const data = n > 0 ? sh.getRange(p0, 1, n, nC + 1).getValues() : [];
  const reps = form.getResponses();
  const plan = planSync_(data.map(function (l) { return { id: norm_(l[nC]), num: norm_(l[0]) }; }), reps.map(function (r) { return { id: r.getId() }; }), true);
  const nums = {}, parJourM = {}, parJourF = {};
  let numDoublons = 0, nFiches = 0, dateAvecHeure = 0;
  data.forEach(function (l) {
    const num = norm_(l[0]); if (!num) return;
    nFiches++;
    if (nums[num]) numDoublons++; nums[num] = true;
    const d = l[iDate];
    const j = d instanceof Date ? fmtDouala_(d, "dd/MM/yyyy") : String(d);
    if (d instanceof Date && fmtDouala_(d, "HH:mm:ss") !== "00:00:00") dateAvecHeure++;
    if (l[nC - 1] !== "REJETE") parJourM[j] = (parJourM[j] || 0) + 1;
  });
  reps.forEach(function (r) { const j = fmtDouala_(r.getTimestamp(), "dd/MM/yyyy"); parJourF[j] = (parJourF[j] || 0) + 1; });
  const jours = Object.keys(parJourF).concat(Object.keys(parJourM)).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) {
    return a.split("/").reverse().join("") < b.split("/").reverse().join("") ? -1 : 1; });
  let dest = "";
  try { dest = form.getDestinationId(); } catch (e) { dest = ""; }
  const decl = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  const nSub = decl.filter(function (x) { return x === "surSoumission"; }).length, nFilet = decl.filter(function (x) { return x === "filetDeSecurite"; }).length;
  const jP = ["P_J1", "P_J2", "P_J3"].map(function (k) {
    try { const v = ss.getRangeByName(k).getValue(); return v instanceof Date ? fmtDouala_(v, "dd/MM/yyyy") : "(non saisie)"; } catch (e) { return "(introuvable)"; }
  });

  const L = [["CONTRÔLE", "VALEUR", "ÉTAT", "QUE FAIRE"]];
  const ok = function (c) { return c ? "✔" : "✘"; };
  const ecart = reps.length - nFiches;
  L.push(["Réponses dans le formulaire", reps.length, "", ""]);
  L.push(["Fiches dans le masque", nFiches, ok(ecart === 0), ecart === 0 ? "" : "Écart de " + ecart + " : exécuter reparer()"]);
  L.push(["Réponses absentes du masque", plan.aAjouter.length, ok(!plan.aAjouter.length), plan.aAjouter.length ? "Rattrapage automatique sous 10 min, ou reparer()" : ""]);
  L.push(["Fiches en double dans le masque", plan.doublons, ok(!plan.doublons), plan.doublons ? "reparer()" : ""]);
  L.push(["Lignes sans identifiant de réponse", plan.sansId, ok(!plan.sansId),
    plan.sansId ? "Si elles reviennent après reparer() : un AUTRE script écrit dans ce masque. Supprimer son déclencheur sur script.google.com > Déclencheurs" : ""]);
  L.push(["Fiches dont la réponse a été supprimée du formulaire", plan.orphelines, ok(!plan.orphelines), plan.orphelines ? "reparer()" : ""]);
  L.push(["Lignes vides au milieu du masque", plan.trous, ok(!plan.trous), plan.trous ? "reparer()" : ""]);
  L.push(["N° de fiche en double", numDoublons, ok(!numDoublons), numDoublons ? "reparer()" : ""]);
  L.push(["Dates du masque avec une heure parasite", dateAvecHeure, ok(!dateAvecHeure), dateAvecHeure ? "Cause des colonnes J1/J2/J3 à 0 : reparer()" : ""]);
  L.push(["Déclencheur « à la soumission » de ce projet", nSub, ok(nSub === 1), nSub === 1 ? "" : "reparer()"]);
  L.push(["Déclencheur « filet de sécurité » (10 min)", nFilet, ok(nFilet === 1), nFilet === 1 ? "" : "reparer()"]);
  L.push(["Classeur de destination du formulaire = ce classeur", dest ? (dest === ss.getId() ? "Oui" : "NON") : "(aucune destination)", ok(!dest || dest === ss.getId()),
    dest && dest !== ss.getId() ? "Le formulaire écrit ses réponses brutes dans un autre classeur : vous regardez peut-être le mauvais fichier" : ""]);
  L.push(["Fuseau du classeur", ss.getSpreadsheetTimeZone(), ok(ss.getSpreadsheetTimeZone() === CONFIG.FUSEAU), ""]);
  L.push(["Fuseau du projet de script", Session.getScriptTimeZone(), "", "Sans incidence depuis la V5"]);
  L.push(["Dates J1 / J2 / J3 (onglet PARAMETRES)", jP.join(" · "), "", "Doivent correspondre aux jours ci-dessous"]);
  jours.forEach(function (j) {
    L.push(["Jour " + j + " — réponses formulaire / fiches masque (hors REJETE)", (parJourF[j] || 0) + " / " + (parJourM[j] || 0), "", jP.indexOf(j) < 0 ? "Jour absent de PARAMETRES : non compté en J1/J2/J3" : ""]);
  });
  L.push(["Dernière synchronisation", props.getProperty("DERNIERE_SYNC") || "(jamais)", "", ""]);
  L.push(["Dernière erreur", props.getProperty("DERNIERE_ERREUR") || "(aucune)", "", "Détail : onglet JOURNAL_SYNC"]);

  const nKo = L.filter(function (l) { return l[2] === "✘"; }).length;
  const verdict = nKo ? "✘ " + nKo + " anomalie(s) : exécuter reparer()" : "✔ Masque synchronisé avec le formulaire (" + nFiches + " fiches)";
  let s = ss.getSheetByName("SANTE_SYNC");
  if (s) { s.clear(); s.clearConditionalFormatRules(); } else s = ss.insertSheet("SANTE_SYNC", ss.getSheets().length);
  s.getRange(1, 1).setValue("SANTÉ DE LA SYNCHRONISATION — " + fmtDouala_(new Date(), "dd/MM/yyyy HH:mm")).setFontSize(13).setFontWeight("bold");
  s.getRange(2, 1).setValue(verdict).setFontWeight("bold").setBackground(nKo ? "#F4CCCC" : "#D9EAD3");
  s.getRange(4, 1, L.length, 4).setNumberFormat("@").setValues(L.map(function (l) { return l.map(String); }));
  styleEntete_(s.getRange(4, 1, 1, 4));
  const pl = s.getRange(5, 3, L.length - 1, 1);
  s.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("✘").setBackground("#F4CCCC").setRanges([pl]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("✔").setBackground("#D9EAD3").setRanges([pl]).build()
  ]);
  s.setColumnWidth(1, 430); s.setColumnWidth(2, 240); s.setColumnWidth(3, 60); s.setColumnWidth(4, 640);
  s.getRange(5, 4, L.length, 1).setWrap(true);
  s.setFrozenRows(4);
  return verdict;
}

// =====================================================================
// 8. TABLEAU DE BORD, TRI A PLAT, SUIVI DES CIBLES (100 % formules)
// =====================================================================
function creerTableauDeBord_(ss) {
  const sh = ongletNeuf_(ss, "TABLEAU_DE_BORD");
  const E = refMasque_("CODEENQU"), D = refMasque_("DATEENQU"), S = refMasque_("STATUTQC"), A = refMasque_("ANOMALIE");
  const V = S + ",\"<>REJETE\"";
  const nE = Math.max(ss.getSheetByName("ENQUETEURS").getLastRow() - 1, 1);
  const nEnq = ss.getSheetByName("ENQUETEURS").getRange(2, 1, nE, 1).getValues().filter(function (l) { return norm_(l[0]); }).length;
  sh.getRange("A1").setValue("SUIVI TERRAIN EN TEMPS RÉEL — EDM Électrique Cameroun").setFontSize(14).setFontWeight("bold");
  sh.getRange("A2").setValue("Fiches REJETE exclues. Dates J1/J2/J3 et seuils : onglet PARAMETRES. Mise à jour automatique à chaque soumission.")
    .setFontStyle("italic").setFontColor("#666666");
  const ent = ["ENQ_ID", "NOM", "ZONE", "J1", "J2", "J3", "AUJOURD'HUI", "CUMUL", "OBJECTIF", "% RÉALISÉ", "DÉLAIS COURTS", "À VÉRIFIER", "REJETÉES", "STATUT"];
  sh.getRange(4, 1, 1, ent.length).setValues([ent]); styleEntete_(sh.getRange(4, 1, 1, ent.length));
  const f = [];
  for (let i = 0; i < nEnq; i++) {
    const r = 5 + i, re = 2 + i;
    f.push(["=ENQUETEURS!A" + re, "=ENQUETEURS!B" + re, "=ENQUETEURS!C" + re,
      "=IF(P_J1=\"\",\"\",COUNTIFS(" + E + ",$A" + r + "," + D + ",P_J1," + V + "))",
      "=IF(P_J2=\"\",\"\",COUNTIFS(" + E + ",$A" + r + "," + D + ",P_J2," + V + "))",
      "=IF(P_J3=\"\",\"\",COUNTIFS(" + E + ",$A" + r + "," + D + ",P_J3," + V + "))",
      "=COUNTIFS(" + E + ",$A" + r + "," + D + ",TODAY()," + V + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + V + ")",
      "=ENQUETEURS!D" + re,
      "=IF(N(I" + r + ")=0,0,H" + r + "/I" + r + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + A + ",\"*DELAI_COURT*\"," + V + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + S + ",\"A_VERIFIER\")",
      "=COUNTIFS(" + E + ",$A" + r + "," + S + ",\"REJETE\")",
      "=IF(C" + r + "=\"\",\"⚠ Zone à saisir\",IF(G" + r + ">P_SEUIL_VOLUME,\"⚠ Volume suspect\",IF(H" + r + ">=I" + r + ",\"✔ Objectif atteint\"," +
        "IF(K" + r + ">0,\"⚠ Délais courts\",\"En cours\"))))"]);
  }
  sh.getRange(5, 1, nEnq, ent.length).setFormulas(f);
  sh.getRange(5, 10, nEnq, 1).setNumberFormat("0%");
  const fin = 4 + nEnq;
  // Fiches dont l'identifiant n'est pas dans ENQUETEURS
  sh.getRange(fin + 1, 1, 1, 8).setValues([["Hors liste", "", "", "", "", "", "",
    "=COUNTIFS(" + E + ",\"<>\"," + V + ")-SUM(H5:H" + fin + ")"]]).setFontStyle("italic");

  const z0 = fin + 4;
  sh.getRange(z0 - 1, 1).setValue("RÉCAPITULATIF PAR ZONE").setFontWeight("bold");
  sh.getRange(z0, 1, 1, 6).setValues([["ZONE", "ENQUÊTEURS", "CUMUL", "OBJECTIF (capacité)", "QUOTA", "% DU QUOTA"]]);
  styleEntete_(sh.getRange(z0, 1, 1, 6));
  const Z = refMasque_("CODEZONE");
  const zf = ZONES.map(function (z, i) {
    const r = z0 + 1 + i, q = Object.keys(QUOTAS).reduce(function (s, k) { return s + QUOTAS[k][1 + i]; }, 0);
    return [z.id, "=COUNTIF($C$5:$C$" + fin + ",A" + r + ")", "=COUNTIFS(" + Z + "," + z.code + "," + V + ")",
            "=SUMIF($C$5:$C$" + fin + ",A" + r + ",$I$5:$I$" + fin + ")", q, "=IF(E" + r + "=0,0,C" + r + "/E" + r + ")"];
  });
  const rt = z0 + 1 + ZONES.length;
  zf.push(["TOTAL", "=SUM(B" + (z0 + 1) + ":B" + (rt - 1) + ")", "=SUM(C" + (z0 + 1) + ":C" + (rt - 1) + ")",
           "=SUM(D" + (z0 + 1) + ":D" + (rt - 1) + ")", "=SUM(E" + (z0 + 1) + ":E" + (rt - 1) + ")", "=IF(E" + rt + "=0,0,C" + rt + "/E" + rt + ")"]);
  sh.getRange(z0 + 1, 1, zf.length, 6).setValues(zf);
  sh.getRange(rt, 1, 1, 6).setFontWeight("bold");
  sh.getRange(z0 + 1, 6, zf.length, 1).setNumberFormat("0%");

  const plS = sh.getRange(5, 14, nEnq, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("⚠").setBackground("#F4CCCC").setRanges([plS]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("✔").setBackground("#D9EAD3").setRanges([plS]).build(),
    SpreadsheetApp.newConditionalFormatRule().setGradientMaxpoint("#6AA84F").setGradientMidpointWithValue("#FFD966",
      SpreadsheetApp.InterpolationType.NUMBER, "0.5").setGradientMinpoint("#E06666").setRanges([sh.getRange(5, 10, nEnq, 1)]).build()
  ]);
  const chart = sh.newChart().setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange(4, 1, nEnq + 1, 1)).addRange(sh.getRange(4, 8, nEnq + 1, 2))
    .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_COLUMNS).setNumHeaders(1)
    .setOption("title", "Cumul vs objectif par enquêteur").setPosition(rt + 3, 1, 0, 0).build();
  sh.insertChart(chart);
  sh.setFrozenRows(4); sh.setColumnWidth(2, 180); sh.setColumnWidth(14, 170);
}

function creerTriAPlat_(ss) {
  const sh = ongletNeuf_(ss, "TRI_A_PLAT");
  const Z = refMasque_("CODEZONE"), S = refMasque_("STATUTQC"), E = refMasque_("CODEENQU");
  const V = S + ",\"<>REJETE\"";
  const lignes = [["TRI À PLAT EN TEMPS RÉEL (fiches REJETE exclues)", "", "", "", "", "", ""],
                  ["Base : fiches valides", "=COUNTIFS(" + E + ",\"<>\"," + V + ")", "", "", "", "", ""],
                  ["", "", "", "", "", "", ""]];
  const titres = [];
  colonnesMasque_().filter(function (c) { return c.valeurs && c.code !== "CODEZONE"; }).forEach(function (c) {
    const X = refMasque_(c.code);
    titres.push(lignes.length + 1);
    lignes.push([c.code + " — " + c.label, "", "", "", "", "", ""]);
    lignes.push(["Code", "Modalité"].concat(ZONES.map(function (z) { return z.libelle; })).concat(["Total", "% base"]));
    const vals = c.groupe ? c.valeurs.filter(function (p) { return p[0] === 1; }) : c.valeurs;
    vals.forEach(function (p) {
      const r = lignes.length + 1;
      lignes.push([p[0], p[1]].concat(ZONES.map(function (z) { return "=COUNTIFS(" + X + "," + p[0] + "," + Z + "," + z.code + "," + V + ")"; }))
        .concat(["=COUNTIFS(" + X + "," + p[0] + "," + V + ")", "=IF($B$2=0,0,F" + r + "/$B$2)"]));
    });
    lignes.push(["", "", "", "", "", "", ""]);
  });
  sh.getRange(1, 1, lignes.length, 7).setValues(lignes);
  sh.getRange("A1").setFontSize(13).setFontWeight("bold");
  sh.getRange(1, 7, lignes.length, 1).setNumberFormat("0.0%");
  titres.forEach(function (r) {
    sh.getRange(r, 1, 1, 7).merge().setFontWeight("bold").setBackground("#D9E1F2");
    styleEntete_(sh.getRange(r + 1, 1, 1, 7));
  });
  sh.setColumnWidth(1, 70); sh.setColumnWidth(2, 260);
}

function creerSuiviCibles_(ss) {
  const sh = ongletNeuf_(ss, "SUIVI_CIBLES");
  const ENQ = refMasque_("CODEENQU"), CIB = refMasque_("VOUSETES"), ZON = refMasque_("CODEZONE"), STA = refMasque_("STATUTQC");
  const V = STA + ",\"<>REJETE\"", codes = Object.keys(QUOTAS).map(Number), nC = codes.length;
  sh.getRange("A1").setValue("QUOTAS PAR CIBLE (Q1) ET PAR VILLE — cahier des charges 02 (cases jaunes modifiables)").setFontSize(13).setFontWeight("bold");
  const h = ["CODE Q1", "CIBLE"];
  ZONES.forEach(function (z) { h.push(z.id + " quota", "réalisé", "%"); });
  h.push("TOTAL quota", "réalisé", "%");
  sh.getRange(3, 1, 1, h.length).setValues([h]); styleEntete_(sh.getRange(3, 1, 1, h.length));
  const rows = codes.map(function (c, i) {
    const r = 4 + i, row = [c, QUOTAS[c][0]];
    ZONES.forEach(function (z, k) {
      const Lq = lettreColonne_(3 + 3 * k), Lr = lettreColonne_(4 + 3 * k);
      row.push(QUOTAS[c][1 + k], "=COUNTIFS(" + CIB + "," + c + "," + ZON + "," + z.code + "," + V + ")", "=IF(" + Lq + r + "=0,0," + Lr + r + "/" + Lq + r + ")");
    });
    row.push("=C" + r + "+F" + r + "+I" + r, "=D" + r + "+G" + r + "+J" + r, "=IF(L" + r + "=0,0,M" + r + "/L" + r + ")");
    return row;
  });
  const rT = 4 + nC;
  const tot = ["", "TOTAL"];
  for (let k = 3; k <= h.length; k++) {
    const L = lettreColonne_(k);
    tot.push((k - 3) % 3 === 2 ? "=IF(" + lettreColonne_(k - 2) + rT + "=0,0," + lettreColonne_(k - 1) + rT + "/" + lettreColonne_(k - 2) + rT + ")" : "=SUM(" + L + "4:" + L + (rT - 1) + ")");
  }
  rows.push(tot);
  sh.getRange(4, 1, rows.length, h.length).setValues(rows);
  [3, 6, 9].forEach(function (c) { sh.getRange(4, c, nC, 1).setBackground("#FFF2CC"); });
  [5, 8, 11, 14].forEach(function (c) { sh.getRange(4, c, nC + 1, 1).setNumberFormat("0%"); });
  sh.getRange(rT, 1, 1, h.length).setFontWeight("bold");

  // Enqueteur x cible (cumul)
  const r0 = rT + 3;
  sh.getRange(r0 - 1, 1).setValue("PRODUCTION PAR ENQUÊTEUR ET PAR CIBLE (cumul)").setFontWeight("bold");
  const he = ["ENQ", "ZONE"].concat(codes.map(function (c) { return QUOTAS[c][0]; })).concat(["TOTAL"]);
  sh.getRange(r0, 1, 1, he.length).setValues([he]); styleEntete_(sh.getRange(r0, 1, 1, he.length));
  sh.getRange(r0, 1, 1, he.length).setWrap(true);
  const nE = Math.max(ss.getSheetByName("ENQUETEURS").getLastRow() - 1, 1);
  const ids = ss.getSheetByName("ENQUETEURS").getRange(2, 1, nE, 1).getValues().filter(function (l) { return norm_(l[0]); });
  const re = ids.map(function (_, i) {
    const r = r0 + 1 + i, row = ["=ENQUETEURS!A" + (2 + i), "=ENQUETEURS!C" + (2 + i)];
    codes.forEach(function (c) { row.push("=COUNTIFS(" + ENQ + ",$A" + r + "," + CIB + "," + c + "," + V + ")"); });
    row.push("=SUM(C" + r + ":" + lettreColonne_(2 + nC) + r + ")");
    return row;
  });
  if (re.length) sh.getRange(r0 + 1, 1, re.length, he.length).setValues(re);
  const plq = [5, 8, 11].map(function (c) { return sh.getRange(4, c, nC, 1); });
  sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().setGradientMaxpoint("#6AA84F")
    .setGradientMidpointWithValue("#FFD966", SpreadsheetApp.InterpolationType.NUMBER, "0.5").setGradientMinpoint("#E06666").setRanges(plq).build()]);
  sh.setColumnWidth(2, 220); sh.setFrozenRows(3);
}

// =====================================================================
// 9. EXPORT SPSS (format identique a la V3 : scripts SPSS inchanges)
// =====================================================================
function exporterPourSPSS() {
  synchroniser_("EXPORT", null, true, false);          // garantit un masque complet et sans doublon avant l'export
  const ss = classeur_();
  const sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
  const cols = colonnesMasque_(), p0 = CONFIG.PREMIERE_LIGNE_DONNEES, n = sh.getLastRow() - p0 + 1;
  const iDate = cols.map(function (c) { return c.code; }).indexOf("DATEENQU"), iStat = cols.length - 1;
  let lignes = n > 0 ? sh.getRange(p0, 1, n, cols.length).getValues() : [];
  lignes = lignes.filter(function (l) { return l[0] && l[iStat] !== "REJETE"; }).map(function (l) {
    if (l[iDate] instanceof Date) l[iDate] = Utilities.formatDate(l[iDate], CONFIG.FUSEAU, "yyyy-MM-dd");
    if (l[iDate + 1] instanceof Date) l[iDate + 1] = Utilities.formatDate(l[iDate + 1], CONFIG.FUSEAU, "HH:mm");
    return l.map(function (x) { return typeof x === "string" ? x.replace(/[\r\n]+/g, " ") : x; });
  });
  let ex = ss.getSheetByName("EXPORT_SPSS");
  if (ex) ex.clear(); else ex = ss.insertSheet("EXPORT_SPSS", ss.getSheets().length);
  const donnees = [cols.map(function (c) { return c.code; })].concat(lignes);
  if (ex.getMaxColumns() < cols.length) ex.insertColumnsAfter(ex.getMaxColumns(), cols.length - ex.getMaxColumns());
  if (ex.getMaxRows() < donnees.length) ex.insertRowsAfter(ex.getMaxRows(), donnees.length - ex.getMaxRows());
  ex.getRange(1, 1, donnees.length, cols.length).setNumberFormat("@").setValues(donnees.map(function (l) {
    return l.map(function (x) { return x === null || x === undefined ? "" : String(x); });
  }));
  ss.setActiveSheet(ex);
  Logger.log(lignes.length + " fiche(s) exportée(s). Onglet EXPORT_SPSS > Fichier > Télécharger > .csv, renommer en EXPORT_SPSS.csv.");
}

// Export pour les tests hors Google (sans effet dans Apps Script)
if (typeof module !== "undefined") module.exports = { ITEMS: ITEMS, structurer_: structurer_, coderFiche_: coderFiche_,
  construireLigne_: construireLigne_, colonnesMasque_: colonnesMasque_, planSync_: planSync_, numSeq_: numSeq_, cle_: cle_, numeroQuestion_: numeroQuestion_, champIdent_: champIdent_ };
