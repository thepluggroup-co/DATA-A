/**
 * =====================================================================
 *  EDM ELECTRIQUE CAMEROUN - COLLECTE EN LIGNE + MASQUE CODIFIE TEMPS REEL
 *  Version 3 - questionnaire de reference : PDF « 03 » Q1 a Q42
 *             + quotas du cahier des charges « 02 » (500 fiches)
 * =====================================================================
 *
 *  >>> VOUS AVEZ DEJA LE FORMULAIRE ET LE CLASSEUR (V2) ? NE PAS relancer installer().
 *  -------------------------------------------------------------------------------
 *   1. Remplacer TOUT le code du projet Apps Script par ce fichier, enregistrer.
 *   2. Executer migrerV3_etape1()  (formulaire mis a jour SUR PLACE : memes liens,
 *      memes liens personnels, reponses deja recues conservees ; masque, tableau
 *      de bord, tri a plat, dictionnaire et contacts recalcules).
 *   3. Executer migrerV3_etape2()  (onglets de controle, cibles/quotas, croisements,
 *      liste des variables, export et syntaxe SPSS : uniquement ceux qui existent).
 *   4. Lire le journal d'execution : chaque question ajoutee / renommee y est listee.
 *
 *  CHANGEMENTS V2 -> V3
 *   - Q1  : + « Entreprises (PME, Industries…) », « Autre » supprime, codes 1 a 5
 *           alignes sur les 5 cibles du cahier des charges.
 *   - Q12 : + « Vectron » (code 3) ; Autre = 12.
 *   - Nouvelles questions Q19 a Q24 (definition haut/bas de gamme, origines
 *     associees, grille de prix Q23 = 3 variables, ecart de qualite).
 *   - Anciennes Q19 a Q36 renumerotees Q25 a Q42 : LES CODES VARIABLES NE CHANGENT PAS.
 *   - Quotas CIBLES = tableau du cahier des charges (200 / 200 / 100).
 *   - Nouveaux controles : INCOHERENCE_Q23 (prix haut de gamme < bas de gamme),
 *     INCOHERENCE_Q25_Q26 (qualite « quel que soit le prix » mais aucun surcout).
 *
 *  CE QUE FAIT CE SCRIPT
 *  ---------------------
 *  1. Cree UN formulaire Google (Q1 a Q42, dans l'ordre exact du PDF).
 *  2. Cree UN classeur Google Sheets contenant :
 *       - "Reponses au formulaire 1" : flux brut Google (NE JAMAIS MODIFIER)
 *       - MASQUE_DEPOUILLEMENT : chaque fiche codifiee en chiffres, en temps reel
 *       - TABLEAU_DE_BORD      : suivi des 8 enqueteurs (J1/J2/J3, cumul, objectif,
 *                                alertes qualite), recap par zone + graphique
 *       - TRI_A_PLAT           : occurrences et % de chaque modalite, par ville, en direct
 *       - ENQUETEURS           : identifiants, zones, objectifs, LIEN PERSONNEL de chacun
 *       - PARAMETRES           : dates J1/J2/J3, objectif/jour, seuils d'alerte
 *       - DICTIONNAIRE         : livre de codes (variable / code / modalite)
 *  3. A chaque soumission : codification, numero de fiche unique, controles
 *     qualite, ajout de la ligne dans le masque (declencheur automatique).
 *  4. A la fin : exporterPourSPSS() produit le CSV code et
 *     genererSyntaxeSPSS() produit le fichier .sps (etiquettes, valeurs
 *     manquantes, niveaux de mesure, ensembles a reponses multiples).
 *
 *  INSTALLATION (une seule fois, ~5 minutes)
 *  -----------------------------------------
 *   1. https://script.google.com > Nouveau projet > coller TOUT ce fichier.
 *   2. Icone engrenage (Parametres du projet) > Fuseau horaire : "Africa/Douala".
 *   3. Choisir la fonction "installer" > Executer > autoriser le compte Google.
 *   4. Journal d'execution : liens du formulaire et du classeur.
 *   5. Dans le classeur, onglet PARAMETRES : saisir les dates J1, J2, J3
 *      et, onglet ENQUETEURS, les noms des enqueteurs.
 *   6. Envoyer a chaque enqueteur SON lien personnel (onglet ENQUETEURS,
 *      colonne LIEN_PERSONNEL) : identifiant et ville y sont pre-remplis.
 *
 *  FONCTIONS UTILES ENSUITE (a lancer depuis l'editeur)
 *  -----------------------------------------------------
 *   - exporterPourSPSS()     -> onglet EXPORT_SPSS (fiches REJETE exclues), a telecharger en .csv
 *   - genererSyntaxeSPSS()   -> onglet SYNTAXE_SPSS (a copier dans SPSS) ; le .sps est aussi fourni
 *   - reconstruireMasque()   -> recode TOUTES les reponses depuis le flux brut
 *                               (en cas de panne du declencheur ; conserve les REJETE)
 *
 *  CONTROLE QUALITE PAR LE SUPERVISEUR
 *  -----------------------------------
 *   Colonne STATUTQC du masque : "OK" ou "A_VERIFIER" (automatique).
 *   Le superviseur peut ecrire "REJETE" : la fiche sort du tableau de bord,
 *   du tri a plat et de l'export SPSS.
 */

// =====================================================================
// 1. PARAMETRES GENERAUX
// =====================================================================
const CONFIG = {
  TITRE_FORM: "Enquête - Distribution du matériel & équipements électriques au Cameroun",
  NOM_CLASSEUR: "EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL",
  FUSEAU: "Africa/Douala",
  OBJECTIF_JOUR: 25,
  NB_JOURS: 3,
  SEUIL_DELAI_MIN: 6,      // < 6 min entre 2 fiches du meme enqueteur = alerte
  SEUIL_VOLUME_JOUR: 30,   // > 30 fiches/jour pour un enqueteur = volume suspect
  CODE_NA: 97, CODE_NSP: 98, CODE_NR: 99,
  PREMIERE_LIGNE_DONNEES: 4 // lignes 1-3 = en-tetes du masque
};

const ZONES = [
  { code: 1, id: "DOUALA",    libelle: "Douala",    prefixe: "DLA" },
  { code: 2, id: "YAOUNDE",   libelle: "Yaoundé",   prefixe: "YDE" },
  { code: 3, id: "BAFOUSSAM", libelle: "Bafoussam", prefixe: "BAF" }
];

// 8 enqueteurs : 3 Douala, 3 Yaounde, 2 Bafoussam (modifiable ensuite
// directement dans l'onglet ENQUETEURS du classeur)
const ENQUETEURS_INIT = [
  ["ENQ1", "DOUALA"], ["ENQ2", "DOUALA"], ["ENQ3", "DOUALA"],
  ["ENQ4", "YAOUNDE"], ["ENQ5", "YAOUNDE"], ["ENQ6", "YAOUNDE"],
  ["ENQ7", "BAFOUSSAM"], ["ENQ8", "BAFOUSSAM"]
];

const TITRE_ENQ = "Identifiant enquêteur";
const TITRE_SITE_ANCIEN = "Site / quartier de l'enquête";   // titre d'origine (renomme)
const TITRE_QUARTIER = "Quartier / zone (ex. Makepe)";
const TITRE_SITE = "Site précis / repère (ex. Makepe Saint-Tropez)";
const TITRE_NOM = "Nom de l'enquêté ou raison sociale";
const TITRE_TEL = "Téléphone de l'enquêté";
const TITRE_MAIL = "E-mail de l'enquêté (facultatif)";
const TITRE_ACCORD = "L'enquêté accepte d'être recontacté à des fins commerciales";

// =====================================================================
// 2. DICTIONNAIRE UNIQUE (source de verite : formulaire, masque, SPSS)
//    Ordre = ordre exact du questionnaire PDF.
//    type : radio (choix unique) | multi (plusieurs reponses) | grille (une
//           reponse par ligne, 1 variable par ligne) | text
//    ancien : titre V2 (sert a retrouver la question dans le formulaire existant)
//    alias  : anciens libelles de modalites encore acceptes au codage
//    mesure : NOMINAL | ORDINAL (niveau de mesure SPSS)
// =====================================================================
const ITEMS = [
  // ---------- 1. Profil du repondant ----------
  { code: "VOUSETES", section: "1. Profil du répondant", q: "Q1. Vous êtes", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Particulier"], [2, "Entreprises (PME, Industries…)"], [3, "Électricien/artisan"], [4, "Entreprise BTP"],
            [5, "Revendeur/Grossiste/Distributeur"]],
    alias: { "Revendeur/grossiste": 5 } },                                   // libelle V2 (fiches tests)
  { code: "SEXMAFEM", section: "1. Profil du répondant", q: "Q2. Genre", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Homme"], [2, "Femme"]] },
  { code: "AGEREPON", section: "1. Profil du répondant", q: "Q3. Âge", type: "radio", mesure: "ORDINAL",
    choix: [[1, "<25"], [2, "25–34"], [3, "35–44"], [4, "45–54"], [5, "55+"]] },
  { code: "VILLEREG", section: "1. Profil du répondant", q: "Q4. Ville / région", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Douala"], [2, "Yaoundé"], [3, "Bafoussam"]] },
  { code: "REVMENME", section: "1. Profil du répondant", q: "Q5. Revenu mensuel du ménage (FCFA)", type: "radio", mesure: "ORDINAL",
    choix: [[1, "<100k"], [2, "100k–250k"], [3, "250k–500k"], [4, "500k–1M"], [5, ">1M"], [98, "NSP"]] },

  // ---------- 2. Habitudes d'achat ----------
  { code: "FREQACHA", section: "2. Habitudes d'achat", q: "Q6. Fréquence d'achat", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Chaque semaine"], [2, "1–3×/mois"], [3, "Quelques fois/an"], [4, "Rarement"]] },
  { code: "LIEACHPR", section: "2. Habitudes d'achat", q: "Q7. Lieu d'achat principal", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Quincaillerie"], [2, "Grossiste spécialisé"], [3, "Magasin spécialisé"], [4, "Marché"], [5, "Importateur"], [6, "En ligne"]] },
  { code: "MONMOYAC", section: "2. Habitudes d'achat", q: "Q8. Montant moyen par achat (FCFA)", type: "radio", mesure: "ORDINAL",
    choix: [[1, "<25k"], [2, "25k–100k"], [3, "100k–500k"], [4, "500k–2M"], [5, ">2M"]] },
  { code: "PRODACHE", section: "2. Habitudes d'achat", q: "Q9. Produits achetés (plusieurs réponses)", type: "multi",
    sousItems: [["PRACCABL", "Câbles/fils"], ["PRACAPPA", "Appareillage/disjoncteurs"], ["PRACPRIS", "Prises/interrupteurs"],
                ["PRACLUMI", "Luminaires"], ["PRACSOLA", "Solaire/onduleurs"], ["PRACGROU", "Groupes électrogènes"]] },
  { code: "PAIEPRIV", section: "2. Habitudes d'achat", q: "Q10. Paiement privilégié", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Espèces"], [2, "Mobile Money"], [3, "Virement"], [4, "Crédit fournisseur"]] },

  // ---------- 3. Marques ----------
  { code: "IMPOMARQ", section: "3. Marques", q: "Q11. Importance de la marque", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Très importante"], [2, "Importante"], [3, "Peu importante"], [4, "Pas importante"]] },
  { code: "MAACPLSO", section: "3. Marques", q: "Q12. Marque achetée le plus souvent", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Schneider"], [2, "Legrand"], [3, "Vectron"], [4, "Hager"], [5, "ABB"], [6, "Siemens"], [7, "Chint/chinoise"],
            [8, "Philips"], [9, "JA Solar"], [10, "Longi"], [11, "Growatt"]],
    autre: { code: 12, libelle: "Autre", variable: "MAACAUTR" } },
  { code: "PRCRICHO", section: "3. Marques", q: "Q13. Principal critère de choix", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Prix"], [2, "Qualité/durabilité"], [3, "Disponibilité"], [4, "Notoriété"], [5, "Garantie/SAV"], [6, "Conformité normes"]] },

  // ---------- 4. Origine des produits ----------
  { code: "ORIGPRIV", section: "4. Origine des produits", q: "Q14. Origine privilégiée", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [4, "Aucune préférence"]] },
  { code: "MEQUAFIA", section: "4. Origine des produits", q: "Q15. Meilleure qualité/fiabilité selon vous", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [98, "Sans avis"]] },
  { code: "MEILPRIX", section: "4. Origine des produits", q: "Q16. Meilleur prix selon vous", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [98, "Sans avis"]] },
  { code: "ORINFACH", section: "4. Origine des produits", q: "Q17. L'origine influence votre achat", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Fortement"], [2, "Modérément"], [3, "Faiblement"], [4, "Pas du tout"]] },

  // ---------- 5. Gammes (bloc enrichi en V3 : Q19 a Q24 nouvelles) ----------
  { code: "GAACPLSO", section: "5. Gammes", q: "Q18. Gamme achetée le plus souvent", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Haut de gamme"], [2, "Moyenne gamme"], [3, "Bas de gamme"], [4, "Selon le projet"]] },
  { code: "DEAVHAGA", section: "5. Gammes", q: "Q19. Pour vous, ce qui définit AVANT TOUT un produit HAUT DE GAMME", type: "radio", mesure: "NOMINAL",
    aide: "Une seule réponse.",
    choix: [[1, "Un prix élevé"], [2, "Une marque reconnue"], [3, "La durabilité / fiabilité"], [4, "L'origine (Europe, Asie, etc.)"],
            [5, "Les certifications / conformité aux normes"], [6, "Une garantie longue"]] },
  { code: "CAAVBAGA", section: "5. Gammes", q: "Q20. Pour vous, ce qui caractérise AVANT TOUT un produit BAS DE GAMME", type: "radio", mesure: "NOMINAL",
    aide: "Une seule réponse.",
    choix: [[1, "Un prix bas"], [2, "Une origine asiatique générique"], [3, "L'absence de marque connue"], [4, "Une durée de vie courte"],
            [5, "L'absence de garantie"], [6, "Un risque de non-conformité"]] },
  { code: "ORASHAGA", section: "5. Gammes", q: "Q21. À quelle origine associez-vous spontanément le HAUT DE GAMME ?", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [98, "Sans avis"]] },
  { code: "ORASBAGA", section: "5. Gammes", q: "Q22. À quelle origine associez-vous spontanément le BAS DE GAMME ?", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Europe"], [2, "Asie"], [3, "Amérique"], [98, "Sans avis"]] },
  { code: "FOPRGAMM", section: "5. Gammes", q: "Q23. Pour un article courant (ex. disjoncteur), à quelle fourchette de prix associez-vous chaque gamme ?", type: "grille",
    mesure: "ORDINAL", aide: "Cochez une case par ligne.",
    lignes: [["PXHAUTGA", "Haut de gamme"], ["PXMOYEGA", "Moyenne gamme"], ["PXBASGAM", "Bas de gamme"]],
    choix: [[1, "< 5 000 FCFA"], [2, "5 000 – 15 000"], [3, "15 000 – 40 000"], [4, "> 40 000 FCFA"]] },
  { code: "ECQUHABA", section: "5. Gammes", q: "Q24. Selon vous, l'écart de qualité entre le haut et le bas de gamme est", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Très important"], [2, "Important"], [3, "Modéré"], [4, "Faible"], [5, "Inexistant"]] },
  { code: "PRIOPRIN", section: "5. Gammes", q: "Q25. Priorité principale", ancien: "Q19. Priorité principale", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Le moins cher"], [2, "Meilleur rapport qualité/prix"], [3, "Meilleure qualité quel que soit le prix"]] },
  { code: "SUACMOGA", section: "5. Gammes", q: "Q26. Surcoût accepté pour monter en gamme", ancien: "Q20. Surcoût accepté pour monter en gamme",
    type: "radio", mesure: "ORDINAL",
    choix: [[1, "Aucun"], [2, "Jusqu'à +10 %"], [3, "+10–25 %"], [4, "+25–50 %"], [5, ">+50 %"]] },

  // ---------- 6. Freins a l'achat ----------
  { code: "PRINFREI", section: "6. Freins à l'achat", q: "Q27. Principal frein", ancien: "Q21. Principal frein", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Prix élevé"], [2, "Doute qualité/contrefaçon"], [3, "Indisponibilité"], [4, "Manque de conseil"],
            [5, "Absence de garantie"], [6, "Délais de livraison"]] },
  { code: "CRACPRCO", section: "6. Freins à l'achat", q: "Q28. Crainte d'acheter un produit contrefait/non conforme",
    ancien: "Q22. Crainte d'acheter un produit contrefait/non conforme", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Souvent"], [2, "Parfois"], [3, "Rarement"], [4, "Jamais"]] },
  { code: "DEJDECAC", section: "6. Freins à l'achat", q: "Q29. Déjà déçu par un achat", ancien: "Q23. Déjà déçu par un achat", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Oui, plusieurs fois"], [2, "Oui, une fois"], [3, "Non"]] },

  // ---------- 7. Service client & SAV ----------
  { code: "IMSECSAV", section: "7. Service client & SAV", q: "Q30. Importance du service client et du SAV",
    ancien: "Q24. Importance du service client et du SAV", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Très importante"], [2, "Importante"], [3, "Peu importante"], [4, "Pas importante"]] },
  { code: "SEATPRIO", section: "7. Service client & SAV", q: "Q31. Service attendu en priorité", ancien: "Q25. Service attendu en priorité",
    type: "radio", mesure: "NOMINAL",
    choix: [[1, "Garantie/remplacement"], [2, "Conseil technique"], [3, "Réparation/pièces"], [4, "Réactivité du contact"], [5, "Livraison/installation"]] },
  { code: "DUGAJUAC", section: "7. Service client & SAV", q: "Q32. Durée de garantie jugée acceptable", ancien: "Q26. Durée de garantie jugée acceptable",
    type: "radio", mesure: "ORDINAL",
    choix: [[1, "<6 mois"], [2, "6 mois–1 an"], [3, "1–2 ans"], [4, ">2 ans"]] },
  { code: "CACOPREF", section: "7. Service client & SAV", q: "Q33. Canal de contact préféré", ancien: "Q27. Canal de contact préféré",
    type: "radio", mesure: "NOMINAL",
    choix: [[1, "En personne"], [2, "Téléphone"], [3, "WhatsApp"], [4, "E-mail"], [5, "Réseaux sociaux"]] },
  { code: "BOSAPACH", section: "7. Service client & SAV", q: "Q34. Un bon SAV/service vous ferait payer plus cher",
    ancien: "Q28. Un bon SAV/service vous ferait payer plus cher", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Oui"], [2, "Peut-être"], [3, "Non"]] },

  // ---------- 8. Canaux & achat en ligne ----------
  { code: "CANAPREF", section: "8. Canaux & achat en ligne", q: "Q35. Canal préféré", ancien: "Q29. Canal préféré", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Quincaillerie"], [2, "Grossiste spécialisé"], [3, "Magasin spécialisé"], [4, "Marché"], [5, "Importateur"], [6, "En ligne"]] },
  { code: "CRCHCANA", section: "8. Canaux & achat en ligne", q: "Q36. Critère de choix du canal", ancien: "Q30. Critère de choix du canal",
    type: "radio", mesure: "NOMINAL",
    choix: [[1, "Proximité"], [2, "Prix"], [3, "Largeur du choix"], [4, "Disponibilité"], [5, "Conseil"], [6, "Confiance"]] },
  { code: "DEJACHLI", section: "8. Canaux & achat en ligne", q: "Q37. Déjà acheté en ligne", ancien: "Q31. Déjà acheté en ligne", type: "radio", mesure: "NOMINAL",
    choix: [[1, "Oui"], [2, "Non"]] },
  { code: "PRETACLI", section: "8. Canaux & achat en ligne", q: "Q38. Prêt à acheter en ligne", ancien: "Q32. Prêt à acheter en ligne", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Oui"], [2, "Peut-être"], [3, "Non"]] },
  { code: "PRFRACLI", section: "8. Canaux & achat en ligne", q: "Q39. Principal frein à l'achat en ligne", ancien: "Q33. Principal frein à l'achat en ligne",
    type: "radio", mesure: "NOMINAL",
    choix: [[1, "Qualité/conformité"], [2, "Ne pas voir le produit"], [3, "Confiance paiement"], [4, "Livraison"], [5, "Absence de SAV"]] },

  // ---------- 9. Fidelisation ----------
  { code: "FIMEFOUR", section: "9. Fidélisation", q: "Q40. Fidèle à un même fournisseur", ancien: "Q34. Fidèle à un même fournisseur", type: "radio", mesure: "ORDINAL",
    choix: [[1, "Toujours"], [2, "Souvent"], [3, "Parfois"], [4, "Rarement"], [5, "Jamais"]] },
  { code: "RENFFIDE", section: "9. Fidélisation", q: "Q41. Ce qui renforcerait votre fidélité (plusieurs réponses)",
    ancien: "Q35. Ce qui renforcerait votre fidélité (plusieurs réponses)", type: "multi",
    sousItems: [["RFIDPRIX", "Prix/promotions"], ["RFIDQUAL", "Qualité constante"], ["RFIDSTOC", "Disponibilité du stock"],
                ["RFIDCONS", "Bon conseil"], ["RFIDSAVF", "SAV fiable"], ["RFIDPROG", "Programme de fidélité"], ["RFIDPAIE", "Facilités de paiement"]] },
  { code: "SUGGATTE", section: "9. Fidélisation", q: "Q42. Une suggestion / attente (facultatif)", ancien: "Q36. Une suggestion / attente (facultatif)", type: "text" }
];

// Variables administratives (debut du masque) et de controle (fin du masque)
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

// =====================================================================
// 3. FONCTIONS "PURES" (aucun service Google) : codification + SPSS
// =====================================================================
function norm_(s) {
  return String(s === null || s === undefined ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Titre de la question (tel qu'affiche dans le formulaire) a partir de son code variable. */
function titre_(code) {
  const it = ITEMS.filter(function (x) { return x.code === code; })[0];
  return it ? it.q : code;
}

/** Liste ordonnee des colonnes du masque : [{section, code, label, spss, mesure, valeurs}] */
function colonnesMasque_() {
  const cols = [];
  VARS_ADMIN.forEach(function (v) { cols.push(Object.assign({ section: "Administratif" }, v)); });
  ITEMS.forEach(function (it) {
    if (it.type === "radio") {
      const valeurs = it.choix.slice();
      if (it.autre) valeurs.push([it.autre.code, it.autre.libelle]);
      valeurs.push([CONFIG.CODE_NR, "Non-réponse"]);
      cols.push({ section: it.section, code: it.code, label: it.q, spss: "F2.0", mesure: it.mesure, valeurs: valeurs });
      if (it.autre) {
        cols.push({ section: it.section, code: it.autre.variable, label: it.q + " - Autre (précisez)", spss: "A80" });
      }
    } else if (it.type === "multi") {
      it.sousItems.forEach(function (si) {
        cols.push({ section: it.section, code: si[0], label: it.q.replace(/\s*\(plusieurs réponses\)/, "") + " - " + si[1],
          spss: "F2.0", mesure: "NOMINAL", valeurs: [[1, "Cité"], [0, "Non cité"], [CONFIG.CODE_NR, "Non-réponse"]], groupe: it.code });
      });
    } else if (it.type === "grille") {
      it.lignes.forEach(function (li) {
        const valeurs = it.choix.slice();
        valeurs.push([CONFIG.CODE_NR, "Non-réponse"]);
        cols.push({ section: it.section, code: li[0], label: it.q.replace(/\s*\?$/, "") + " - " + li[1], spss: "F2.0",
          mesure: it.mesure, valeurs: valeurs, grille: it.code, ligne: li[1] });
      });
    } else {
      cols.push({ section: it.section, code: it.code, label: it.q, spss: "A500" });
    }
  });
  VARS_CONTROLE.forEach(function (v) { cols.push(Object.assign({ section: "Contrôle qualité" }, v)); });
  return cols;
}

/**
 * Codifie une fiche.
 * @param {Object} reponses  { titreQuestion: reponse }  (reponse = texte ou tableau de textes)
 * @return {{valeurs:Object, anomalies:string[]}}
 */
function coderFiche_(reponses) {
  const parTitre = {};
  Object.keys(reponses).forEach(function (t) { parTitre[norm_(t)] = reponses[t]; });
  const valeurs = {};
  const anomalies = [];

  ITEMS.forEach(function (it) {
    const brut = parTitre[norm_(it.q)];
    const absent = brut === undefined || brut === null || brut === "" || (Array.isArray(brut) && brut.length === 0);

    if (it.type === "radio") {
      if (it.autre) valeurs[it.autre.variable] = "";
      if (absent) { valeurs[it.code] = CONFIG.CODE_NR; return; }
      const r = norm_(brut);
      const trouve = it.choix.filter(function (c) { return norm_(c[1]) === r; })[0];
      if (trouve) { valeurs[it.code] = trouve[0]; return; }
      if (it.alias) {                       // ancien libelle (formulaire V2)
        const k = Object.keys(it.alias).filter(function (a) { return norm_(a) === r; })[0];
        if (k) { valeurs[it.code] = it.alias[k]; return; }
      }
      if (it.autre) {                       // option "Autre : ..." de Google Forms
        valeurs[it.code] = it.autre.code;
        valeurs[it.autre.variable] = r;
        return;
      }
      valeurs[it.code] = CONFIG.CODE_NR;
      anomalies.push("CODE_INCONNU:" + it.code);
    } else if (it.type === "multi") {
      if (absent) {
        it.sousItems.forEach(function (si) { valeurs[si[0]] = CONFIG.CODE_NR; });
        return;
      }
      const coches = (Array.isArray(brut) ? brut : [brut]).map(norm_);
      it.sousItems.forEach(function (si) { valeurs[si[0]] = coches.indexOf(norm_(si[1])) >= 0 ? 1 : 0; });
      const connus = it.sousItems.map(function (si) { return norm_(si[1]); });
      if (coches.some(function (c) { return connus.indexOf(c) < 0; })) anomalies.push("CODE_INCONNU:" + it.code);
    } else if (it.type === "grille") {       // Google renvoie un tableau : 1 reponse par ligne
      const rep = absent ? [] : (Array.isArray(brut) ? brut : [brut]);
      it.lignes.forEach(function (li, k) {
        const r = norm_(rep[k]);
        if (!r) { valeurs[li[0]] = CONFIG.CODE_NR; return; }
        const t = it.choix.filter(function (c) { return norm_(c[1]) === r; })[0];
        if (t) valeurs[li[0]] = t[0];
        else { valeurs[li[0]] = CONFIG.CODE_NR; anomalies.push("CODE_INCONNU:" + li[0]); }
      });
    } else {
      valeurs[it.code] = absent ? "" : norm_(brut);
    }
  });

  // Controle de coherence : canal prefere "En ligne" mais pas pret a acheter en ligne
  if (valeurs.CANAPREF === 6 && valeurs.PRETACLI === 3) anomalies.push("INCOHERENCE_Q35_Q38");
  // Lieu d'achat principal "En ligne" alors que jamais achete en ligne
  if (valeurs.LIEACHPR === 6 && valeurs.DEJACHLI === 2) anomalies.push("INCOHERENCE_Q7_Q37");
  // Q23 : prix associe au haut de gamme INFERIEUR a celui du bas de gamme = question mal comprise
  if (valeurs.PXHAUTGA < 97 && valeurs.PXBASGAM < 97 && valeurs.PXHAUTGA < valeurs.PXBASGAM) anomalies.push("INCOHERENCE_Q23");
  // Q25 « meilleure qualite quel que soit le prix » mais Q26 « aucun surcout accepte »
  if (valeurs.PRIOPRIN === 3 && valeurs.SUACMOGA === 1) anomalies.push("INCOHERENCE_Q25_Q26");

  return { valeurs: valeurs, anomalies: anomalies };
}

/**
 * Construit la ligne complete du masque pour une fiche.
 * @param {Object} fiche  {reponses, horodatage:Date, enqueteurs:{ENQ1:"DOUALA",...}, seuilDelai}
 * @param {Object} etat   {seq:{}, dernier:{}}  (compteurs par enqueteur, modifies ici)
 * @param {Function} fmt  (date, format) -> texte, dans le fuseau de l'enquete
 */
function construireLigne_(fiche, etat, fmt) {
  const code = coderFiche_(fiche.reponses);
  const v = code.valeurs;
  const anomalies = code.anomalies.slice();

  const enq = norm_(fiche.reponses[TITRE_ENQ]).toUpperCase();
  const zoneId = fiche.enqueteurs[enq];
  const zone = ZONES.filter(function (z) { return z.id === zoneId; })[0];
  if (!zone) anomalies.push("ENQUETEUR_INCONNU");

  // Numero de fiche unique : DLA-ENQ1-001
  etat.seq[enq] = (etat.seq[enq] || 0) + 1;
  v.NUMFICHE = (zone ? zone.prefixe : "XXX") + "-" + (enq || "SANSID") + "-" + String(etat.seq[enq]).padStart(3, "0");
  v.CODEENQU = enq;
  v.CODEZONE = zone ? zone.code : CONFIG.CODE_NR;
  const R = fiche.reponses;
  v.QUARTIER = norm_(R[TITRE_QUARTIER] !== undefined ? R[TITRE_QUARTIER] : R[TITRE_SITE_ANCIEN]);
  v.SITEENQU = norm_(R[TITRE_SITE]);
  const accord = norm_(R[TITRE_ACCORD]);
  v.ACCRECON = accord === "Oui" ? 1 : (accord === "Non" ? 2 : CONFIG.CODE_NR);
  const tel = norm_(R[TITRE_TEL]);
  const telCle = tel.replace(/\D/g, "").replace(/^237/, "");
  if (telCle && fiche.telsVus) {
    if (fiche.telsVus[telCle]) anomalies.push("TEL_DOUBLON");
    fiche.telsVus[telCle] = true;
  }

  const jour = fmt(fiche.horodatage, "yyyy-MM-dd");
  v.DATEENQU = jour;
  v.HEUREENQ = fmt(fiche.horodatage, "HH:mm");

  // Delai depuis la fiche precedente du meme enqueteur (meme jour)
  const prec = etat.dernier[enq];
  v.DELAIPRE = "";
  if (prec && fmt(new Date(prec), "yyyy-MM-dd") === jour) {
    v.DELAIPRE = Math.round((fiche.horodatage.getTime() - prec) / 60000);
    if (v.DELAIPRE < fiche.seuilDelai) anomalies.push("DELAI_COURT");
  }
  etat.dernier[enq] = fiche.horodatage.getTime();

  // Ville declaree (Q4) coherente avec la zone de l'enqueteur
  if (zone && v.VILLEREG !== CONFIG.CODE_NR && v.VILLEREG !== zone.code) anomalies.push("VILLE_DIFFERENTE_ZONE");

  v.ANOMALIE = anomalies.join(" | ");
  v.STATUTQC = anomalies.length ? "A_VERIFIER" : "OK";

  // Fiche contact (onglet CONTACTS, jamais exportee vers SPSS)
  const txt = function (x) { return Array.isArray(x) ? x.join(", ") : norm_(x); };
  fiche.contact = [v.NUMFICHE, jour, v.HEUREENQ, enq, zone ? zone.libelle : "", v.QUARTIER, v.SITEENQU,
    norm_(R[TITRE_NOM]), txt(R[titre_("VOUSETES")]), tel, norm_(R[TITRE_MAIL]), accord || "NR",
    txt(R[titre_("PRODACHE")]), txt(R[titre_("MAACPLSO")]),
    txt(R[titre_("MONMOYAC")]), txt(R[titre_("CACOPREF")]), v.STATUTQC];

  return colonnesMasque_().map(function (c) { return (c.code in v) ? v[c.code] : ""; });
}

function listeSpss_(mots, retrait) {
  const lignes = []; let cur = "";
  mots.forEach(function (m) {
    if ((cur + " " + m).length > 70) { lignes.push(cur); cur = m; } else { cur = cur ? cur + " " + m : m; }
  });
  if (cur) lignes.push(cur);
  return lignes.map(function (l) { return retrait + l; }).join("\n");
}

function spssTexte_(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

/** Genere la syntaxe SPSS complete (texte). */
function construireSyntaxeSPSS_(cheminCsv, cheminSav) {
  const cols = colonnesMasque_();
  const L = [];
  L.push("* Encoding: UTF-8.");
  L.push("* =====================================================================.");
  L.push("* EDM ELECTRIQUE CAMEROUN - Import et etiquetage de la base codee.");
  L.push("* Genere automatiquement depuis le dictionnaire du script (source unique).");
  L.push("* AVANT D'EXECUTER : remplacer les deux chemins de fichier ci-dessous.");
  L.push("* =====================================================================.");
  L.push("");
  L.push("SET DECIMAL=DOT.");
  L.push("");
  L.push("GET DATA");
  L.push("  /TYPE=TXT");
  L.push("  /FILE=" + spssTexte_(cheminCsv));
  L.push("  /ENCODING='UTF8'");
  L.push("  /DELCASE=LINE");
  L.push("  /DELIMITERS=\",\"");
  L.push("  /QUALIFIER='\"'");
  L.push("  /ARRANGEMENT=DELIMITED");
  L.push("  /FIRSTCASE=2");
  L.push("  /VARIABLES=");
  cols.forEach(function (c) { L.push("    " + c.code + " " + c.spss); });
  L.push(".");
  L.push("DATASET NAME EDM_ELEC WINDOW=FRONT.");
  L.push("");

  L.push("VARIABLE LABELS");
  L.push(cols.map(function (c) { return "  " + c.code + " " + spssTexte_(c.label); }).join("\n  /") + ".");
  L.push("");

  L.push("VALUE LABELS");
  const avecValeurs = cols.filter(function (c) { return c.valeurs; });
  L.push(avecValeurs.map(function (c) {
    return "  " + c.code + "\n" + c.valeurs.map(function (p) { return "    " + p[0] + " " + spssTexte_(p[1]); }).join("\n");
  }).join("\n  /") + ".");
  L.push("");

  const numeriques = cols.filter(function (c) { return /^F/.test(c.spss) && c.code !== "DELAIPRE"; });
  L.push("MISSING VALUES");
  L.push(listeSpss_(numeriques.map(function (c) { return c.code; }), "  "));
  L.push("  (" + CONFIG.CODE_NA + ", " + CONFIG.CODE_NSP + ", " + CONFIG.CODE_NR + ").");
  L.push("");

  ["NOMINAL", "ORDINAL", "SCALE"].forEach(function (niv) {
    const vs = cols.filter(function (c) { return c.mesure === niv; }).map(function (c) { return c.code; });
    if (vs.length) L.push("VARIABLE LEVEL\n" + listeSpss_(vs, "  ") + " (" + niv + ").");
  });
  L.push("");

  // Ensembles a reponses multiples (Q9, Q41)
  const groupes = ITEMS.filter(function (it) { return it.type === "multi"; });
  L.push("MRSETS");
  groupes.forEach(function (g) {
    L.push("  /MDGROUP NAME=$" + g.code + " LABEL=" + spssTexte_(g.q));
    L.push("    CATEGORYLABELS=VARLABELS VALUE=1 VARIABLES=");
    L.push(listeSpss_(g.sousItems.map(function (s) { return s[0]; }), "    "));
  });
  L.push("  /DISPLAY NAME=[" + groupes.map(function (g) { return "$" + g.code; }).join(" ") + "].");
  L.push("");
  L.push("SAVE OUTFILE=" + spssTexte_(cheminSav) + ".");
  L.push("");
  L.push("* ---------------------------------------------------------------------.");
  L.push("* PREMIERES ANALYSES (a adapter).");
  L.push("* ---------------------------------------------------------------------.");
  const radios = [].concat.apply([], ITEMS.map(function (it) {
    return it.type === "radio" ? [it.code] : it.type === "grille" ? it.lignes.map(function (l) { return l[0]; }) : [];
  }));
  L.push("FREQUENCIES VARIABLES=\n" + listeSpss_(["CODEZONE"].concat(radios), "  ") + "\n  /ORDER=ANALYSIS.");
  L.push("");
  L.push("CROSSTABS /TABLES=VOUSETES MAACPLSO ORIGPRIV GAACPLSO PRINFREI CANAPREF BY CODEZONE");
  L.push("  /CELLS=COUNT COLUMN /STATISTICS=CHISQ.");
  L.push("");
  groupes.forEach(function (g) {
    const nomMr = g.code;                  // MULT RESPONSE : nom de groupe SANS "$" (syntaxe IBM)
    L.push("MULT RESPONSE GROUPS=" + nomMr + " " + spssTexte_(g.q.replace(/\s*\(plusieurs réponses\)/, "").substr(0, 40)) +
      " (" + g.sousItems[0][0] + " TO " + g.sousItems[g.sousItems.length - 1][0] + " (1))");
    L.push("  /VARIABLES=CODEZONE(1,3)");
    L.push("  /FREQUENCIES=" + nomMr);
    L.push("  /TABLES=" + nomMr + " BY CODEZONE");
    L.push("  /CELLS=ROW COLUMN /BASE=CASES.");
    L.push("");
  });
  return L.join("\n") + "\n";
}

/** Transforme des lignes du masque en CSV pour SPSS (en-tete = codes). */
function construireCsv_(entete, lignes) {
  function champ(x) {
    const s = String(x === null || x === undefined ? "" : x).replace(/[\r\n]+/g, " ");
    return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  return [entete].concat(lignes).map(function (l) { return l.map(champ).join(","); }).join("\n") + "\n";
}

function lettreColonne_(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// =====================================================================
// 4. INSTALLATION
// =====================================================================
function installer() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("SHEET_ID")) {
    throw new Error("Déjà installé. Classeur : " + SpreadsheetApp.openById(props.getProperty("SHEET_ID")).getUrl() +
      " — pour réinstaller, supprimez les propriétés du script (Paramètres du projet).");
  }
  if (Session.getScriptTimeZone() !== CONFIG.FUSEAU) {
    Logger.log("ATTENTION : fuseau du projet = " + Session.getScriptTimeZone() + ". Réglez-le sur " + CONFIG.FUSEAU + ".");
  }

  // ---------- Formulaire ----------
  const form = FormApp.create(CONFIG.TITRE_FORM);
  form.setDescription(
    "Consigne enquêteur : cochez la case correspondante. Une seule réponse sauf mention « plusieurs réponses ». " +
    "Ne pas orienter les réponses. Durée estimée : ~15 min.\n" +
    "Utilisez UNIQUEMENT votre lien personnel (identifiant et ville déjà remplis).");
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(true);
  form.setProgressBar(false);
  form.setConfirmationMessage("Fiche enregistrée. Touchez « Envoyer une autre réponse » pour la fiche suivante.");

  const itemEnq = form.addListItem().setTitle(TITRE_ENQ).setRequired(true)
    .setChoiceValues(ENQUETEURS_INIT.map(function (e) { return e[0]; }));
  ajouterQuestionsIdentification_(form, form.getItems().length);

  let section = null;
  let itemVille = null;
  ITEMS.forEach(function (it) {
    if (it.section !== section) { form.addSectionHeaderItem().setTitle(it.section); section = it.section; }
    const x = appliquerItem_(form, it, null).item;
    if (it.code === "VILLEREG") itemVille = x;
  });

  // ---------- Classeur ----------
  const ss = SpreadsheetApp.create(CONFIG.NOM_CLASSEUR);
  ss.setSpreadsheetTimeZone(CONFIG.FUSEAU);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  const shParam = creerParametres_(ss);
  const shEnq = creerEnqueteurs_(ss, form, itemEnq, itemVille);
  const shMasque = creerMasque_(ss);
  creerTableauDeBord_(ss, shMasque);
  creerTriAPlat_(ss, shMasque);
  creerDictionnaire_(ss);

  // Supprime l'onglet vide par defaut
  ss.getSheets().forEach(function (s) {
    if (/^(Feuille|Sheet)\s?1$/.test(s.getName()) && s.getLastRow() === 0) supprimerOnglet_(ss, s);
  });
  ss.setActiveSheet(ss.getSheetByName("TABLEAU_DE_BORD"));
  ss.moveActiveSheet(1);

  // ---------- Declencheur temps reel ----------
  ScriptApp.newTrigger("surSoumission").forForm(form).onFormSubmit().create();

  props.setProperties({ SHEET_ID: ss.getId(), FORM_ID: form.getId(), ETAT: JSON.stringify({ seq: {}, dernier: {} }) });

  Logger.log("Formulaire (édition)  : " + form.getEditUrl());
  Logger.log("Formulaire (réponse)  : " + form.getPublishedUrl());
  Logger.log("Classeur temps réel   : " + ss.getUrl());
  Logger.log("Liens personnels des enquêteurs : onglet ENQUETEURS, colonne LIEN_PERSONNEL.");
}

function styleEntete_(range) {
  range.setFontWeight("bold").setBackground("#1F4E78").setFontColor("#FFFFFF").setVerticalAlignment("middle");
}

function creerParametres_(ss) {
  const sh = ss.insertSheet("PARAMETRES", ss.getSheets().length);
  const lignes = [
    ["PARAMETRE", "VALEUR", "DESCRIPTION"],
    ["DATE_J1", "", "Date du 1er jour de terrain (à saisir, ex. 28/09/2026)"],
    ["DATE_J2", "", "Date du 2e jour de terrain"],
    ["DATE_J3", "", "Date du 3e jour de terrain"],
    ["OBJECTIF_JOUR", CONFIG.OBJECTIF_JOUR, "Fiches attendues par enquêteur et par jour"],
    ["NB_JOURS", CONFIG.NB_JOURS, "Nombre de jours de terrain"],
    ["SEUIL_DELAI_MIN", CONFIG.SEUIL_DELAI_MIN, "Alerte si moins de X minutes entre 2 fiches d'un même enquêteur"],
    ["SEUIL_VOLUME_JOUR", CONFIG.SEUIL_VOLUME_JOUR, "Alerte « volume suspect » si un enquêteur dépasse X fiches dans la journée"],
    ["CODE_NSP", CONFIG.CODE_NSP, "Ne sait pas / Sans avis (valeur manquante SPSS)"],
    ["CODE_NR", CONFIG.CODE_NR, "Non-réponse (valeur manquante SPSS)"]
  ];
  sh.getRange(1, 1, lignes.length, 3).setValues(lignes);
  styleEntete_(sh.getRange(1, 1, 1, 3));
  sh.getRange("B2:B4").setNumberFormat("dd/MM/yyyy").setBackground("#FFF2CC");
  const noms = { P_J1: "B2", P_J2: "B3", P_J3: "B4", P_OBJ_JOUR: "B5", P_NB_JOURS: "B6", P_SEUIL_DELAI: "B7", P_SEUIL_VOLUME: "B8" };
  Object.keys(noms).forEach(function (n) { ss.setNamedRange(n, sh.getRange(noms[n])); });
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 480);
  sh.setFrozenRows(1);
  return sh;
}

function creerEnqueteurs_(ss, form, itemEnq, itemVille) {
  const sh = ss.insertSheet("ENQUETEURS", ss.getSheets().length);
  const lignes = [["ENQ_ID", "NOM_ENQUETEUR", "ZONE", "OBJECTIF_TOTAL", "LIEN_PERSONNEL"]];
  ENQUETEURS_INIT.forEach(function (e) {
    const zone = ZONES.filter(function (z) { return z.id === e[1]; })[0];
    const url = form.createResponse()
      .withItemResponse(itemEnq.createResponse(e[0]))
      .withItemResponse(itemVille.createResponse(zone.libelle))
      .toPrefilledUrl();
    lignes.push([e[0], "", e[1], "=P_OBJ_JOUR*P_NB_JOURS", url]);
  });
  sh.getRange(1, 1, lignes.length, 5).setValues(lignes);
  styleEntete_(sh.getRange(1, 1, 1, 5));
  sh.getRange(2, 2, ENQUETEURS_INIT.length, 1).setBackground("#FFF2CC");
  sh.getRange(2, 3, ENQUETEURS_INIT.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ZONES.map(function (z) { return z.id; }), true).build());
  sh.setColumnWidth(2, 200); sh.setColumnWidth(5, 420);
  sh.setFrozenRows(1);
  return sh;
}

function creerMasque_(ss) {
  const sh = ss.insertSheet("MASQUE_DEPOUILLEMENT", ss.getSheets().length);
  const cols = colonnesMasque_();
  if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
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
  sh.setFrozenRows(3);
  sh.setFrozenColumns(2);
  const colDate = cols.map(function (x) { return x.code; }).indexOf("DATEENQU") + 1;
  sh.getRange(CONFIG.PREMIERE_LIGNE_DONNEES, colDate, sh.getMaxRows() - 3, 1).setNumberFormat("dd/MM/yyyy");

  const colStatut = cols.length;
  const plage = sh.getRange(CONFIG.PREMIERE_LIGNE_DONNEES, 1, sh.getMaxRows() - 3, cols.length);
  const L = lettreColonne_(colStatut);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + L + "4=\"REJETE\"")
      .setBackground("#F4CCCC").setFontColor("#990000").setRanges([plage]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + L + "4=\"A_VERIFIER\"")
      .setBackground("#FFF2CC").setRanges([plage]).build()
  ]);
  sh.getRange(CONFIG.PREMIERE_LIGNE_DONNEES, colStatut, sh.getMaxRows() - 3, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["OK", "A_VERIFIER", "REJETE"], true).build());
  return sh;
}

/** Plages A1 du masque utilisees dans les formules (ex. MASQUE_DEPOUILLEMENT!$B$4:$B) */
function refMasque_(code) {
  const i = colonnesMasque_().map(function (c) { return c.code; }).indexOf(code) + 1;
  const L = lettreColonne_(i);
  return "MASQUE_DEPOUILLEMENT!$" + L + "$" + CONFIG.PREMIERE_LIGNE_DONNEES + ":$" + L;
}

function creerTableauDeBord_(ss, shMasque) {
  const sh = ss.insertSheet("TABLEAU_DE_BORD", ss.getSheets().length);
  const E = refMasque_("CODEENQU"), D = refMasque_("DATEENQU"), S = refMasque_("STATUTQC"), A = refMasque_("ANOMALIE");
  const V = S + ",\"<>REJETE\"";

  sh.getRange("A1").setValue("SUIVI TERRAIN EN TEMPS RÉEL — EDM Électrique Cameroun").setFontSize(14).setFontWeight("bold");
  sh.getRange("A2").setValue("Fiches REJETE exclues. Dates J1/J2/J3 et seuils : onglet PARAMETRES. Mise à jour automatique à chaque soumission.")
    .setFontStyle("italic").setFontColor("#666666");

  const entete = ["ENQ_ID", "NOM", "ZONE", "J1", "J2", "J3", "AUJOURD'HUI", "CUMUL", "OBJECTIF", "% RÉALISÉ",
                  "DÉLAIS COURTS", "À VÉRIFIER", "REJETÉES", "STATUT"];
  sh.getRange(4, 1, 1, entete.length).setValues([entete]);
  styleEntete_(sh.getRange(4, 1, 1, entete.length));

  const n = ENQUETEURS_INIT.length;
  const f = [];
  for (let i = 0; i < n; i++) {
    const r = 5 + i, re = 2 + i;
    f.push([
      "=ENQUETEURS!A" + re, "=ENQUETEURS!B" + re, "=ENQUETEURS!C" + re,
      "=IF(P_J1=\"\",\"\",COUNTIFS(" + E + ",$A" + r + "," + D + ",P_J1," + V + "))",
      "=IF(P_J2=\"\",\"\",COUNTIFS(" + E + ",$A" + r + "," + D + ",P_J2," + V + "))",
      "=IF(P_J3=\"\",\"\",COUNTIFS(" + E + ",$A" + r + "," + D + ",P_J3," + V + "))",
      "=COUNTIFS(" + E + ",$A" + r + "," + D + ",TODAY()," + V + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + V + ")",
      "=ENQUETEURS!D" + re,
      "=IF(I" + r + "=0,0,H" + r + "/I" + r + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + A + ",\"*DELAI_COURT*\"," + V + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + S + ",\"A_VERIFIER\")",
      "=COUNTIFS(" + E + ",$A" + r + "," + S + ",\"REJETE\")",
      "=IF(G" + r + ">P_SEUIL_VOLUME,\"⚠ Volume suspect\",IF(H" + r + ">=I" + r + ",\"✔ Objectif atteint\"," +
        "IF(K" + r + ">0,\"⚠ Délais courts\",\"En cours\")))"
    ]);
  }
  sh.getRange(5, 1, n, entete.length).setFormulas(f);
  const fin = 4 + n;
  sh.getRange(5, 10, n, 1).setNumberFormat("0%");

  // Recap par zone
  const z0 = fin + 3;
  sh.getRange(z0 - 1, 1).setValue("RÉCAPITULATIF PAR ZONE").setFontWeight("bold");
  sh.getRange(z0, 1, 1, 5).setValues([["ZONE", "ENQUÊTEURS", "CUMUL", "OBJECTIF", "% RÉALISÉ"]]);
  styleEntete_(sh.getRange(z0, 1, 1, 5));
  const zf = ZONES.map(function (z, i) {
    const r = z0 + 1 + i;
    return [z.id, "=COUNTIF($C$5:$C$" + fin + ",A" + r + ")", "=SUMIF($C$5:$C$" + fin + ",A" + r + ",$H$5:$H$" + fin + ")",
            "=SUMIF($C$5:$C$" + fin + ",A" + r + ",$I$5:$I$" + fin + ")", "=IF(D" + r + "=0,0,C" + r + "/D" + r + ")"];
  });
  const rt = z0 + 1 + ZONES.length;
  zf.push(["TOTAL", "=SUM(B" + (z0 + 1) + ":B" + (rt - 1) + ")", "=SUM(C" + (z0 + 1) + ":C" + (rt - 1) + ")",
           "=SUM(D" + (z0 + 1) + ":D" + (rt - 1) + ")", "=IF(D" + rt + "=0,0,C" + rt + "/D" + rt + ")"]);
  sh.getRange(z0 + 1, 1, zf.length, 5).setValues(zf);
  sh.getRange(rt, 1, 1, 5).setFontWeight("bold");
  sh.getRange(z0 + 1, 5, zf.length, 1).setNumberFormat("0%");

  // Mise en forme conditionnelle du statut
  const plStatut = sh.getRange(5, 14, n, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("⚠").setBackground("#F4CCCC").setRanges([plStatut]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("✔").setBackground("#D9EAD3").setRanges([plStatut]).build(),
    SpreadsheetApp.newConditionalFormatRule().setGradientMaxpoint("#6AA84F").setGradientMidpointWithValue("#FFD966",
      SpreadsheetApp.InterpolationType.NUMBER, "0.5").setGradientMinpoint("#E06666")
      .setRanges([sh.getRange(5, 10, n, 1)]).build()
  ]);

  // Graphique cumul vs objectif
  const chart = sh.newChart().setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange(4, 1, n + 1, 1)).addRange(sh.getRange(4, 8, n + 1, 2))
    .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_COLUMNS).setNumHeaders(1)
    .setOption("title", "Cumul vs objectif par enquêteur")
    .setPosition(rt + 3, 1, 0, 0).build();
  sh.insertChart(chart);

  sh.setFrozenRows(4);
  sh.setColumnWidth(2, 180); sh.setColumnWidth(14, 160);
}

function creerTriAPlat_(ss, shMasque) {
  const sh = ss.insertSheet("TRI_A_PLAT", ss.getSheets().length);
  const Z = refMasque_("CODEZONE"), S = refMasque_("STATUTQC"), E = refMasque_("CODEENQU");
  const V = S + ",\"<>REJETE\"";
  const lignes = [];
  lignes.push(["TRI À PLAT EN TEMPS RÉEL (fiches REJETE exclues)", "", "", "", "", "", ""]);
  lignes.push(["Base : fiches valides", "=COUNTIFS(" + E + ",\"<>\"," + V + ")", "", "", "", "", ""]);
  lignes.push(["", "", "", "", "", "", ""]);
  const debutEntetes = [];

  colonnesMasque_().filter(function (c) { return c.valeurs && c.code !== "CODEZONE"; }).forEach(function (c) {
    const X = refMasque_(c.code);
    debutEntetes.push(lignes.length + 1);
    lignes.push([c.code + " — " + c.label, "", "", "", "", "", ""]);
    lignes.push(["Code", "Modalité"].concat(ZONES.map(function (z) { return z.libelle; })).concat(["Total", "% base"]));
    const vals = c.groupe ? c.valeurs.filter(function (p) { return p[0] === 1; }) : c.valeurs;
    vals.forEach(function (p) {
      const r = lignes.length + 1;
      const parZone = ZONES.map(function (z) { return "=COUNTIFS(" + X + "," + p[0] + "," + Z + "," + z.code + "," + V + ")"; });
      lignes.push([p[0], p[1]].concat(parZone).concat(["=COUNTIFS(" + X + "," + p[0] + "," + V + ")", "=IF($B$2=0,0,F" + r + "/$B$2)"]));
    });
    lignes.push(["", "", "", "", "", "", ""]);
  });

  sh.getRange(1, 1, lignes.length, 7).setValues(lignes);
  sh.getRange("A1").setFontSize(13).setFontWeight("bold");
  sh.getRange("A2:B2").setFontWeight("bold");
  sh.getRange(1, 7, lignes.length, 1).setNumberFormat("0.0%");
  debutEntetes.forEach(function (r) {
    sh.getRange(r, 1, 1, 7).merge().setFontWeight("bold").setBackground("#D9E1F2");
    styleEntete_(sh.getRange(r + 1, 1, 1, 7));
  });
  sh.setColumnWidth(1, 70); sh.setColumnWidth(2, 260);
}

function creerDictionnaire_(ss) {
  const sh = ss.insertSheet("DICTIONNAIRE", ss.getSheets().length);
  const lignes = [["VARIABLE", "QUESTION / LIBELLÉ", "FORMAT SPSS", "MESURE", "CODE", "MODALITÉ"]];
  colonnesMasque_().forEach(function (c) {
    if (c.valeurs) c.valeurs.forEach(function (p, i) {
      lignes.push([i === 0 ? c.code : "", i === 0 ? c.label : "", i === 0 ? c.spss : "", i === 0 ? (c.mesure || "") : "", p[0], p[1]]);
    });
    else lignes.push([c.code, c.label, c.spss, c.mesure || "", "", "(texte / valeur libre)"]);
  });
  sh.getRange(1, 1, lignes.length, 6).setValues(lignes);
  styleEntete_(sh.getRange(1, 1, 1, 6));
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 380); sh.setColumnWidth(6, 260);
}


// ---------------------------------------------------------------------
// Identifiant du classeur de reponses (utilise si ce projet de script
// n'est pas celui qui a lance installer()).
// ---------------------------------------------------------------------
const CLASSEUR_ID = "1dq6pSndBUvC92UHaQw3N3s33iP-Hggp8nGLZgM0CT8I";

/** Ouvre le classeur ; au besoin, relie ce projet au classeur et au formulaire. */
function contexte_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SHEET_ID");
  if (!id) {
    id = CLASSEUR_ID;
    const ss0 = SpreadsheetApp.openById(id);
    const url = ss0.getFormUrl();
    if (!url) throw new Error("Ce classeur n'est relié à aucun formulaire.");
    const form = FormApp.openByUrl(url);
    props.setProperties({ SHEET_ID: id, FORM_ID: form.getId() });
    if (!props.getProperty("ETAT")) props.setProperty("ETAT", JSON.stringify({ seq: {}, dernier: {} }));
    const dejaLa = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "surSoumission"; });
    if (!dejaLa) ScriptApp.newTrigger("surSoumission").forForm(form).onFormSubmit().create();
    Logger.log("Projet relié au classeur " + ss0.getUrl() + " et au formulaire " + form.getEditUrl());
  }
  return SpreadsheetApp.openById(id);
}

// =====================================================================
// 5. TRAITEMENT DES SOUMISSIONS (temps reel)
// =====================================================================
function lireEnqueteurs_(ss) {
  const sh = ss.getSheetByName("ENQUETEURS");
  const d = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 3).getValues();
  const map = {};
  d.forEach(function (l) { if (l[0]) map[norm_(l[0]).toUpperCase()] = norm_(l[2]).toUpperCase(); });
  return map;
}

function reponsesEnObjet_(formResponse) {
  const o = {};
  formResponse.getItemResponses().forEach(function (r) { o[r.getItem().getTitle()] = r.getResponse(); });
  return o;
}

function fmtDouala_(d, f) { return Utilities.formatDate(d, CONFIG.FUSEAU, f); }

/** Ecrit des lignes codees dans le masque (DATEENQU converti en vraie date pour les formules). */
function ecrireLignes_(sh, lignes, premiereLigne) {
  if (!lignes.length) return;
  const iDate = colonnesMasque_().map(function (c) { return c.code; }).indexOf("DATEENQU");
  lignes.forEach(function (l) {
    const p = String(l[iDate]).split("-");
    if (p.length === 3) l[iDate] = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  });
  const besoin = premiereLigne + lignes.length - 1;
  if (besoin > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), besoin - sh.getMaxRows() + 200);
  sh.getRange(premiereLigne, 1, lignes.length, lignes[0].length).setValues(lignes);
}

function surSoumission(e) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(30000); // evite les numeros de fiche en double
  try {
    const props = PropertiesService.getScriptProperties();
    const ss = contexte_();
    const sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
    const etat = JSON.parse(props.getProperty("ETAT") || '{"seq":{},"dernier":{}}');
    const seuil = Number(ss.getRangeByName("P_SEUIL_DELAI").getValue()) || CONFIG.SEUIL_DELAI_MIN;

    const fiche = {
      reponses: reponsesEnObjet_(e.response),
      horodatage: e.response.getTimestamp(),
      enqueteurs: lireEnqueteurs_(ss),
      seuilDelai: seuil,
      telsVus: telsDejaVus_(ss)
    };
    const ligne = construireLigne_(fiche, etat, fmtDouala_);

    ecrireLignes_(sh, [ligne], Math.max(sh.getLastRow() + 1, CONFIG.PREMIERE_LIGNE_DONNEES));
    const shc = feuilleContacts_(ss);
    shc.appendRow(fiche.contact);
    props.setProperty("ETAT", JSON.stringify(etat));
    SpreadsheetApp.flush();
  } finally {
    verrou.releaseLock();
  }
}

/** Recode toutes les reponses du formulaire (conserve les statuts REJETE saisis). */
function reconstruireMasque() {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(60000);
  try {
    const props = PropertiesService.getScriptProperties();
    const ss = contexte_();
    const form = FormApp.openById(props.getProperty("FORM_ID"));
    const sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
    const cols = colonnesMasque_();
    const iNum = 0, iStat = cols.length - 1;
    const p0 = CONFIG.PREMIERE_LIGNE_DONNEES;

    const rejetes = {};
    if (sh.getLastRow() >= p0) {
      sh.getRange(p0, 1, sh.getLastRow() - p0 + 1, cols.length).getValues().forEach(function (l) {
        if (l[iStat] === "REJETE") rejetes[l[iNum]] = true;
      });
      sh.getRange(p0, 1, sh.getLastRow() - p0 + 1, cols.length).clearContent();
    }

    const etat = { seq: {}, dernier: {} };
    const enqs = lireEnqueteurs_(ss);
    const seuil = Number(ss.getRangeByName("P_SEUIL_DELAI").getValue()) || CONFIG.SEUIL_DELAI_MIN;
    const reps = form.getResponses().sort(function (a, b) { return a.getTimestamp() - b.getTimestamp(); });
    const telsVus = {}, contacts = [];
    const lignes = reps.map(function (r) {
      const f = { reponses: reponsesEnObjet_(r), horodatage: r.getTimestamp(), enqueteurs: enqs, seuilDelai: seuil, telsVus: telsVus };
      const l = construireLigne_(f, etat, fmtDouala_);
      if (rejetes[l[iNum]]) { l[iStat] = "REJETE"; f.contact[f.contact.length - 1] = "REJETE"; }
      contacts.push(f.contact);
      return l;
    });
    ecrireLignes_(sh, lignes, p0);
    const shc = feuilleContacts_(ss);
    if (shc.getLastRow() > 1) shc.getRange(2, 1, shc.getLastRow() - 1, ENTETE_CONTACTS.length).clearContent();
    if (contacts.length) shc.getRange(2, 1, contacts.length, ENTETE_CONTACTS.length).setValues(contacts);
    props.setProperty("ETAT", JSON.stringify(etat));
    Logger.log(lignes.length + " fiches recodées.");
  } finally {
    verrou.releaseLock();
  }
}

// =====================================================================
// 6. EXPORT SPSS
// =====================================================================
function exporterPourSPSS() {
  // Ecrit la base codee dans l'onglet EXPORT_SPSS (pas d'acces a Google Drive requis).
  // Ensuite : ouvrir l'onglet EXPORT_SPSS > Fichier > Telecharger > Valeurs separees par des virgules (.csv)
  const props = PropertiesService.getScriptProperties();
  const ss = contexte_();
  const sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
  const cols = colonnesMasque_();
  const p0 = CONFIG.PREMIERE_LIGNE_DONNEES;
  const n = sh.getLastRow() - p0 + 1;
  const iDate = cols.map(function (c) { return c.code; }).indexOf("DATEENQU");
  const iStat = cols.length - 1;
  let lignes = n > 0 ? sh.getRange(p0, 1, n, cols.length).getValues() : [];
  lignes = lignes.filter(function (l) { return l[0] && l[iStat] !== "REJETE"; }).map(function (l) {
    if (l[iDate] instanceof Date) l[iDate] = Utilities.formatDate(l[iDate], CONFIG.FUSEAU, "yyyy-MM-dd");
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
  Logger.log(lignes.length + " fiches exportées dans l'onglet EXPORT_SPSS.");
  Logger.log("Onglet EXPORT_SPSS > Fichier > Télécharger > .csv, puis renommez le fichier EXPORT_SPSS.csv.");
}

function genererSyntaxeSPSS() {
  // Ecrit la syntaxe dans l'onglet SYNTAXE_SPSS (colonne A) : copier la colonne A
  // et la coller dans une nouvelle fenetre de syntaxe SPSS.
  const props = PropertiesService.getScriptProperties();
  const ss = contexte_();
  const txt = construireSyntaxeSPSS_("C:\\ETUDE_EDM\\EXPORT_SPSS.csv", "C:\\ETUDE_EDM\\EDM_ELECTRIQUE_CAMEROUN.sav");
  const lignes = txt.replace(/\n$/, "").split("\n").map(function (l) { return [l]; });
  let sh = ss.getSheetByName("SYNTAXE_SPSS");
  if (sh) sh.clear(); else sh = ss.insertSheet("SYNTAXE_SPSS", ss.getSheets().length);
  if (sh.getMaxRows() < lignes.length) sh.insertRowsAfter(sh.getMaxRows(), lignes.length - sh.getMaxRows());
  sh.getRange(1, 1, lignes.length, 1).setNumberFormat("@").setValues(lignes);
  sh.setColumnWidth(1, 900);
  Logger.log("Syntaxe SPSS écrite dans l'onglet SYNTAXE_SPSS (" + lignes.length + " lignes).");
}

// =====================================================================
// 7. MISE A JOUR DES CODES SUR UN CLASSEUR DEJA INSTALLE
//    (a lancer UNE fois apres avoir colle cette version du script ;
//     NE PAS relancer installer())
// =====================================================================
function mettreAJourCodes() {
  const props = PropertiesService.getScriptProperties();
  const ss = contexte_();
  const sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
  const cols = colonnesMasque_();
  if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());

  // En-tetes du masque : ligne 1 sections, ligne 2 codes, ligne 3 libelles
  const entetes = sh.getRange(1, 1, 3, sh.getMaxColumns());
  entetes.breakApart();
  entetes.clear();
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

  // Onglets calcules : recrees avec les nouveaux codes
  ["TABLEAU_DE_BORD", "TRI_A_PLAT", "DICTIONNAIRE"].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s) supprimerOnglet_(ss, s);
  });
  creerTableauDeBord_(ss, sh);
  creerTriAPlat_(ss, sh);
  creerDictionnaire_(ss);
  ss.setActiveSheet(ss.getSheetByName("TABLEAU_DE_BORD"));
  ss.moveActiveSheet(1);
  SpreadsheetApp.flush();

  // Recode les fiches deja recues (fiches tests)
  reconstruireMasque();
  Logger.log("Codes mis à jour : " + cols.map(function (x) { return x.code; }).join(", "));
}

// =====================================================================
// 8. REPARATION : reinstalle le declencheur de CE projet + recode tout
// =====================================================================
function reparer() {
  const ss = contexte_();
  const props = PropertiesService.getScriptProperties();
  const form = FormApp.openById(props.getProperty("FORM_ID"));

  // Supprime les declencheurs surSoumission de ce projet puis en recree un seul
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "surSoumission") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("surSoumission").forForm(form).onFormSubmit().create();

  // Recode toutes les reponses deja recues
  reconstruireMasque();

  const n = form.getResponses().length;
  const sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
  const lignes = Math.max(sh.getLastRow() - CONFIG.PREMIERE_LIGNE_DONNEES + 1, 0);
  Logger.log("Formulaire : " + form.getEditUrl());
  Logger.log("Classeur   : " + ss.getUrl());
  Logger.log("Réponses reçues dans le formulaire : " + n + " | lignes dans le masque : " + lignes);
  Logger.log("Déclencheurs actifs dans ce projet : " + ScriptApp.getProjectTriggers().length);
  Logger.log(n === lignes ? "OK : le masque est à jour." : "ATTENTION : écart entre réponses et masque, envoyez ce journal.");
}

// =====================================================================
// 9. TOUT CONFIGURER EN UN CLIC sur le classeur CLASSEUR_ID
//    (relie ce projet au bon classeur + formulaire, cree les onglets
//     manquants, applique les codes, installe le declencheur, recode)
// =====================================================================
function toutConfigurer() {
  const props = PropertiesService.getScriptProperties();
  props.deleteAllProperties();                       // oublie l'ancien classeur
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  const ss = contexte_();                            // relie au classeur CLASSEUR_ID + declencheur
  const vide = ss.getSheets().filter(function (s) {
    return /^(Feuille|Sheet)\s?1$/.test(s.getName()) && s.getLastRow() === 0;
  });
  if (vide.length && ss.getSheets().length > 1) supprimerOnglet_(ss, vide[0]);
  mettreAJourCodes();                                // en-tetes, TABLEAU_DE_BORD, TRI_A_PLAT, DICTIONNAIRE + recodage
  Logger.log("Déclencheurs actifs : " + ScriptApp.getProjectTriggers().length + " (attendu : 1)");
  Logger.log("TERMINÉ : " + ss.getUrl());
}

// =====================================================================
// 10. IDENTIFICATION DE L'ENQUETE + FICHE CONTACTS (directeur marketing)
// =====================================================================
const ENTETE_CONTACTS = ["N° FICHE", "DATE", "HEURE", "ENQUÊTEUR", "VILLE", "QUARTIER / ZONE", "SITE PRÉCIS",
  "NOM / RAISON SOCIALE", "PROFIL (Q1)", "TÉLÉPHONE", "E-MAIL", "ACCORD RECONTACT",
  "PRODUITS ACHETÉS (Q9)", "MARQUE PRINCIPALE (Q12)", "MONTANT MOYEN (Q8)", "CANAL DE CONTACT PRÉFÉRÉ (Q33)", "STATUT QC"];

/** Ajoute au formulaire les questions d'identification manquantes, juste apres l'identifiant enqueteur. */
function ajouterQuestionsIdentification_(form, position) {
  const titres = form.getItems().map(function (it) { return it.getTitle(); });
  let pos = position;
  function placer(item) { form.moveItem(item.getIndex(), pos); pos++; }

  // Ancienne question "Site / quartier" -> devient "Quartier / zone"
  const ancien = form.getItems().filter(function (it) { return it.getTitle() === TITRE_SITE_ANCIEN; })[0];
  if (ancien) { ancien.setTitle(TITRE_QUARTIER); ancien.asTextItem().setRequired(true); placer(ancien); }
  else if (titres.indexOf(TITRE_QUARTIER) < 0) placer(form.addTextItem().setTitle(TITRE_QUARTIER).setRequired(true));
  else pos++;

  if (titres.indexOf(TITRE_SITE) < 0) placer(form.addTextItem().setTitle(TITRE_SITE).setRequired(true)); else pos++;
  if (titres.indexOf(TITRE_NOM) < 0) placer(form.addTextItem().setTitle(TITRE_NOM).setRequired(true)); else pos++;
  if (titres.indexOf(TITRE_TEL) < 0) {
    const tel = form.addTextItem().setTitle(TITRE_TEL).setRequired(true)
      .setHelpText("9 chiffres, ex. 6XXXXXXXX (indicatif +237 facultatif)");
    tel.setValidation(FormApp.createTextValidation()
      .setHelpText("Numéro invalide : 9 chiffres commençant par 6 ou 2, avec ou sans +237.")
      .requireTextMatchesPattern("^(\\+?237)?[ ]?[26]([ .]?[0-9]){8}$").build());
    placer(tel);
  } else pos++;
  if (titres.indexOf(TITRE_MAIL) < 0) {
    const mail = form.addTextItem().setTitle(TITRE_MAIL).setRequired(false);
    mail.setValidation(FormApp.createTextValidation().setHelpText("Adresse e-mail invalide.").requireTextIsEmail().build());
    placer(mail);
  } else pos++;
  if (titres.indexOf(TITRE_ACCORD) < 0) {
    const acc = form.addMultipleChoiceItem().setTitle(TITRE_ACCORD).setRequired(true)
      .setHelpText("À lire à l'enquêté : « Acceptez-vous que vos coordonnées soient utilisées pour vous recontacter " +
        "avec des offres commerciales ? Vos réponses au questionnaire restent anonymes dans l'analyse. »");
    acc.setChoiceValues(["Oui", "Non"]);
    placer(acc);
  }
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

/** Telephones deja enregistres (detection des doublons = meme personne interrogee 2 fois). */
function telsDejaVus_(ss) {
  const sh = feuilleContacts_(ss);
  const vus = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 10, sh.getLastRow() - 1, 1).getValues().forEach(function (l) {
    const k = String(l[0]).replace(/\D/g, "").replace(/^237/, "");
    if (k) vus[k] = true;
  });
  return vus;
}

/** Regles visuelles et liste STATUTQC du masque (a refaire si les colonnes bougent). */
function reglesMasque_(sh) {
  const cols = colonnesMasque_();
  const n = sh.getMaxRows() - 3;
  const plage = sh.getRange(CONFIG.PREMIERE_LIGNE_DONNEES, 1, n, cols.length);
  const L = lettreColonne_(cols.length);
  sh.getRange(CONFIG.PREMIERE_LIGNE_DONNEES, 1, n, sh.getMaxColumns()).clearDataValidations();
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + L + "4=\"REJETE\"")
      .setBackground("#F4CCCC").setFontColor("#990000").setRanges([plage]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + L + "4=\"A_VERIFIER\"")
      .setBackground("#FFF2CC").setRanges([plage]).build()
  ]);
  sh.getRange(CONFIG.PREMIERE_LIGNE_DONNEES, cols.length, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["OK", "A_VERIFIER", "REJETE"], true).build());
  const iDate = cols.map(function (c) { return c.code; }).indexOf("DATEENQU") + 1;
  sh.getRange(CONFIG.PREMIERE_LIGNE_DONNEES, iDate, n, 1).setNumberFormat("dd/MM/yyyy");
}

/**
 * A LANCER UNE FOIS : ajoute nom, quartier, site, telephone, e-mail et accord
 * au formulaire existant, cree l'onglet CONTACTS et met tout le classeur a jour.
 */
function ajouterIdentification() {
  const ss = contexte_();
  const props = PropertiesService.getScriptProperties();
  const form = FormApp.openById(props.getProperty("FORM_ID"));
  const itemEnq = form.getItems().filter(function (it) { return it.getTitle() === TITRE_ENQ; })[0];
  ajouterQuestionsIdentification_(form, itemEnq ? itemEnq.getIndex() + 1 : 0);
  feuilleContacts_(ss);
  mettreAJourCodes();                 // en-tetes, onglets calcules, recodage (masque + contacts)
  corrigerFormat();
  Logger.log("Questions ajoutées au formulaire : " + form.getEditUrl());
  Logger.log("TERMINÉ.");
}

/** Remet le format date, les couleurs et la liste STATUTQC du masque (classeur rouvert). */
function corrigerFormat() {
  SpreadsheetApp.flush();
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || CLASSEUR_ID;
  const sh = SpreadsheetApp.openById(id).getSheetByName("MASQUE_DEPOUILLEMENT");
  reglesMasque_(sh);
  Logger.log("Format du masque corrigé. TERMINÉ.");
}

// =====================================================================
// 11. CONTROLE_CODIFICATION : recalcul des codes par FORMULES VISIBLES
//     a partir des reponses brutes, et comparaison avec le masque.
//     (outil de transparence / formation / audit ; ne modifie rien)
// =====================================================================
function creerControleCodification() {
  SpreadsheetApp.flush();
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || CLASSEUR_ID;
  const ss = SpreadsheetApp.openById(id);
  const brut = ss.getSheets().filter(function (s) { return s.getFormUrl && s.getFormUrl(); })[0];
  if (!brut) throw new Error("Onglet des réponses du formulaire introuvable.");
  const B = "'" + brut.getName().replace(/'/g, "''") + "'";
  const NMAX = 1000, R0 = CONFIG.PREMIERE_LIGNE_DONNEES;           // lignes 4..1003 comme le masque
  const cols = colonnesMasque_();
  const M = "MASQUE_DEPOUILLEMENT";

  // ---- 1. Referentiel des codes (cles de recherche calculees par formule) ----
  ["REF_CODES", "CONTROLE_CODIFICATION"].forEach(function (n) { const s = ss.getSheetByName(n); if (s) supprimerOnglet_(ss, s); });
  const ref = ss.insertSheet("REF_CODES", ss.getSheets().length);
  const refRows = [["CLE (formule)", "CODE", "VARIABLE", "MODALITÉ (libellé exact du formulaire)"]];
  const cleItem = {};                                            // code variable multi -> ligne de sa cle
  cols.forEach(function (c) {
    if (!c.valeurs || (c.groupe === undefined && c.grille === undefined &&
        ITEMS.filter(function (it) { return it.code === c.code; }).length === 0)) return;
    if (c.groupe) {
      const it = ITEMS.filter(function (x) { return x.code === c.groupe; })[0];
      const lib = it.sousItems.filter(function (s) { return s[0] === c.code; })[0][1];
      refRows.push(["", 1, c.code, lib]); cleItem[c.code] = refRows.length;
    } else {
      c.valeurs.forEach(function (p) { refRows.push(["", p[0], c.code, p[1]]); });
    }
  });
  for (let r = 2; r <= refRows.length; r++) {
    refRows[r - 1][0] = '=C' + r + '&"|"&REGEXREPLACE(LOWER(D' + r + '),"[^a-z0-9]","")';
  }
  ref.getRange(1, 1, refRows.length, 4).setValues(refRows);
  styleEntete_(ref.getRange(1, 1, 1, 4));
  ref.setFrozenRows(1); ref.setColumnWidth(1, 260); ref.setColumnWidth(4, 320);
  const REF = "REF_CODES!$A$2:$B$" + refRows.length;

  // ---- 2. Onglet de controle, colonnes alignees sur le masque ----
  const sh = ss.insertSheet("CONTROLE_CODIFICATION", ss.getSheets().length);
  if (sh.getMaxColumns() < cols.length + 2) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length + 2 - sh.getMaxColumns());
  if (sh.getMaxRows() < R0 + NMAX) sh.insertRowsAfter(sh.getMaxRows(), R0 + NMAX - sh.getMaxRows());
  const TS = B + "!$A$2:$A$" + (NMAX + 1);
  const BLOC = B + "!$A$2:$CZ$" + (NMAX + 1), TETE = B + "!$A$1:$CZ$1";
  function x(num) { return "INDEX(" + BLOC + ",0,MATCH(\"Q" + num + ". *\"," + TETE + ",0))"; }
  function norm(e) { return 'REGEXREPLACE(LOWER(' + e + '&""),"[^a-z0-9]","")'; }

  const l1 = [], l2 = [], l3 = [], l4 = [];
  cols.forEach(function (c, i) {
    l1.push(c.code); l2.push(c.label);
    const it = ITEMS.filter(function (q) { return q.code === c.code; })[0];
    let f = "";
    if (c.code === "NUMFICHE") {
      f = '=ARRAYFORMULA(IF(' + TS + '="","",' + M + '!$A$' + R0 + ':$A$' + (R0 + NMAX - 1) + '))';
      l3.push("référence");
    } else if (it && it.type === "radio") {
      const num = it.q.match(/^Q(\d+)\./)[1];
      const repli = it.autre ? String(it.autre.code) : '"?"';
      f = '=ARRAYFORMULA(IF(' + TS + '="","",IF(' + x(num) + '&""="",' + CONFIG.CODE_NR + ',IFERROR(VLOOKUP("' + c.code + '|"&' +
          norm(x(num)) + ',' + REF + ',2,FALSE),' + repli + '))))';
      l3.push("COMPARÉ");
    } else if (c.grille) {
      const gr = ITEMS.filter(function (q) { return q.code === c.grille; })[0];
      const numg = gr.q.match(/^Q(\d+)\./)[1];
      const xg = "INDEX(" + BLOC + ",0,MATCH(\"Q" + numg + ". *[" + c.ligne + "]\"," + TETE + ",0))";
      f = '=ARRAYFORMULA(IF(' + TS + '="","",IF(' + xg + '&""="",' + CONFIG.CODE_NR + ',IFERROR(VLOOKUP("' + c.code + '|"&' +
          norm(xg) + ',' + REF + ',2,FALSE),"?"))))';
      l3.push("COMPARÉ");
    } else if (c.groupe) {
      const g = ITEMS.filter(function (q) { return q.code === c.groupe; })[0];
      const num = g.q.match(/^Q(\d+)\./)[1];
      const cle = 'REGEXREPLACE(LOWER(REF_CODES!$D$' + cleItem[c.code] + '),"[^a-z0-9]","")';
      f = '=ARRAYFORMULA(IF(' + TS + '="","",IF(' + x(num) + '&""="",' + CONFIG.CODE_NR + ',IF(ISNUMBER(SEARCH(' + cle + ',' +
          norm(x(num)) + ')),1,0))))';
      l3.push("COMPARÉ");
    } else {
      l3.push("—");
    }
    l4.push(f);
  });
  const nc = cols.length;
  sh.getRange(1, 1, 1, nc).setValues([l1]);
  styleEntete_(sh.getRange(1, 1, 1, nc));
  sh.getRange(2, 1, 1, nc).setValues([l2]).setFontStyle("italic").setFontSize(8).setWrap(true).setVerticalAlignment("top");
  sh.getRange(3, 1, 1, nc).setValues([l3]).setFontWeight("bold").setHorizontalAlignment("center").setFontColor("#1F4E78");
  sh.getRange(R0, 1, 1, nc).setValues([l4]);

  // Colonne ECARTS par fiche + synthese
  const cE = nc + 1, LE = lettreColonne_(cE), LN = lettreColonne_(nc);
  sh.getRange(1, cE).setValue("ÉCARTS");
  styleEntete_(sh.getRange(1, cE));
  sh.getRange(2, cE).setValue("Nb de codes différents du masque").setFontSize(8).setFontStyle("italic");
  const fe = [];
  for (let r = R0; r < R0 + NMAX; r++) {
    fe.push(['=IF(A' + r + '="","",SUMPRODUCT(($A$3:$' + LN + '$3="COMPARÉ")*(A' + r + ':' + LN + r + '<>' + M + '!A' + r + ':' + LN + r + ')))']);
  }
  sh.getRange(R0, cE, NMAX, 1).setValues(fe);

  const cS = nc + 2, LS = lettreColonne_(cS);
  sh.getRange(1, cS, 6, 1).setValues([["SYNTHÈSE"],
    ['=COUNTA(' + TS + ')'], ['=COUNTA(' + M + '!$A$' + R0 + ':$A$' + (R0 + NMAX - 1) + ')'],
    ['=SUM(' + LE + R0 + ':' + LE + (R0 + NMAX - 1) + ')'],
    ['=IF(AND(' + LS + '2=' + LS + '3,' + LS + '4=0),"✔ CODIFICATION CONFORME","⚠ ÉCART : lancer reconstruireMasque")'], [""]]);
  sh.getRange(1, cS + 1, 5, 1).setValues([[""], ["← fiches brutes (formulaire)"], ["← fiches dans le masque"], ["← total des écarts"], ["← verdict"]]);
  styleEntete_(sh.getRange(1, cS));
  sh.getRange(5, cS).setFontWeight("bold");

  // Mise en forme : cellule en rouge si le code recalcule differe du masque
  const zone = sh.getRange(R0, 1, NMAX, nc);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(A$3="COMPARÉ",A' + R0 + '<>"",A' + R0 + '<>INDIRECT("' + M + '!"&ADDRESS(ROW(),COLUMN())))')
      .setBackground("#F4CCCC").setFontColor("#990000").setRanges([zone]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0)
      .setBackground("#F4CCCC").setRanges([sh.getRange(R0, cE, NMAX, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("✔").setBackground("#D9EAD3").setRanges([sh.getRange(5, cS)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("⚠").setBackground("#F4CCCC").setRanges([sh.getRange(5, cS)]).build()
  ]);
  sh.setFrozenRows(3); sh.setFrozenColumns(1); sh.setRowHeight(2, 60);
  sh.setColumnWidth(cS, 230);
  Logger.log("CONTROLE_CODIFICATION créé. TERMINÉ.");
}

// =====================================================================
// 12. CIBLES (quotas) + SUIVI_CIBLES (enqueteur x cible x jour, penchants,
//     atteinte des quotas par ville, tendances du jour) - 100 % formules
// =====================================================================
const QUOTAS_RECOMMANDES = {            // code Q1 -> [famille, Douala, Yaounde, Bafoussam] — cahier des charges 02
  1: ["Utilisateurs finaux", 35, 35, 15],     // Particuliers (ménages)
  2: ["Utilisateurs finaux", 35, 35, 15],     // Entreprises (PME, industries)
  3: ["Prescripteurs", 40, 40, 20],           // Artisans / électriciens
  4: ["Prescripteurs", 40, 40, 20],           // Entreprises BTP
  5: ["Distributeurs", 50, 50, 30]            // Grossistes / revendeurs
};
const TENDANCES_VARS = ["MAACPLSO", "LIEACHPR", "PRINFREI", "ORIGPRIV", "GAACPLSO", "DEAVHAGA", "PRCRICHO", "CANAPREF"];

function creerSuiviCibles() {
  SpreadsheetApp.flush();
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || CLASSEUR_ID;
  const ss = SpreadsheetApp.openById(id);
  ["CIBLES", "SUIVI_CIBLES"].forEach(function (n) { const s = ss.getSheetByName(n); if (s) supprimerOnglet_(ss, s); });

  const q1 = ITEMS.filter(function (it) { return it.code === "VOUSETES"; })[0];
  const cibles = q1.choix.concat(q1.autre ? [[q1.autre.code, q1.autre.libelle]] : []);   // [[code, libelle]...]
  const nC = cibles.length;
  const ENQ = refMasque_("CODEENQU"), DAT = refMasque_("DATEENQU"), CIB = refMasque_("VOUSETES"),
        ZON = refMasque_("CODEZONE"), STA = refMasque_("STATUTQC");
  const V = STA + ',"<>REJETE"';

  // ------------------------- ONGLET CIBLES -------------------------
  const c = ss.insertSheet("CIBLES", ss.getSheets().length);
  c.getRange("A1").setValue("QUOTAS PAR CIBLE ET PAR VILLE (cases jaunes modifiables)").setFontSize(13).setFontWeight("bold");
  c.getRange("A2").setValue("Quotas du cahier des charges (500 fiches : Douala 200, Yaoundé 200, Bafoussam 100) : 17 % particuliers, 17 % entreprises, 20 % artisans/électriciens, 20 % BTP, 26 % grossistes/revendeurs.")
    .setFontStyle("italic").setFontColor("#666666");
  const h = ["CODE Q1", "CIBLE", "FAMILLE", "DOUALA", "YAOUNDE", "BAFOUSSAM", "TOTAL", "% DU TOTAL"];
  c.getRange(4, 1, 1, h.length).setValues([h]); styleEntete_(c.getRange(4, 1, 1, h.length));
  const lignes = cibles.map(function (cb, i) {
    const r = 5 + i, qr = QUOTAS_RECOMMANDES[cb[0]] || ["Autres", 0, 0, 0];
    return [cb[0], cb[1], qr[0], qr[1], qr[2], qr[3], "=SUM(D" + r + ":F" + r + ")", "=IF($G$" + (5 + nC) + "=0,0,G" + r + "/$G$" + (5 + nC) + ")"];
  });
  const rT = 5 + nC;
  lignes.push(["", "TOTAL QUOTAS", "", "=SUM(D5:D" + (rT - 1) + ")", "=SUM(E5:E" + (rT - 1) + ")", "=SUM(F5:F" + (rT - 1) + ")",
               "=SUM(G5:G" + (rT - 1) + ")", "=IF(G" + rT + "=0,0,1)"]);
  lignes.push(["", "CAPACITÉ ENQUÊTEURS", "", '=SUMIF(ENQUETEURS!$C:$C,"DOUALA",ENQUETEURS!$D:$D)',
               '=SUMIF(ENQUETEURS!$C:$C,"YAOUNDE",ENQUETEURS!$D:$D)', '=SUMIF(ENQUETEURS!$C:$C,"BAFOUSSAM",ENQUETEURS!$D:$D)',
               "=SUM(D" + (rT + 1) + ":F" + (rT + 1) + ")", ""]);
  lignes.push(["", "CONTRÔLE (capacité ≥ quota)", ""].concat(["D", "E", "F", "G"].map(function (L) {
    return '=IF(' + L + (rT + 1) + '>=' + L + rT + ',"✔ marge "&(' + L + (rT + 1) + '-' + L + rT + '),"⚠ manque "&(' + L + rT + '-' + L + (rT + 1) + '))';
  })).concat([""]));
  c.getRange(5, 1, lignes.length, h.length).setValues(lignes);
  c.getRange(5, 4, nC, 3).setBackground("#FFF2CC");
  c.getRange(5, 8, nC + 1, 1).setNumberFormat("0%");
  c.getRange(rT, 1, 3, h.length).setFontWeight("bold");

  // Objectif par enqueteur et par jour
  const r2 = rT + 5;
  c.getRange(r2 - 1, 1).setValue("OBJECTIF PAR ENQUÊTEUR ET PAR JOUR (= quota ville ÷ nb enquêteurs de la ville ÷ nb jours)").setFontWeight("bold");
  c.getRange(r2, 1, 1, 6).setValues([["CODE Q1", "CIBLE", "", "DOUALA", "YAOUNDE", "BAFOUSSAM"]]); styleEntete_(c.getRange(r2, 1, 1, 6));
  const zonesTxt = ["DOUALA", "YAOUNDE", "BAFOUSSAM"], colQ = ["D", "E", "F"];
  const obj = cibles.map(function (cb, i) {
    return [cb[0], cb[1], ""].concat(zonesTxt.map(function (z, k) {
      return '=IFERROR(' + colQ[k] + (5 + i) + '/COUNTIF(ENQUETEURS!$C:$C,"' + z + '")/P_NB_JOURS,0)';
    }));
  });
  c.getRange(r2 + 1, 1, nC, 6).setValues(obj);
  c.getRange(r2 + 1, 4, nC, 3).setNumberFormat("0.0");
  c.setColumnWidth(2, 200); c.setColumnWidth(3, 200);

  // Familles
  const r3 = r2 + nC + 3;
  c.getRange(r3 - 1, 1).setValue("QUOTAS PAR FAMILLE DE CIBLE").setFontWeight("bold");
  c.getRange(r3, 1, 1, 6).setValues([["", "FAMILLE", "", "DOUALA", "YAOUNDE", "BAFOUSSAM"]]); styleEntete_(c.getRange(r3, 1, 1, 6));
  const fams = ["Utilisateurs finaux", "Prescripteurs", "Distributeurs"];
  c.getRange(r3 + 1, 1, fams.length, 6).setValues(fams.map(function (f) {
    return ["", f, ""].concat(colQ.map(function (L) { return '=SUMIF($C$5:$C$' + (rT - 1) + ',B' + (r3 + 1 + fams.indexOf(f)) + ',' + L + '$5:' + L + '$' + (rT - 1) + ')'; }));
  }));

  // ---------------------- ONGLET SUIVI_CIBLES ----------------------
  const s = ss.insertSheet("SUIVI_CIBLES", ss.getSheets().length);
  s.getRange("A1").setValue("SUIVI DES CIBLES EN TEMPS RÉEL — par enquêteur, par jour, par ville").setFontSize(14).setFontWeight("bold");
  s.getRange("A2").setValue("Fiches REJETE exclues. « À renforcer » = cible la plus en retard sur son quota ; « Penchant » = cible sur-représentée de plus de 15 points.")
    .setFontStyle("italic").setFontColor("#666666");
  const nEnq = 8;
  const cibH = cibles.map(function (cb) { return cb[1]; });
  const hdr = ["ENQ", "NOM", "ZONE"].concat(cibH).concat(["TOTAL", "OBJECTIF", "% RÉALISÉ", "À RENFORCER", "PENCHANT"]);
  const cT = 4 + nC, LT = lettreColonne_(cT), L0 = "D", L1 = lettreColonne_(3 + nC);
  // parts attendues : ligne cachee de % par cible (depuis CIBLES!H)
  const blocs = [["CUMUL (J1 + J2 + J3)", null], ["JOUR 1", "P_J1"], ["JOUR 2", "P_J2"], ["JOUR 3", "P_J3"]];
  let r = 4;
  blocs.forEach(function (b) {
    s.getRange(r, 1).setValue(b[0] + (b[1] ? "" : "")).setFontWeight("bold").setFontSize(11).setBackground("#D9E1F2");
    s.getRange(r, 1, 1, hdr.length).setBackground("#D9E1F2");
    if (b[1]) s.getRange(r, 3).setFormula('=IF(' + b[1] + '="","(date à saisir dans PARAMETRES)",TEXT(' + b[1] + ',"dd/mm/yyyy"))');
    r++;
    s.getRange(r, 1, 1, hdr.length).setValues([hdr]); styleEntete_(s.getRange(r, 1, 1, hdr.length));
    const rh = r; r++;
    const rows = [];
    for (let i = 0; i < nEnq; i++) {
      const rr = r + i, re = 2 + i;
      const dateCrit = b[1] ? "," + DAT + "," + b[1] : "";
      const row = ["=ENQUETEURS!A" + re, "=ENQUETEURS!B" + re, "=ENQUETEURS!C" + re];
      cibles.forEach(function (cb) {
        row.push(b[1] ? '=IF(' + b[1] + '="","",COUNTIFS(' + ENQ + ',$A' + rr + ',' + CIB + ',' + cb[0] + dateCrit + ',' + V + '))'
                      : '=COUNTIFS(' + ENQ + ',$A' + rr + ',' + CIB + ',' + cb[0] + ',' + V + ')');
      });
      row.push("=SUM(" + L0 + rr + ":" + L1 + rr + ")");
      row.push(b[1] ? "=P_OBJ_JOUR" : "=ENQUETEURS!D" + re);
      row.push("=IF(N(" + lettreColonne_(cT + 1) + rr + ")=0,0," + LT + rr + "/" + lettreColonne_(cT + 1) + rr + ")");
      const parts = "(" + L0 + rr + ":" + L1 + rr + "/" + LT + rr + ")-TRANSPOSE(CIBLES!$H$5:$H$" + (4 + nC) + ")";
      row.push('=IF(N(' + LT + rr + ')<5,"",INDEX($' + L0 + '$' + rh + ':$' + L1 + '$' + rh + ',MATCH(MIN(ARRAYFORMULA(' + parts + ')),ARRAYFORMULA(' + parts + '),0)))');
      row.push('=IF(N(' + LT + rr + ')<5,"",IF(MAX(ARRAYFORMULA(' + parts + '))>0.15,"⚠ "&INDEX($' + L0 + '$' + rh + ':$' + L1 + '$' + rh +
               ',MATCH(MAX(ARRAYFORMULA(' + parts + ')),ARRAYFORMULA(' + parts + '),0)),""))');
      rows.push(row);
    }
    s.getRange(r, 1, nEnq, hdr.length).setValues(rows);
    s.getRange(r, cT + 2, nEnq, 1).setNumberFormat("0%");
    const rtot = r + nEnq;
    const tot = ["TOTAL", "", ""];
    for (let k = 4; k <= cT + 1; k++) { const L = lettreColonne_(k); tot.push("=SUM(" + L + r + ":" + L + (rtot - 1) + ")"); }
    tot.push("=IF(" + lettreColonne_(cT + 1) + rtot + "=0,0," + LT + rtot + "/" + lettreColonne_(cT + 1) + rtot + ")", "", "");
    s.getRange(rtot, 1, 1, hdr.length).setValues([tot]).setFontWeight("bold");
    s.getRange(rtot, cT + 2).setNumberFormat("0%");
    r = rtot + 3;
  });

  // Atteinte des quotas par ville
  s.getRange(r, 1).setValue("ATTEINTE DES QUOTAS PAR VILLE ET PAR CIBLE").setFontWeight("bold").setFontSize(11);
  r++;
  const hv = ["CIBLE"];
  ["DOUALA", "YAOUNDE", "BAFOUSSAM"].forEach(function (z) { hv.push(z + " quota", "réalisé", "%", "reste/enq./jour"); });
  hv.push("TOTAL quota", "réalisé", "%");
  s.getRange(r, 1, 1, hv.length).setValues([hv]); styleEntete_(s.getRange(r, 1, 1, hv.length));
  r++;
  const jr = 'MAX(1,COUNTIF(PARAMETRES!$B$2:$B$4,">="&TODAY()))';
  const rv = cibles.map(function (cb, i) {
    const rr = r + i, row = [cb[1]];
    [1, 2, 3].forEach(function (zc, k) {
      const base = 2 + k * 4, Lq = lettreColonne_(base), Lr = lettreColonne_(base + 1);
      row.push("=CIBLES!" + colQ[k] + (5 + i));
      row.push('=COUNTIFS(' + CIB + ',' + cb[0] + ',' + ZON + ',' + zc + ',' + V + ')');
      row.push("=IF(" + Lq + rr + "=0,0," + Lr + rr + "/" + Lq + rr + ")");
      row.push('=IFERROR(MAX(0,' + Lq + rr + '-' + Lr + rr + ')/COUNTIF(ENQUETEURS!$C:$C,"' + zonesTxt[k] + '")/' + jr + ',0)');
    });
    row.push("=B" + rr + "+F" + rr + "+J" + rr, "=C" + rr + "+G" + rr + "+K" + rr, "=IF(N" + rr + "=0,0,O" + rr + "/N" + rr + ")");
    return row;
  });
  s.getRange(r, 1, nC, hv.length).setValues(rv);
  ["D", "H", "L", "P"].forEach(function (L) { s.getRange(L + r + ":" + L + (r + nC - 1)).setNumberFormat("0%"); });
  ["E", "I", "M"].forEach(function (L) { s.getRange(L + r + ":" + L + (r + nC - 1)).setNumberFormat("0.0"); });
  const rQ = r;
  r += nC + 3;

  // Tendances du jour
  s.getRange(r, 1).setValue("TENDANCES DU JOUR (réponse la plus citée)").setFontWeight("bold").setFontSize(11);
  s.getRange(r, 4).setValue("Date analysée :").setFontWeight("bold");
  s.getRange(r, 5).setFormula("=TODAY()").setNumberFormat("dd/mm/yyyy").setBackground("#FFF2CC");
  s.getRange(r, 6).setValue("← modifiable (ex. date de J1)").setFontStyle("italic").setFontColor("#666666");
  const rd = r; r++;
  s.getRange(r, 1, 1, 5).setValues([["QUESTION", "", "RÉPONSE DOMINANTE", "NB FICHES", "% DES FICHES DU JOUR"]]);
  styleEntete_(s.getRange(r, 1, 1, 5)); r++;
  const nJour = 'COUNTIFS(' + DAT + ',$E$' + rd + ',' + V + ')';
  const cols = colonnesMasque_();
  const tend = TENDANCES_VARS.map(function (code) {
    const col = cols.filter(function (x) { return x.code === code; })[0];
    const vals = col.valeurs.filter(function (p) { return p[0] < 97; });
    const codes = "{" + vals.map(function (p) { return p[0]; }).join(",") + "}";
    const libs = "{" + vals.map(function (p) { return '"' + String(p[1]).replace(/"/g, '""') + '"'; }).join(",") + "}";
    const cnt = 'ARRAYFORMULA(COUNTIFS(' + refMasque_(code) + ',' + codes + ',' + DAT + ',$E$' + rd + ',' + V + '))';
    return [col.label, "",
      '=IF(' + nJour + '=0,"—",INDEX(' + libs + ',MATCH(MAX(' + cnt + '),' + cnt + ',0)))',
      '=IF(' + nJour + '=0,0,MAX(' + cnt + '))',
      '=IF(' + nJour + '=0,0,MAX(' + cnt + ')/' + nJour + ')'];
  });
  s.getRange(r, 1, tend.length, 5).setValues(tend);
  s.getRange(r, 5, tend.length, 1).setNumberFormat("0%");

  // Mises en forme
  const regles = [];
  const plage = s.getRange(4, 1, rQ - 4, hdr.length);
  regles.push(SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("⚠").setBackground("#F4CCCC").setFontColor("#990000")
    .setRanges([s.getRange(4, cT + 4, rQ - 4, 1)]).build());
  regles.push(SpreadsheetApp.newConditionalFormatRule().setGradientMaxpoint("#6AA84F")
    .setGradientMidpointWithValue("#FFD966", SpreadsheetApp.InterpolationType.NUMBER, "0.5").setGradientMinpoint("#E06666")
    .setRanges([s.getRange("D" + rQ + ":D" + (rQ + nC - 1)), s.getRange("H" + rQ + ":H" + (rQ + nC - 1)),
                s.getRange("L" + rQ + ":L" + (rQ + nC - 1)), s.getRange("P" + rQ + ":P" + (rQ + nC - 1))]).build());
  s.setConditionalFormatRules(regles);
  s.setColumnWidth(1, 70); s.setColumnWidth(2, 150);
  for (let k = 4; k <= 3 + nC; k++) s.setColumnWidth(k, 95);
  s.setColumnWidth(cT + 3, 150); s.setColumnWidth(cT + 4, 170);
  s.setFrozenColumns(3);
  Logger.log("CIBLES et SUIVI_CIBLES créés. TERMINÉ.");
}

// =====================================================================
// 13. TABLEAUX CROISES INTERACTIFS + TEST DU KHI-DEUX (100 % formules)
//     4 onglets CROISEMENT_1..4 (listes deroulantes : variable en ligne,
//     variable en colonne, filtre ville, filtre cible). Duplicables.
// =====================================================================
const CROISEMENTS_DEFAUT = [
  ["CROISEMENT_1", "MAACPLSO", "CODEZONE"],   // marque x ville
  ["CROISEMENT_2", "GAACPLSO", "VOUSETES"],   // gamme x cible
  ["CROISEMENT_3", "ORIGPRIV", "VOUSETES"],   // origine x cible
  ["CROISEMENT_4", "PRINFREI", "CODEZONE"]    // frein x ville
];

function creerTableauxCroises() {
  SpreadsheetApp.flush();
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || CLASSEUR_ID;
  const ss = SpreadsheetApp.openById(id);

  // ---- Liste des variables croisables (codes < 97, max 12 modalites) ----
  const vars = colonnesMasque_().filter(function (c) {
    return c.valeurs && c.code !== "STATUTQC";
  }).map(function (c) {
    const v = c.valeurs.filter(function (p) { return p[0] < 97; }).slice(0, 12);
    return { code: c.code, label: c.label, v: v };
  });
  let vc = ss.getSheetByName("VARS_CROIS");
  if (vc) supprimerOnglet_(ss, vc);
  vc = ss.insertSheet("VARS_CROIS", ss.getSheets().length);
  const lignes = [["CHOIX (liste déroulante)", "CODE"].concat(
    Array.from({ length: 12 }, function (_, i) { return "code " + (i + 1); }),
    Array.from({ length: 12 }, function (_, i) { return "modalité " + (i + 1); }))];
  vars.forEach(function (x) {
    const codes = [], libs = [];
    for (let i = 0; i < 12; i++) { codes.push(x.v[i] ? x.v[i][0] : ""); libs.push(x.v[i] ? String(x.v[i][1]) : ""); }
    lignes.push([x.code + " — " + String(x.label).substr(0, 70), x.code].concat(codes, libs));
  });
  vc.getRange(1, 1, lignes.length, 26).setValues(lignes);
  styleEntete_(vc.getRange(1, 1, 1, 26));
  vc.setColumnWidth(1, 380);
  const nV = lignes.length;                                   // derniere ligne
  const LISTE = "VARS_CROIS!$A$2:$A$" + nV, CODES = "VARS_CROIS!$B$2:$B$" + nV;
  const MCODES = "VARS_CROIS!$C$2:$N$" + nV, MLIBS = "VARS_CROIS!$O$2:$Z$" + nV;
  const rQ1 = 2 + vars.map(function (x) { return x.code; }).indexOf("VOUSETES");
  const affiche = {};
  vars.forEach(function (x, i) { affiche[x.code] = lignes[i + 1][0]; });
  const libQ1 = vars.filter(function (x) { return x.code === "VOUSETES"; })[0].v.map(function (p) { return String(p[1]); });

  CROISEMENTS_DEFAUT.forEach(function (d) {
    construireCroisement_(ss, d[0], affiche[d[1]], affiche[d[2]], LISTE, CODES, MCODES, MLIBS, rQ1, libQ1);
  });
  vc.hideSheet();
  Logger.log("Onglets CROISEMENT_1 à 4 créés. TERMINÉ.");
}

function construireCroisement_(ss, nom, defL, defC, LISTE, CODES, MCODES, MLIBS, rQ1, libQ1) {
  let s = ss.getSheetByName(nom);
  if (s) supprimerOnglet_(ss, s);
  s = ss.insertSheet(nom, ss.getSheets().length);
  if (s.getMaxColumns() < 27) s.insertColumnsAfter(s.getMaxColumns(), 27 - s.getMaxColumns());

  const cols = colonnesMasque_(), LAST = lettreColonne_(cols.length);
  const DATA = "MASQUE_DEPOUILLEMENT!$A$" + CONFIG.PREMIERE_LIGNE_DONNEES + ":$" + LAST;
  const HEAD = "MASQUE_DEPOUILLEMENT!$A$2:$" + LAST + "$2";
  const ROWD = "INDEX(" + DATA + ",0,MATCH($AA$3," + HEAD + ",0))";
  const COLD = "INDEX(" + DATA + ",0,MATCH($AA$4," + HEAD + ",0))";
  const ZON = refMasque_("CODEZONE"), CIB = refMasque_("VOUSETES"), STA = refMasque_("STATUTQC");
  const K = 12, CL = "CDEFGHIJKLMN", R1 = 11;      // 12 colonnes de modalites C..N, total en O ; donnees lignes 11-22

  // ---- En-tete et selecteurs ----
  s.getRange("A1").setValue("TABLEAU CROISÉ + TEST DU KHI-DEUX (temps réel)").setFontSize(14).setFontWeight("bold");
  const sel = [["Variable en LIGNE", defL], ["Variable en COLONNE", defC], ["Filtre ville", "Toutes"], ["Filtre cible (Q1)", "Toutes"]];
  s.getRange(3, 1, 4, 2).setValues(sel);
  s.getRange("A3:A6").setFontWeight("bold");
  s.getRange("B3:B6").setBackground("#FFF2CC").setFontWeight("bold");
  ["B3:H3", "B4:H4", "B5:D5", "B6:D6"].forEach(function (a) { s.getRange(a).merge(); });
  const vListe = SpreadsheetApp.newDataValidation().requireValueInRange(ss.getRange(LISTE), true).setAllowInvalid(false).build();
  s.getRange("B3").setDataValidation(vListe); s.getRange("B4").setDataValidation(vListe);
  s.getRange("B5").setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(["Toutes"].concat(ZONES.map(function (z) { return z.libelle; })), true).build());
  s.getRange("B6").setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(["Toutes"].concat(libQ1), true).build());
  s.getRange("A7").setValue("Base : fiches valides (hors REJETE), hors non-réponses et NSP. Choisissez les variables dans les cases jaunes.")
    .setFontStyle("italic").setFontColor("#666666");

  // cellules techniques (colonne AA, masquee)
  s.getRange("AA3:AA6").setFormulas([
    ["=IFERROR(INDEX(" + CODES + ",MATCH($B$3," + LISTE + ",0)),\"\")"],
    ["=IFERROR(INDEX(" + CODES + ",MATCH($B$4," + LISTE + ",0)),\"\")"],
    ['=IF($B$5="Toutes","<>",' + ZONES.slice(0, -1).map(function (z) { return 'IF($B$5="' + z.libelle + '",' + z.code + ','; }).join("") +
      ZONES[ZONES.length - 1].code + ")".repeat(ZONES.length - 1) + ")"],
    ['=IF($B$6="Toutes","<>",IFERROR(INDEX(VARS_CROIS!$C$' + rQ1 + ':$N$' + rQ1 + ',1,MATCH($B$6,VARS_CROIS!$O$' + rQ1 + ':$Z$' + rQ1 + ',0)),"<>"))']
  ]);

  function codeLigne(i) { return "=IFERROR(INDEX(" + MCODES + ",MATCH($AA$3," + CODES + ",0)," + (i + 1) + "),\"\")"; }
  function libLigne(i) { return '=IF($A' + (R1 + i) + '="","",IFERROR(INDEX(' + MLIBS + ',MATCH($AA$3,' + CODES + ',0),' + (i + 1) + '),""))'; }

  // ---- Bloc 1 : EFFECTIFS (codes col. ligne 9, libelles ligne 10, donnees 11-22, total 23) ----
  const RT = R1 + K;
  s.getRange("A8").setValue("1. EFFECTIFS").setFontWeight("bold").setBackground("#D9E1F2");
  const l9 = [], l10 = [];
  for (let j = 0; j < K; j++) {
    l9.push("=IFERROR(INDEX(" + MCODES + ",MATCH($AA$4," + CODES + ",0)," + (j + 1) + "),\"\")");
    l10.push('=IF(' + CL[j] + '$9="","",IFERROR(INDEX(' + MLIBS + ',MATCH($AA$4,' + CODES + ',0),' + (j + 1) + '),""))');
  }
  s.getRange(9, 3, 1, K).setFormulas([l9]).setFontColor("#999999").setFontSize(8);
  s.getRange(10, 3, 1, K).setFormulas([l10]);
  s.getRange("A10:B10").setValues([["code", "↓ ligne  /  colonne →"]]);
  s.getRange("O10").setValue("TOTAL");
  styleEntete_(s.getRange(10, 1, 1, 15)); s.getRange(10, 1, 1, 15).setWrap(true);
  const b1 = [];
  for (let i = 0; i < K; i++) {
    const r = R1 + i, row = [codeLigne(i), libLigne(i)];
    for (let j = 0; j < K; j++) {
      row.push('=IF(OR($A' + r + '="",' + CL[j] + '$9=""),"",COUNTIFS(' + ROWD + ',$A' + r + ',' + COLD + ',' + CL[j] + '$9,' +
               ZON + ',$AA$5,' + CIB + ',$AA$6,' + STA + ',"<>REJETE"))');
    }
    row.push('=IF($A' + r + '="","",SUM(C' + r + ':N' + r + '))');
    b1.push(row);
  }
  s.getRange(R1, 1, K, 15).setFormulas(b1);
  const tot = ["", "TOTAL"];
  for (let j = 0; j < K; j++) tot.push('=IF(' + CL[j] + '$9="","",SUM(' + CL[j] + R1 + ':' + CL[j] + (RT - 1) + '))');
  tot.push("=SUM(O" + R1 + ":O" + (RT - 1) + ")");
  s.getRange(RT, 1, 1, 15).setValues([tot]).setFontWeight("bold");

  // ---- Bloc 2 : % COLONNE ----
  function bloc(titre, r0, fCell, fTot, fTotLigne, fTotTot) {
    s.getRange(r0, 1).setValue(titre).setFontWeight("bold").setBackground("#D9E1F2");
    const h = ["code", "↓ ligne  /  colonne →"];
    for (let j = 0; j < K; j++) h.push("=" + CL[j] + "$10");
    h.push("TOTAL");
    s.getRange(r0 + 1, 1, 1, 15).setValues([h]); styleEntete_(s.getRange(r0 + 1, 1, 1, 15)); s.getRange(r0 + 1, 1, 1, 15).setWrap(true);
    const d = [];
    for (let i = 0; i < K; i++) {
      const src = R1 + i, row = ["=$A" + src, "=$B" + src];
      for (let j = 0; j < K; j++) row.push(fCell(CL[j], src));
      row.push(fTot(src));
      d.push(row);
    }
    s.getRange(r0 + 2, 1, K, 15).setValues(d);
    const t = ["", "TOTAL"];
    for (let j = 0; j < K; j++) t.push(fTotLigne(CL[j]));
    t.push(fTotTot);
    s.getRange(r0 + 2 + K, 1, 1, 15).setValues([t]).setFontWeight("bold");
    s.getRange(r0 + 2, 3, K + 1, 13).setNumberFormat("0.0%");
    return r0 + 2;
  }
  const R2 = bloc("2. % EN COLONNE (profil de chaque colonne — lecture verticale)", 26,
    function (c, r) { return '=IF(OR($A' + r + '="",' + c + '$9=""),"",IF(N(' + c + '$' + RT + ')=0,0,' + c + r + '/' + c + '$' + RT + '))'; },
    function (r) { return '=IF($A' + r + '="","",IF($O$' + RT + '=0,0,O' + r + '/$O$' + RT + '))'; },
    function (c) { return '=IF(' + c + '$9="","",IF(N(' + c + '$' + RT + ')=0,0,1))'; },
    '=IF($O$' + RT + '=0,0,1)');
  const R3 = bloc("3. % EN LIGNE (profil de chaque ligne — lecture horizontale)", 43,
    function (c, r) { return '=IF(OR($A' + r + '="",' + c + '$9=""),"",IF(N($O' + r + ')=0,0,' + c + r + '/$O' + r + '))'; },
    function (r) { return '=IF($A' + r + '="","",IF(N($O' + r + ')=0,0,1))'; },
    function (c) { return '=IF(' + c + '$9="","",IF($O$' + RT + '=0,0,' + c + '$' + RT + '/$O$' + RT + '))'; },
    '=IF($O$' + RT + '=0,0,1)');

  // ---- Blocs techniques : effectifs theoriques et contributions (lignes masquees) ----
  const RE = 72, RC = 86;
  s.getRange(RE - 1, 1).setValue("Effectifs théoriques (calcul du test)").setFontStyle("italic");
  s.getRange(RC - 1, 1).setValue("Contributions au khi-deux (calcul du test)").setFontStyle("italic");
  const ex = [], co = [];
  for (let i = 0; i < K; i++) {
    const r = R1 + i, e = [], c = [];
    for (let j = 0; j < K; j++) {
      const E = "(N($O" + r + ")*N(" + CL[j] + "$" + RT + ")/$O$" + RT + ")";
      e.push('=IF(OR($A' + r + '="",' + CL[j] + '$9="",$O$' + RT + '=0),"",' + E + ')');
      c.push('=IF(OR($A' + r + '="",' + CL[j] + '$9="",$O$' + RT + '=0),0,IF(' + E + '=0,0,(' + CL[j] + r + '-' + E + ')^2/' + E + '))');
    }
    ex.push(e); co.push(c);
  }
  s.getRange(RE, 3, K, K).setFormulas(ex);
  s.getRange(RC, 3, K, K).setFormulas(co);
  const EXP = "C" + RE + ":N" + (RE + K - 1), CON = "C" + RC + ":N" + (RC + K - 1);

  // ---- Bloc 4 : TEST STATISTIQUE ----
  const RS = 60;
  s.getRange(RS, 1).setValue("4. TEST D'INDÉPENDANCE DU KHI-DEUX").setFontWeight("bold").setBackground("#D9E1F2");
  const nbL = 'COUNTIF(O' + R1 + ':O' + (RT - 1) + ',">0")', nbC = 'COUNTIF(C' + RT + ':N' + RT + ',">0")';
  const test = [
    ["Base (N)", "=O" + RT],
    ["Khi-deux", "=SUM(" + CON + ")"],
    ["Degrés de liberté", "=MAX(0,(" + nbL + "-1)*(" + nbC + "-1))"],
    ["p-value", '=IF(C' + (RS + 3) + '<1,"",CHISQ.DIST.RT(C' + (RS + 2) + ',C' + (RS + 3) + '))'],
    ["V de Cramér (intensité, 0 à 1)", '=IF(OR(C' + (RS + 1) + '=0,C' + (RS + 3) + '<1),"",SQRT(C' + (RS + 2) + '/(C' + (RS + 1) + '*(MIN(' + nbL + ',' + nbC + ')-1))))'],
    ["% de cases à effectif théorique < 5", '=IFERROR(COUNTIFS(' + EXP + ',">0",' + EXP + ',"<5")/COUNTIF(' + EXP + ',">0"),"")'],
    ["CONCLUSION", '=IF(C' + (RS + 1) + '<30,"⚠ Base insuffisante (moins de 30 fiches) : ne pas conclure",IF(C' + (RS + 3) +
      '<1,"— tableau à une seule modalité : test impossible",IF(C' + (RS + 4) + '<0.05,"✔ Lien SIGNIFICATIF entre les deux variables (p < 5 %)","✘ Pas de lien significatif (p ≥ 5 %) : différences probablement dues au hasard")&IF(N(C' +
      (RS + 6) + ')>0.2," — ⚠ prudence : plus de 20 % de cases à effectif théorique < 5 (regrouper des modalités)","")))'],
    ["Intensité du lien (repère)", '=IF(C' + (RS + 5) + '="","",IF(C' + (RS + 5) + '<0.1,"négligeable",IF(C' + (RS + 5) + '<0.2,"faible",IF(C' + (RS + 5) + '<0.3,"modérée","forte"))))']
  ];
  s.getRange(RS + 1, 2, test.length, 2).setValues(test);
  s.getRange(RS + 1, 2, test.length, 1).setFontWeight("bold");
  s.getRange("C" + (RS + 2)).setNumberFormat("0.00");
  s.getRange("C" + (RS + 4)).setNumberFormat("0.0000");
  s.getRange("C" + (RS + 5)).setNumberFormat("0.000");
  s.getRange("C" + (RS + 6)).setNumberFormat("0%");
  s.getRange("C" + (RS + 7) + ":N" + (RS + 7)).merge().setFontWeight("bold").setWrap(true);
  s.setRowHeight(RS + 7, 36);

  // ---- Mises en forme ----
  const regles = [
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER(C' + R2 + '),C' + R2 + '-$O' + R2 + '>=0.1)')
      .setBackground("#B6D7A8").setRanges([s.getRange(R2, 3, K, K)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER(C' + R2 + '),C' + R2 + '-$O' + R2 + '<=-0.1)')
      .setBackground("#F4CCCC").setRanges([s.getRange(R2, 3, K, K)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("✔").setBackground("#D9EAD3").setRanges([s.getRange("C" + (RS + 7))]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("✘").setBackground("#EFEFEF").setRanges([s.getRange("C" + (RS + 7))]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("⚠").setBackground("#FCE5CD").setRanges([s.getRange("C" + (RS + 7))]).build()
  ];
  s.setConditionalFormatRules(regles);
  s.getRange("A" + (R2 + K + 2)).setValue("Vert = modalité sur-représentée dans cette colonne (≥ +10 points vs total) ; rouge = sous-représentée (≤ -10 points).")
    .setFontStyle("italic").setFontColor("#666666").setFontSize(9);
  s.setColumnWidth(1, 45); s.setColumnWidth(2, 230);
  for (let j = 3; j <= 15; j++) s.setColumnWidth(j, 92);
  s.hideColumns(27);
  s.hideRows(RE - 1, RC + K - RE + 1);
  s.setFrozenRows(7);

  // Graphique : % en colonne, barres empilees
  const ch = s.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(s.getRange(R2 - 1, 2, K + 1, 13))
    .setTransposeRowsAndColumns(true).setNumHeaders(1)
    .setOption("isStacked", true).setOption("title", "Profil en % par colonne")
    .setOption("legend", { position: "right" })
    .setPosition(8, 17, 0, 0).build();
  s.insertChart(ch);
}


// =====================================================================
// 14. MOTEUR D'ANALYSES "FACON SPSS" (alternative en cas d'indisponibilite)
//     Onglet PLAN_ANALYSES : une ligne = une analyse (type, variables,
//     filtres). Case B2 cochee => (re)calcul de toutes les lignes ACTIF=Oui,
//     chaque resultat dans son onglet Axx_...
//     Types : FREQUENCES | CROISEMENT | REPONSES_MULTIPLES | MOYENNES
//     Options globales : ponderation (B3) et niveau de confiance (B4).
// =====================================================================
const TYPES_ANALYSE = ["FREQUENCES", "CROISEMENT", "REPONSES_MULTIPLES", "MOYENNES", "REGRESSION", "LOGISTIQUE", "AFC", "ACM", "ACP", "TYPOLOGIE"];
const TESTS_Z = ["Proportion commune (pooled)", "Proportions séparées (non pooled)"];
const MODES_POND = ["Identique SPSS (effectifs pondérés arrondis)", "Base effective (plus rigoureux)"];
const PONDERATIONS = ["Aucune", "Ville (poids réels)", "Ville × cible (quotas)"];
const CONFIANCES = ["95 %", "90 %", "99 %"];
const PLAN_DEFAUT = [
  ["FREQUENCES", "VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME", "", "Profil des répondants"],
  ["FREQUENCES", "FREQACHA LIEACHPR MONMOYAC PAIEPRIV", "", "Habitudes d'achat"],
  ["REPONSES_MULTIPLES", "PRODACHE", "CODEZONE", "Produits achetés, par ville"],
  ["CROISEMENT", "MAACPLSO", "CODEZONE", "Marque achetée le plus souvent, par ville"],
  ["CROISEMENT", "MAACPLSO", "VOUSETES", "Marque achetée le plus souvent, par cible"],
  ["CROISEMENT", "GAACPLSO", "VOUSETES", "Gamme achetée, par cible"],
  ["CROISEMENT", "ORIGPRIV", "VOUSETES", "Origine privilégiée, par cible"],
  ["CROISEMENT", "PRINFREI", "CODEZONE", "Principal frein, par ville"],
  ["CROISEMENT", "CANAPREF", "VOUSETES", "Canal préféré, par cible"],
  ["CROISEMENT", "PRETACLI", "AGEREPON", "Disposition à acheter en ligne, par âge"],
  ["MOYENNES", "IMPOMARQ IMSECSAV ORINFACH CRACPRCO", "VOUSETES", "Scores moyens (échelles), par cible"],
  ["REPONSES_MULTIPLES", "RENFFIDE", "VOUSETES", "Leviers de fidélité, par cible"],
  ["FREQUENCES", "MEQUAFIA MEILPRIX SUACMOGA DUGAJUAC", "", "Perceptions et attentes"],
  ["CROISEMENT", "DEJACHLI", "SEXMAFEM", "Achat en ligne déjà effectué, par genre (tableau 2×2 : Fisher)"],
  ["REGRESSION", "IMPOMARQ", "VOUSETES AGEREPON REVMENME CODEZONE PRACSOLA", "Qu'est-ce qui explique l'importance accordée à la marque ?"],
  ["LOGISTIQUE", "PRETACLI=1", "AGEREPON VOUSETES CODEZONE REVMENME DEJACHLI", "Qui est prêt à acheter en ligne ? (Oui vs Peut-être/Non)"],
  ["AFC", "MAACPLSO", "VOUSETES", "Carte marques × cibles"],
  ["ACM", "VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF", "", "Carte du marché (ACM)"],
  ["ACP", "IMPOMARQ ORINFACH CRACPRCO IMSECSAV FIMEFOUR SUACMOGA", "", "Dimensions sous-jacentes des attitudes (ACP + varimax)"],
  ["TYPOLOGIE", "VOUSETES AGEREPON LIEACHPR GAACPLSO ORIGPRIV PRIOPRIN CANAPREF", "AUTO", "Segmentation des acheteurs (typologie)"],
  // V3 : bloc gammes (Q19 a Q24) — A21 a A24, memes numeros que le script SPSS 2
  ["FREQUENCES", "DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA ECQUHABA", "", "Perception des gammes (Q19 à Q24)"],
  ["FREQUENCES", "PXHAUTGA PXMOYEGA PXBASGAM", "", "Fourchettes de prix associées à chaque gamme (Q23)"],
  ["CROISEMENT", "DEAVHAGA CAAVBAGA", "VOUSETES", "Définition du haut et du bas de gamme, par cible"],
  ["CROISEMENT", "ORASHAGA ORASBAGA", "CODEZONE", "Origine associée au haut / bas de gamme, par ville"]
];
const PLAN_L0 = 7, PLAN_NLIGNES = 40;
const LETTRES = "ABCDEFGHIJKLMNOP";

// ---------- Fonctions statistiques (sans service Google) ----------
function erfc_(x) {                                   // Numerical Recipes erfcc, erreur relative < 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
function pNormale2_(z) { return erfc_(Math.abs(z) / Math.SQRT2); }             // p bilateral d'un z
function lnGamma_(x) {                                // Lanczos
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf_(a, b, x) {
  const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betaInc_(a, b, x) {                          // beta incomplete regularisee I_x(a,b)
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lnGamma_(a + b) - lnGamma_(a) - lnGamma_(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf_(a, b, x) / a : 1 - bt * betacf_(b, a, 1 - x) / b;
}
function pStudent2_(t, df) { return betaInc_(df / 2, 0.5, df / (df + t * t)); }   // p bilateral d'un t
function fisher2x2_(a, b, c, d) {                     // test exact de Fisher bilateral (methode R / SPSS)
  const n = a + b + c + d, r1 = a + b, c1 = a + c;
  const lf = function (k) { return lnGamma_(k + 1); };
  const lp = function (x) { return lf(r1) + lf(n - r1) + lf(c1) + lf(n - c1) - lf(n) - lf(x) - lf(r1 - x) - lf(c1 - x) - lf(n - r1 - c1 + x); };
  const lo = Math.max(0, r1 + c1 - n), hi = Math.min(r1, c1), p0 = lp(a);
  let p = 0;
  for (let x = lo; x <= hi; x++) { const v = lp(x); if (v <= p0 + 1e-7) p += Math.exp(v); }
  return Math.min(1, p);
}
function zCritique_(alpha) { return alpha <= 0.01 ? 2.5758293 : alpha >= 0.10 ? 1.6448536 : 1.9599640; }

/** Lettres de comparaison de proportions de colonnes (z, proportion commune, Bonferroni par ligne).
 *  x[j] = effectif "oui" de la colonne j, n[j] = base de la colonne j. Retourne un tableau de chaines. */
function lettresProportions_(x, n, alpha, pooled) {
  const k = x.length, out = x.map(function () { return ""; });
  const act = []; for (let j = 0; j < k; j++) if (n[j] > 0) act.push(j);
  const m = act.length * (act.length - 1) / 2;
  if (m < 1) return out;
  act.forEach(function (i) {
    act.forEach(function (j) {
      if (i === j) return;
      const pi = x[i] / n[i], pj = x[j] / n[j];
      if (pi <= pj) return;
      const p = (x[i] + x[j]) / (n[i] + n[j]);
      const se = pooled === false ? Math.sqrt(pi * (1 - pi) / n[i] + pj * (1 - pj) / n[j])
                                  : Math.sqrt(p * (1 - p) * (1 / n[i] + 1 / n[j]));
      if (!(se > 0)) return;
      const pv = Math.min(1, pNormale2_((pi - pj) / se) * m);
      if (pv < alpha) out[i] += LETTRES[j];
    });
  });
  return out;
}

// ---------- Metadonnees ----------
function metaVariables_() {
  const m = {};
  colonnesMasque_().forEach(function (c) {
    m[c.code] = { code: c.code, label: c.label, valeurs: c.valeurs || null, mesure: c.mesure || null, groupe: c.groupe || null };
  });
  ITEMS.filter(function (it) { return it.type === "multi"; }).forEach(function (it) {
    m[it.code] = { code: it.code, label: it.q, items: it.sousItems.map(function (s) { return [s[0], s[1]]; }) };
    it.sousItems.forEach(function (s) { if (m[s[0]]) m[s[0]].court = s[1]; });
  });
  return m;
}
function valide_(v) { return typeof v === "number" && v < 97; }
function sommeW_(rows) { return rows.reduce(function (s, o) { return s + o._w; }, 0); }
function arr_(x, d) { return Math.round(x * Math.pow(10, d)) / Math.pow(10, d); }

// ---------- Lecture de la base codee ----------
function lireBase_(ss) {
  const sh = ss.getSheetByName("MASQUE_DEPOUILLEMENT");
  const codes = colonnesMasque_().map(function (c) { return c.code; });
  const p0 = CONFIG.PREMIERE_LIGNE_DONNEES, n = sh.getLastRow() - p0 + 1;
  if (n <= 0) return [];
  const iS = codes.indexOf("STATUTQC"), iD = codes.indexOf("DATEENQU");
  return sh.getRange(p0, 1, n, codes.length).getValues()
    .filter(function (l) { return l[0] && l[iS] !== "REJETE"; })
    .map(function (l) {
      const o = { _w: 1 };
      codes.forEach(function (c, i) { o[c] = l[i]; });
      const d = l[iD];
      o._jour = d instanceof Date ? Utilities.formatDate(d, CONFIG.FUSEAU, "yyyy-MM-dd") : String(d).substr(0, 10);
      return o;
    });
}

// ---------- Ponderation (poids normalises : somme des poids = N, comme SPSS) ----------
/** cibles : { cle -> part cible } ; cleDe(o) -> cle de la fiche. Fiches hors cles : poids 1. */
function appliquerPoids_(base, cibles, cleDe) {
  const N = base.length; if (!N) return { info: "" };
  const obs = {};
  base.forEach(function (o) { const k = cleDe(o); if (k in cibles) obs[k] = (obs[k] || 0) + 1; });
  const nIn = Object.keys(obs).reduce(function (s, k) { return s + obs[k]; }, 0);
  const tot = Object.keys(obs).reduce(function (s, k) { return s + (cibles[k] || 0); }, 0);
  const sansFiche = Object.keys(cibles).filter(function (k) { return cibles[k] > 0 && !obs[k]; });
  base.forEach(function (o) {
    const k = cleDe(o);
    o._w = (k in obs && tot > 0) ? (cibles[k] / tot) / (obs[k] / nIn) : 1;
  });
  const s = sommeW_(base), f = N / s;
  base.forEach(function (o) { o._w *= f; });
  const s2 = base.reduce(function (a, o) { return a + o._w * o._w; }, 0);
  const wmax = Math.max.apply(null, base.map(function (o) { return o._w; }));
  const wmin = Math.min.apply(null, base.map(function (o) { return o._w; }));
  return { neff: N * N / s2, wmin: wmin, wmax: wmax, sansFiche: sansFiche };
}

function ponderer_(base, mode, ss) {
  base.forEach(function (o) { o._w = 1; });
  if (mode === PONDERATIONS[0] || !base.length) return "Aucune pondération";
  let r;
  if (mode === PONDERATIONS[1]) {
    const sh = ss.getSheetByName("POIDS");
    if (!sh) throw new Error("Onglet POIDS absent : relancez installerAnalyses()");
    const v = sh.getRange(5, 1, ZONES.length, 3).getValues();
    const cibles = {};
    v.forEach(function (l) { cibles[Number(l[0])] = Number(l[2]) || 0; });
    r = appliquerPoids_(base, cibles, function (o) { return o.CODEZONE; });
  } else {
    const sh = ss.getSheetByName("CIBLES");
    if (!sh) throw new Error("Onglet CIBLES absent : lancez creerSuiviCibles() pour les quotas");
    const v = sh.getRange(5, 1, 12, 6).getValues();
    const cibles = {};
    for (let i = 0; i < v.length && typeof v[i][0] === "number"; i++) {     // lignes de quotas uniquement (s'arrete au TOTAL)
      const l = v[i];
      ZONES.forEach(function (z, k) { cibles[z.code + "|" + l[0]] = Number(l[3 + k]) || 0; });
    }
    if (!Object.keys(cibles).length) throw new Error("Quotas introuvables dans l'onglet CIBLES");
    r = appliquerPoids_(base, cibles, function (o) { return o.CODEZONE + "|" + o.VOUSETES; });
  }
  return mode + " — N effectif = " + Math.round(r.neff) + " (perte de précision due à la pondération), poids de " +
    arr_(r.wmin, 2) + " à " + arr_(r.wmax, 2) + (r.sansFiche.length ? " — ⚠ cellules cibles sans aucune fiche : " + r.sansFiche.join(", ") : "");
}

function filtrer_(base, p, ss, meta) {
  let b = base;
  if (p.ville !== "Toutes") {
    const z = ZONES.filter(function (x) { return x.libelle === p.ville; })[0];
    if (!z) throw new Error("Filtre ville inconnu : " + p.ville);
    b = b.filter(function (o) { return o.CODEZONE === z.code; });
  }
  if (p.cible !== "Toutes") {
    const c = meta.VOUSETES.valeurs.filter(function (x) { return String(x[1]) === p.cible; })[0];
    if (!c) throw new Error("Filtre cible inconnu : " + p.cible);
    b = b.filter(function (o) { return o.VOUSETES === c[0]; });
  }
  if (p.jour !== "Tous") {
    const r = ss.getRangeByName("P_" + p.jour);
    const v = r ? r.getValue() : "";
    if (!(v instanceof Date)) throw new Error("Date de " + p.jour + " non saisie dans PARAMETRES");
    const j = Utilities.formatDate(v, CONFIG.FUSEAU, "yyyy-MM-dd");
    b = b.filter(function (o) { return o._jour === j; });
  }
  return b;
}

// ---------- Objet de sortie (tableau + styles, ecrit en une fois) ----------

// ---------- Khi-deux, G2, V, residus ajustes (effectifs eventuellement ponderes) ----------
function khiDeux_(O) {
  const R = O.length, C = O[0].length;
  const rt = O.map(function (l) { return l.reduce(function (s, x) { return s + x; }, 0); });
  const ct = []; for (let j = 0; j < C; j++) { let s = 0; for (let i = 0; i < R; i++) s += O[i][j]; ct.push(s); }
  const N = rt.reduce(function (s, x) { return s + x; }, 0);
  const res = { N: N, rt: rt, ct: ct, chi2: 0, g2: 0, ddl: 0, V: null, nFaible: 0, nCases: 0, minE: null, z: [], yates: null, ri: [], cj: [] };
  for (let i = 0; i < R; i++) if (rt[i] > 0) res.ri.push(i);
  for (let j = 0; j < C; j++) if (ct[j] > 0) res.cj.push(j);
  const nr = res.ri.length, nc = res.cj.length;
  res.ddl = Math.max(0, (nr - 1) * (nc - 1));
  for (let i = 0; i < R; i++) {
    const zl = [];
    for (let j = 0; j < C; j++) {
      if (!N || !rt[i] || !ct[j]) { zl.push(""); continue; }
      const E = rt[i] * ct[j] / N, o = O[i][j];
      res.chi2 += (o - E) * (o - E) / E;
      if (o > 0) res.g2 += 2 * o * Math.log(o / E);
      res.nCases++; if (E < 5) res.nFaible++;
      res.minE = res.minE === null ? E : Math.min(res.minE, E);
      const den = E * (1 - rt[i] / N) * (1 - ct[j] / N);
      zl.push(den > 0 ? (o - E) / Math.sqrt(den) : "");
    }
    res.z.push(zl);
  }
  if (res.ddl > 0 && N > 0) res.V = Math.sqrt(res.chi2 / (N * (Math.min(nr, nc) - 1)));
  if (nr === 2 && nc === 2) {                                  // correction de continuite de Yates (2x2)
    let y = 0;
    res.ri.forEach(function (i) { res.cj.forEach(function (j) {
      const E = rt[i] * ct[j] / N, d = Math.max(0, Math.abs(O[i][j] - E) - 0.5); y += d * d / E; }); });
    res.yates = y;
  }
  return res;
}
function intensiteV_(v) { return v === null ? "" : (v < 0.1 ? "négligeable" : v < 0.2 ? "faible" : v < 0.3 ? "modérée" : "forte"); }
function pLitteral_(stat, ddl) { return ddl > 0 ? "=CHISQ.DIST.RT(" + stat.toFixed(8) + "," + ddl + ")" : ""; }


// ---------- 1. FREQUENCES (= SPSS FREQUENCIES) + marge d'erreur ----------

// ---------- 2. CROISEMENT (= SPSS CROSSTABS + tests de colonnes A/B/C + Fisher) ----------

// ---------- 3. REPONSES MULTIPLES (= SPSS MULT RESPONSE + tests de colonnes) ----------
function itemsGroupe_(vars, meta) {
  if (vars.length === 1 && meta[vars[0]] && meta[vars[0]].items) return { label: meta[vars[0]].label, items: meta[vars[0]].items };
  const items = vars.map(function (c) {
    if (!meta[c] || !meta[c].groupe) throw new Error(c + " n'est pas un item de réponses multiples (ex. PRODACHE, RENFFIDE ou PRACCABL…)");
    return [c, meta[c].court || meta[c].label];
  });
  return { label: "Ensemble " + vars.join(", "), items: items };
}

// ---------- 4. MOYENNES (= SPSS MEANS / ONEWAY + post-hoc Bonferroni) ----------

// ---------- Onglets de parametrage ----------
function creerPlanAnalyses_(ss) {
  let sh = ss.getSheetByName("PLAN_ANALYSES");
  if (sh) { parametresPlan_(sh); return sh; }                 // ne jamais ecraser le plan de l'utilisateur
  sh = ss.insertSheet("PLAN_ANALYSES", ss.getSheets().length);
  sh.getRange("A1").setValue("PLAN D'ANALYSES — moteur statistique « façon SPSS »").setFontSize(15).setFontWeight("bold").setFontColor("#1F4E78");
  sh.getRange("A2").setValue("▶ LANCER LES ANALYSES :").setFontWeight("bold").setHorizontalAlignment("right");
  sh.getRange("B2").insertCheckboxes().setBackground("#FFF2CC");
  sh.getRange("C2").setValue("Cochez la case : toutes les lignes ACTIF = Oui sont (re)calculées (≈ 10 à 60 s). Codes des variables : onglet LISTE_VARIABLES.")
    .setFontStyle("italic");
  parametresPlan_(sh);
  const h = ["N°", "ACTIF", "TYPE", "VARIABLE(S) EN LIGNE (codes séparés par un espace)", "VARIABLE EN COLONNE / DE GROUPE",
             "FILTRE VILLE", "FILTRE CIBLE", "FILTRE JOUR", "TITRE (facultatif)", "RÉSULTAT", "MESSAGE"];
  sh.getRange(PLAN_L0 - 1, 1, 1, h.length).setValues([h]);
  styleEntete_(sh.getRange(PLAN_L0 - 1, 1, 1, h.length));
  const rows = [];
  for (let i = 0; i < PLAN_NLIGNES; i++) {
    const d = PLAN_DEFAUT[i];
    rows.push([i + 1, d ? "Oui" : "Non", d ? d[0] : "", d ? d[1] : "", d ? d[2] : "", "Toutes", "Toutes", "Tous", d ? d[3] : "", "", ""]);
  }
  sh.getRange(PLAN_L0, 1, PLAN_NLIGNES, h.length).setValues(rows);
  const q1 = ITEMS.filter(function (it) { return it.code === "VOUSETES"; })[0];
  const cibles = q1.choix.map(function (c) { return c[1]; }).concat(q1.autre ? [q1.autre.libelle] : []);
  const dv = function (liste) { return SpreadsheetApp.newDataValidation().requireValueInList(liste, true).build(); };
  sh.getRange(PLAN_L0, 2, PLAN_NLIGNES, 1).setDataValidation(dv(["Oui", "Non"]));
  sh.getRange(PLAN_L0, 6, PLAN_NLIGNES, 1).setDataValidation(dv(["Toutes"].concat(ZONES.map(function (z) { return z.libelle; }))));
  sh.getRange(PLAN_L0, 7, PLAN_NLIGNES, 1).setDataValidation(dv(["Toutes"].concat(cibles)));
  sh.getRange(PLAN_L0, 8, PLAN_NLIGNES, 1).setDataValidation(dv(["Tous", "J1", "J2", "J3"]));
  sh.getRange(PLAN_L0, 2, PLAN_NLIGNES, 8).setBackground("#FFFBEA");
  [45, 60, 160, 330, 200, 100, 150, 90, 280, 200, 320].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(PLAN_L0 - 1);
  return sh;
}

function parametresPlan_(sh) {
  const dv = function (liste) { return SpreadsheetApp.newDataValidation().requireValueInList(liste, true).build(); };
  sh.getRange("A3:A5").setValues([["Pondération :"], ["Niveau de confiance :"], ["Test des colonnes (z) :"]]).setFontWeight("bold").setHorizontalAlignment("right");
  sh.getRange("D2").setValue("Calcul pondéré :").setFontWeight("bold").setHorizontalAlignment("right");
  if (MODES_POND.indexOf(String(sh.getRange("E2").getValue())) < 0) sh.getRange("E2").setValue(MODES_POND[0]);
  sh.getRange("E2").setDataValidation(dv(MODES_POND)).setBackground("#FFF2CC").setFontWeight("bold");
  if (TESTS_Z.indexOf(String(sh.getRange("B5").getValue())) < 0) sh.getRange("B5").setValue(TESTS_Z[0]);
  sh.getRange("B5").setDataValidation(dv(TESTS_Z)).setBackground("#FFF2CC").setFontWeight("bold");
  sh.getRange(PLAN_L0, 3, PLAN_NLIGNES, 1).setDataValidation(dv(TYPES_ANALYSE));
  if (PONDERATIONS.indexOf(String(sh.getRange("B3").getValue())) < 0) sh.getRange("B3").setValue(PONDERATIONS[0]);
  if (CONFIANCES.indexOf(String(sh.getRange("B4").getValue())) < 0) sh.getRange("B4").setValue(CONFIANCES[0]);
  sh.getRange("B3").setDataValidation(dv(PONDERATIONS)).setBackground("#FFF2CC").setFontWeight("bold");
  sh.getRange("B4").setDataValidation(dv(CONFIANCES)).setBackground("#FFF2CC").setFontWeight("bold");
  sh.getRange("C5").setValue("Proportion commune = test z classique ; proportions séparées = variante alternative. Comparez une fois avec une sortie SPSS pour choisir.")
    .setFontColor("#666666").setFontSize(9);
  sh.getRange("C3").setValue("Ville = poids réels des villes (onglet POIDS) · Ville × cible = redressement sur les quotas (onglet CIBLES). S'applique à toutes les analyses.")
    .setFontColor("#666666").setFontSize(9);
  sh.getRange("C4").setValue("Types : FREQUENCES · CROISEMENT · REPONSES_MULTIPLES · MOYENNES · REGRESSION (D = à expliquer, E = explicatives) · LOGISTIQUE (D = VAR=code) · AFC (D × E) · ACM (D) · ACP (D) · TYPOLOGIE (D ; E = nb de classes ou AUTO)")
    .setFontColor("#666666").setFontSize(9);
}

function creerPoids_(ss) {
  let sh = ss.getSheetByName("POIDS");
  if (sh) return sh;
  sh = ss.insertSheet("POIDS", ss.getSheets().length);
  sh.getRange("A1").setValue("PONDÉRATION « VILLE » — poids réels de chaque ville dans le marché").setFontSize(13).setFontWeight("bold");
  sh.getRange("A2").setValue("Saisissez en colonne C la part réelle de chaque ville (ex. part des points de vente, du chiffre d'affaires ou de la population). " +
    "Par défaut = part dans l'échantillon (pondération sans effet).").setFontStyle("italic").setFontColor("#666666").setWrap(true);
  sh.getRange("A2:E2").merge(); sh.setRowHeight(2, 40);
  sh.getRange(4, 1, 1, 5).setValues([["CODE ZONE", "VILLE", "PART RÉELLE (à saisir)", "PART DANS L'ÉCHANTILLON (objectif)", "SOURCE DE LA PART RÉELLE"]]);
  styleEntete_(sh.getRange(4, 1, 1, 5));
  const tot = ENQUETEURS_INIT.length;
  sh.getRange(5, 1, ZONES.length, 5).setValues(ZONES.map(function (z) {
    const n = ENQUETEURS_INIT.filter(function (e) { return e[1] === z.id; }).length;
    return [z.code, z.libelle, n / tot, n / tot, ""];
  }));
  sh.getRange(5, 3, ZONES.length, 2).setNumberFormat("0.0%");
  sh.getRange(5, 3, ZONES.length, 1).setBackground("#FFF2CC");
  sh.getRange(5, 5, ZONES.length, 1).setBackground("#FFF2CC");
  sh.getRange(5 + ZONES.length, 2, 1, 2).setValues([["TOTAL", "=SUM(C5:C" + (4 + ZONES.length) + ")"]]).setFontWeight("bold");
  sh.getRange(5 + ZONES.length, 3).setNumberFormat("0.0%");
  [90, 140, 180, 240, 300].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  return sh;
}

function creerListeVariables_(ss) {
  let sh = ss.getSheetByName("LISTE_VARIABLES");
  if (sh) supprimerOnglet_(ss, sh);
  sh = ss.insertSheet("LISTE_VARIABLES", ss.getSheets().length);
  const meta = metaVariables_();
  const lignes = [["CODE", "QUESTION", "NATURE", "MODALITÉS (code = libellé)", "UTILISABLE EN"]];
  colonnesMasque_().forEach(function (c) {
    if (c.valeurs && !c.groupe && c.code !== "STATUTQC") {
      lignes.push([c.code, c.label, c.mesure === "ORDINAL" ? "Choix unique — ordinale" : "Choix unique — nominale",
        c.valeurs.map(function (p) { return p[0] + "=" + p[1]; }).join(" ; "),
        c.mesure === "ORDINAL" ? "FREQUENCES, CROISEMENT, MOYENNES (en ligne ou en groupe)" : "FREQUENCES, CROISEMENT, groupe de MOYENNES"]);
    }
  });
  ITEMS.filter(function (it) { return it.type === "multi"; }).forEach(function (it) {
    lignes.push([it.code, it.q, "GROUPE de réponses multiples", it.sousItems.map(function (s) { return s[0] + "=" + s[1]; }).join(" ; "),
      "REPONSES_MULTIPLES (en ligne)"]);
    it.sousItems.forEach(function (s) {
      lignes.push([s[0], meta[s[0]].label, "Item de réponses multiples (1=cité, 0=non cité)", "1=Cité ; 0=Non cité", "CROISEMENT, REPONSES_MULTIPLES"]);
    });
  });
  lignes.push(["DELAIPRE", "Minutes depuis la fiche précédente du même enquêteur", "Numérique (échelle)", "—", "MOYENNES"]);
  sh.getRange(1, 1, lignes.length, 5).setValues(lignes);
  styleEntete_(sh.getRange(1, 1, 1, 5));
  sh.setFrozenRows(1);
  [100, 380, 230, 520, 300].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 4, lignes.length - 1, 1).setWrap(true);
}

// ---------- Execution ----------
function genererAnalyses() {
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || CLASSEUR_ID;
  const ss = SpreadsheetApp.openById(id);
  const plan = ss.getSheetByName("PLAN_ANALYSES");
  if (!plan) throw new Error("Onglet PLAN_ANALYSES absent : lancez d'abord installerAnalyses()");
  parametresPlan_(plan);
  const meta = metaVariables_(), base = lireBase_(ss);
  const mode = String(plan.getRange("B3").getValue()), conf = String(plan.getRange("B4").getValue());
  const cfg = { alpha: conf === "90 %" ? 0.10 : conf === "99 %" ? 0.01 : 0.05, pondere: mode !== PONDERATIONS[0],
                pooled: String(plan.getRange("B5").getValue()) !== TESTS_Z[1],
                modePond: String(plan.getRange("E2").getValue()) === MODES_POND[1] ? "EFFECTIF" : "SPSS" };
  cfg.infoPoids = ponderer_(base, mode, ss);
  const n = Math.max(plan.getLastRow() - PLAN_L0 + 1, 0);
  const lignes = n ? plan.getRange(PLAN_L0, 1, n, 9).getValues() : [];
  const sortie = [];
  let ok = 0, ko = 0;
  lignes.forEach(function (l) {
    const num = l[0], actif = String(l[1]).trim(), type = String(l[2]).trim().toUpperCase();
    if (actif !== "Oui" || !type) { sortie.push(["", actif === "Oui" && !type ? "Type manquant" : ""]); return; }
    try {
      if (TYPES_ANALYSE.indexOf(type) < 0) throw new Error("Type inconnu : " + type);
      const vars = String(l[3]).toUpperCase().split(/[\s,;]+/).filter(function (x) { return x; });
      const cv = String(l[4]).trim().toUpperCase();
      const preds = cv.split(/[\s,;]+/).filter(function (x) { return x; });
      if (!vars.length) throw new Error("Aucune variable en ligne");
      if ((type === "CROISEMENT" || type === "AFC") && !cv) throw new Error(type + " : variable en colonne obligatoire");
      if (["CROISEMENT", "REPONSES_MULTIPLES", "MOYENNES", "AFC"].indexOf(type) >= 0 && preds.length > 1) throw new Error(type + " : une seule variable en colonne E");
      const p = { ville: String(l[5] || "Toutes"), cible: String(l[6] || "Toutes"), jour: String(l[7] || "Tous") };
      const b = filtrer_(base, p, ss, meta);
      const nom = ("A" + ("0" + num).slice(-2) + "_" + type.substr(0, 5) + "_" + vars[0].split("=")[0]).substr(0, 90);
      let sh = ss.getSheetByName(nom);
      if (sh) { sh.getCharts().forEach(function (c) { sh.removeChart(c); }); sh.clear(); }
      else sh = ss.insertSheet(nom, ss.getSheets().length);
      const S = new Sortie_();
      entete_(S, (l[8] ? String(l[8]) : type + " : " + vars.join(" ") + (cv ? " × " + cv : "")), p, b.length, sommeW_(b), cfg,
        syntaxeSPSS_(type, vars, cv, preds, cfg, meta));
      if (type === "FREQUENCES") anaFrequences_(S, b, vars, meta, cfg);
      else if (type === "CROISEMENT") vars.forEach(function (v) { anaCroisement_(S, b, v, cv, meta, cfg); });
      else if (type === "REPONSES_MULTIPLES") anaReponsesMultiples_(S, b, vars, cv, meta, cfg);
      else if (type === "MOYENNES") anaMoyennes_(S, b, vars, cv, meta, cfg);
      else if (type === "REGRESSION") anaRegression_(S, b, vars, preds, meta, cfg);
      else if (type === "LOGISTIQUE") anaLogistique_(S, b, vars, preds, meta, cfg);
      else if (type === "AFC") anaAFC_(S, b, vars, cv, meta, cfg);
      else if (type === "ACM") anaACM_(S, b, vars, meta, cfg);
      else if (type === "ACP") anaACP_(S, b, vars, meta, cfg);
      else anaTypologie_(S, b, vars, cv === "AUTO" ? "" : cv, meta, cfg, ss, nom);
      S.ecrire(sh);
      sh.setColumnWidth(1, 230);
      sh.setColumnWidth(2, type === "FREQUENCES" || type === "LOGISTIQUE" ? 200 : 260);
      sh.setColumnWidth(3, ["CROISEMENT", "REPONSES_MULTIPLES"].indexOf(type) >= 0 ? 200 : 110);
      sh.setFrozenRows(1);
      sortie.push(['=HYPERLINK("#gid=' + sh.getSheetId() + '","→ ' + nom + '")', "OK — " + b.length + " fiches"]);
      ok++;
    } catch (err) {
      sortie.push(["", "ERREUR : " + err.message]);
      ko++;
    }
  });
  if (sortie.length) plan.getRange(PLAN_L0, 10, sortie.length, 2).setValues(sortie);
  plan.getRange("C2").setValue("Dernière exécution : " + Utilities.formatDate(new Date(), CONFIG.FUSEAU, "dd/MM/yyyy HH:mm") +
    " — " + ok + " analyse(s) OK" + (ko ? ", " + ko + " en erreur (voir colonne MESSAGE)" : "") + " — " + cfg.infoPoids + ". Recochez la case pour actualiser.");
  Logger.log(ok + " analyses OK, " + ko + " erreurs. TERMINÉ.");
}

/** Declenche genererAnalyses quand on coche PLAN_ANALYSES!B2. */
function surEditionPlan(e) {
  if (!e || !e.range) return;
  const r = e.range, sh = r.getSheet();
  if (sh.getName() !== "PLAN_ANALYSES" || r.getA1Notation() !== "B2" || String(e.value).toUpperCase() !== "TRUE") return;
  sh.getRange("C2").setValue("⏳ Calcul en cours… ne rien modifier pendant ce temps.");
  SpreadsheetApp.flush();
  try { genererAnalyses(); }
  catch (err) { sh.getRange("C2").setValue("ERREUR : " + err.message); }
  finally { sh.getRange("B2").setValue(false); }
}

/** A LANCER UNE FOIS : cree PLAN_ANALYSES, POIDS, LISTE_VARIABLES, la case a cocher active, puis calcule. */
function installerAnalyses() {
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || CLASSEUR_ID;
  const ss = SpreadsheetApp.openById(id);
  const plan = ss.getSheetByName("PLAN_ANALYSES");
  if (plan && plan.getRange(PLAN_L0 - 1, 1).getValue() !== "N°") {  // ancienne mise en page (1re version) : on la remplace
    supprimerOnglet_(ss, plan);
  }
  const pl = creerPlanAnalyses_(ss);
  completerPlan_(pl);
  creerPoids_(ss);
  creerListeVariables_(ss);
  const deja = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "surEditionPlan"; });
  if (!deja) ScriptApp.newTrigger("surEditionPlan").forSpreadsheet(ss).onEdit().create();
  genererAnalyses();
  Logger.log("Moteur d'analyses installé. TERMINÉ.");
}

/** Facultatif : recalcul automatique toutes les heures pendant le terrain (et arret). */
function activerActualisationHoraire() {
  desactiverActualisationHoraire();
  ScriptApp.newTrigger("genererAnalyses").timeBased().everyHours(1).create();
  Logger.log("Actualisation horaire activée. TERMINÉ.");
}
function desactiverActualisationHoraire() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "genererAnalyses") ScriptApp.deleteTrigger(t);
  });
}

/** Ajoute au plan existant les lignes par defaut des types absents (dans les lignes vides). */
function completerPlan_(sh) {
  const v = sh.getRange(PLAN_L0, 1, PLAN_NLIGNES, 3).getValues();
  const presents = v.map(function (l) { return String(l[2]).toUpperCase(); });
  const vides = []; v.forEach(function (l, i) { if (!String(l[2]).trim()) vides.push(i); });
  PLAN_DEFAUT.forEach(function (d) {
    if (presents.indexOf(d[0]) >= 0 || !vides.length) return;
    const i = vides.shift();
    sh.getRange(PLAN_L0 + i, 2, 1, 8).setValues([["Oui", d[0], d[1], d[2], "Toutes", "Toutes", "Tous", d[3]]]);
    presents.push(d[0]);
  });
}

// =====================================================================
// 15. METHODES MULTIVARIEES (moteur d'analyses, suite)
//     REGRESSION (lineaire multiple) | LOGISTIQUE (binaire) | AFC |
//     ACM | ACP (analyse factorielle + varimax) | TYPOLOGIE (ACM + k-means)
//     Tout est calcule ici, en JavaScript pur (aucune bibliotheque externe).
// =====================================================================

// ---------- Lois de probabilite ----------
function gammaP_(a, x) {                                   // gamma incomplete regularisee P(a,x)
  if (x <= 0) return 0;
  const gln = lnGamma_(a);
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 3e-15) break; }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
}
function pKhi2_(x, ddl) { return ddl > 0 ? Math.max(0, 1 - gammaP_(ddl / 2, x / 2)) : ""; }
function pFisherF_(F, d1, d2) { return (F > 0 && d1 > 0 && d2 > 0) ? betaInc_(d2 / 2, d1 / 2, d2 / (d2 + d1 * F)) : ""; }

// ---------- Algebre lineaire ----------
function inverse_(A) {                                     // Gauss-Jordan, pivot partiel ; null si singuliere
  const n = A.length, M = A.map(function (l, i) { return l.slice().concat(A.map(function (_, j) { return i === j ? 1 : 0; })); });
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-11) return null;
    const t = M[c]; M[c] = M[p]; M[p] = t;
    const piv = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= piv;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map(function (l) { return l.slice(n); });
}
function jacobi_(S) {                                      // valeurs/vecteurs propres d'une matrice symetrique (tries decroissants)
  const n = S.length, A = S.map(function (l) { return l.slice(); });
  const V = A.map(function (_, i) { return A.map(function (__, j) { return i === j ? 1 : 0; }); });
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  const idx = A.map(function (_, i) { return i; }).sort(function (a, b) { return A[b][b] - A[a][a]; });
  return { val: idx.map(function (i) { return A[i][i]; }), vec: V.map(function (l) { return idx.map(function (i) { return l[i]; }); }) };
}
function varimax_(L) {                                     // rotation varimax normalisee (Kaiser), algorithme SVD classique
  const p = L.length, k = L[0].length;
  if (k < 2) return L.map(function (l) { return l.slice(); });
  const h = L.map(function (l) { return Math.sqrt(l.reduce(function (s, x) { return s + x * x; }, 0)) || 1; });
  const A = L.map(function (l, i) { return l.map(function (x) { return x / h[i]; }); });
  let R = A[0].map(function (_, i) { return A[0].map(function (__, j) { return i === j ? 1 : 0; }); }), d = 0;
  const mul = function (X, Y) { return X.map(function (l) { return Y[0].map(function (_, j) { let s = 0; for (let t = 0; t < Y.length; t++) s += l[t] * Y[t][j]; return s; }); }); };
  const tr = function (X) { return X[0].map(function (_, j) { return X.map(function (l) { return l[j]; }); }); };
  for (let it = 0; it < 500; it++) {
    const Lam = mul(A, R);
    const cs = Lam[0].map(function (_, j) { return Lam.reduce(function (s, l) { return s + l[j] * l[j]; }, 0) / p; });
    const T = Lam.map(function (l) { return l.map(function (x, j) { return x * x * x - x * cs[j]; }); });
    const B = mul(tr(A), T);
    const e = jacobi_(mul(tr(B), B));                       // B'B = V S^2 V'
    const sv = e.val.map(function (x) { return Math.sqrt(Math.max(x, 0)); });
    const Vm = e.vec, BV = mul(B, Vm);
    const U = BV.map(function (l) { return l.map(function (x, j) { return sv[j] > 1e-15 ? x / sv[j] : 0; }); });
    R = mul(U, tr(Vm));
    const dn = sv.reduce(function (s, x) { return s + x; }, 0);
    if (dn < d * (1 + 1e-7)) break;
    d = dn;
  }
  const out = mul(A, R).map(function (l, i) { return l.map(function (x) { return x * h[i]; }); });
  for (let j = 0; j < k; j++) {                             // signe : somme des saturations positive
    if (out.reduce(function (s, l) { return s + l[j]; }, 0) < 0) out.forEach(function (l) { l[j] = -l[j]; });
  }
  return out;
}

// ---------- Outils communs ----------
function nature_(code, meta) {
  const m = meta[code];
  if (!m) throw new Error("Variable inconnue : " + code);
  if (m.items) throw new Error(code + " est un groupe de réponses multiples : utilisez ses items (ex. " + m.items[0][0] + ")");
  if (m.groupe) return "binaire";
  if (!m.valeurs) return "echelle";
  return m.mesure === "ORDINAL" ? "ordinale" : "nominale";
}
function okVal_(v, nat) { return nat === "echelle" ? (typeof v === "number" && isFinite(v)) : valide_(v); }
function poidsTests_(rows, cfg) {                           // facteur de base effective (1 si non pondere ou mode SPSS)
  if (!cfg.pondere || cfg.modePond !== "EFFECTIF") return 1;
  const s1 = sommeW_(rows), s2 = rows.reduce(function (s, o) { return s + o._w * o._w; }, 0);
  return s2 > 0 ? s1 / s2 : 1;
}
function etoiles_(p) { return p === "" ? "" : p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : p < 0.10 ? "." : ""; }
function libMod_(meta, code, v) { const m = meta[code]; const x = (m.valeurs || []).filter(function (p) { return p[0] === v; })[0]; return x ? String(x[1]) : String(v); }

/** Matrice de plan : constante + variables numeriques + indicatrices des nominales (reference = modalite la plus frequente). */
function moyVar_(rows, f) {
  const sw = sommeW_(rows); if (!sw) return { m: 0, sd: 0 };
  const m = rows.reduce(function (s, o) { return s + o._w * f(o); }, 0) / sw;
  const v = rows.reduce(function (s, o) { return s + o._w * (f(o) - m) * (f(o) - m); }, 0) / Math.max(sw - 1, 1);
  return { m: m, sd: Math.sqrt(v) };
}

// ---------- 5. REGRESSION LINEAIRE MULTIPLE (= SPSS REGRESSION /METHOD=ENTER) ----------

// ---------- 6. REGRESSION LOGISTIQUE BINAIRE (= SPSS LOGISTIC REGRESSION) ----------

// ---------- Analyse des correspondances generique (matrice >= 0) ----------
function afc_(Nm) {
  const I = Nm.length, J = Nm[0].length;
  const tot = Nm.reduce(function (s, l) { return s + l.reduce(function (a, x) { return a + x; }, 0); }, 0);
  const r = Nm.map(function (l) { return l.reduce(function (a, x) { return a + x; }, 0) / tot; });
  const c = []; for (let j = 0; j < J; j++) { let s = 0; for (let i = 0; i < I; i++) s += Nm[i][j]; c.push(s / tot); }
  const ri = [], cj = []; r.forEach(function (x, i) { if (x > 0) ri.push(i); }); c.forEach(function (x, j) { if (x > 0) cj.push(j); });
  const Sm = ri.map(function (i) { return cj.map(function (j) { return (Nm[i][j] / tot - r[i] * c[j]) / Math.sqrt(r[i] * c[j]); }); });
  const StS = cj.map(function (_, a) { return cj.map(function (__, b) { let s = 0; for (let i = 0; i < ri.length; i++) s += Sm[i][a] * Sm[i][b]; return s; }); });
  const e = jacobi_(StS);
  const nax = Math.max(0, Math.min(ri.length, cj.length) - 1);
  const lam = e.val.slice(0, nax).map(function (x) { return Math.max(x, 0); });
  const inertie = StS.reduce(function (s, l, a) { return s + l[a]; }, 0);
  const G = cj.map(function (j, a) { return lam.map(function (l, k) { return l > 0 ? e.vec[a][k] * Math.sqrt(l) / Math.sqrt(c[j]) : 0; }); });
  const F = ri.map(function (i, ii) { return lam.map(function (l, k) {
    let s = 0; for (let a = 0; a < cj.length; a++) s += Sm[ii][a] * e.vec[a][k]; return s / Math.sqrt(r[i]); }); });
  const d2r = ri.map(function (i) { let s = 0; cj.forEach(function (j) { const q = Nm[i][j] / tot / r[i] - c[j]; s += q * q / c[j]; }); return s; });
  const d2c = cj.map(function (j) { let s = 0; ri.forEach(function (i) { const q = Nm[i][j] / tot / c[j] - r[i]; s += q * q / r[i]; }); return s; });
  return { lam: lam, inertie: inertie, ri: ri, cj: cj, r: r, c: c, F: F, G: G, d2r: d2r, d2c: d2c, tot: tot };
}

// ---------- 7. AFC (= SPSS CORRESPONDENCE) ----------

// ---------- ACM (commune a ACM et TYPOLOGIE) ----------
function calculACM_(base, vars, meta) {
  vars.forEach(function (x) { if (nature_(x, meta) === "echelle") throw new Error(x + " n'est pas catégorielle (ACM)"); });
  if (vars.length < 2) throw new Error("ACM : au moins 2 variables actives");
  const rows = base.filter(function (o) { return vars.every(function (c) { return valide_(o[c]); }); });
  const mods = [];
  vars.forEach(function (v) {
    const liste = nature_(v, meta) === "binaire" ? [[1, "Cité"], [0, "Non cité"]] : meta[v].valeurs.filter(function (q) { return q[0] < 97; });
    liste.forEach(function (q) { if (rows.some(function (o) { return o[v] === q[0]; })) mods.push({ v: v, code: q[0], lib: q[1] }); });
  });
  const Z = rows.map(function (o) { return mods.map(function (m) { return o[m.v] === m.code ? o._w : 0; }); });
  const a = afc_(Z), Q = vars.length;
  const benz = a.lam.map(function (l) { return l > 1 / Q ? Math.pow(Q / (Q - 1) * (l - 1 / Q), 2) : 0; });
  return { rows: rows, mods: mods, a: a, Q: Q, benz: benz };
}

// ---------- 8. ACM (analyse des correspondances multiples) ----------

// ---------- 9. ACP / ANALYSE FACTORIELLE (= SPSS FACTOR /EXTRACTION=PC /ROTATION=VARIMAX) ----------

// ---------- 10. TYPOLOGIE (ACM + k-means, = demarche SPAD / SPSS TwoStep simplifiee) ----------
function alea_(graine) { let s = graine % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
function kmeans_(P, w, k, essais, graine) {
  const n = P.length, d = P[0].length, rnd = alea_(graine);
  const dist = function (a, b) { let s = 0; for (let t = 0; t < d; t++) s += (a[t] - b[t]) * (a[t] - b[t]); return s; };
  let best = null;
  for (let e = 0; e < essais; e++) {
    const C = [P[Math.floor(rnd() * n)].slice()];
    while (C.length < k) {                                   // initialisation k-means++
      const D = P.map(function (x, i) { return w[i] * Math.min.apply(null, C.map(function (c) { return dist(x, c); })); });
      const tot = D.reduce(function (s, x) { return s + x; }, 0);
      let u = rnd() * tot, i = 0; while (i < n - 1 && u > D[i]) { u -= D[i]; i++; }
      C.push(P[i].slice());
    }
    let lab = new Array(n).fill(-1);
    for (let it = 0; it < 200; it++) {
      let chg = false;
      P.forEach(function (x, i) { let bj = 0, bd = Infinity; C.forEach(function (c, j) { const dd = dist(x, c); if (dd < bd) { bd = dd; bj = j; } }); if (lab[i] !== bj) { lab[i] = bj; chg = true; } });
      for (let j = 0; j < k; j++) { const s = new Array(d).fill(0); let sw = 0;
        P.forEach(function (x, i) { if (lab[i] === j) { sw += w[i]; for (let t = 0; t < d; t++) s[t] += w[i] * x[t]; } });
        if (sw > 0) C[j] = s.map(function (v) { return v / sw; }); }
      if (!chg) break;
    }
    const wss = P.reduce(function (s, x, i) { return s + w[i] * dist(x, C[lab[i]]); }, 0);
    if (!best || wss < best.wss) best = { lab: lab.slice(), C: C.map(function (c) { return c.slice(); }), wss: wss };
  }
  return best;
}

// =====================================================================
// 16. SORTIES AU FORMAT IBM SPSS STATISTICS 27 (interface francaise)
//     Memes tableaux, memes intitules, memes notes de bas de tableau,
//     memes options par defaut (voir syntaxe SPSS equivalente en tete
//     de chaque onglet, pour reproduire l'analyse dans SPSS/PSPP).
// =====================================================================

// ---------- Objet de sortie : tableaux "pivot" facon SPSS ----------
function Sortie_() {
  this.L = [];
  this.st = { titre: [], ttab: [], tete: [], gras: [], note: [], pct1: [], n0: [], n1: [], n2: [], n3: [], vert: [], rouge: [],
              soustitre: [], lettre: [], etiq: [], synth: [], syntaxe: [], f0: [] };
  this.cadres = []; this.fusions = []; this.graph = [];
}
Sortie_.prototype.ligne = function (arr, style) {
  this.L.push(arr);
  const r = this.L.length;
  if (style) this.st[style].push([r, 1, Math.max(arr.length, 1)]);
  return r;
};
Sortie_.prototype.cell = function (style, r, c, n) { this.st[style].push([r, c, n || 1]); };
Sortie_.prototype.vide = function () { this.L.push([""]); };
/** Tableau SPSS : titre, lignes d'en-tete (["x", "", ...] ; {f:[col,n]} pour fusionner), lignes de donnees.
 *  o.fmt : { indexColonne(1..): "n3"|"pct1"|... } ; o.nEtiq : nb de colonnes d'etiquettes ; o.notes : [..] */
Sortie_.prototype.tableau = function (titre, entetes, lignes, o) {
  o = o || {};
  const self = this;
  this.ligne([titre], "ttab");
  let W = 1;
  entetes.concat(lignes).forEach(function (l) { if (l.length > W) W = l.length; });
  const r0 = this.L.length + 1;
  entetes.forEach(function (h) {
    const r = self.ligne(h.map(function (x) { return (x && typeof x === "object") ? x.t : x; }));
    self.st.tete.push([r, 1, W]);
    h.forEach(function (x, c) { if (x && typeof x === "object" && x.n > 1) self.fusions.push([r, c + 1, x.n]); });
  });
  const d0 = this.L.length + 1;
  lignes.forEach(function (l) { self.ligne(l); });
  const nL = lignes.length;
  if (nL) {
    self.st.etiq.push([d0, 1, o.nEtiq || 1]);
    for (let r = d0 + 1; r < d0 + nL; r++) self.st.etiq.push([r, 1, o.nEtiq || 1]);
    Object.keys(o.fmt || {}).forEach(function (c) {
      for (let r = d0; r < d0 + nL; r++) self.st[o.fmt[c]].push([r, Number(c), 1]);
    });
  }
  this.cadres.push([r0, 1, entetes.length + nL, W]);
  (o.notes || []).forEach(function (n) { self.ligne([n], "note"); });
  this.vide();
  return d0;                                                  // numero de la 1re ligne de donnees
};
Sortie_.prototype.ecrire = function (sh) {
  let W = 1;
  this.L.forEach(function (l) { if (l.length > W) W = l.length; });
  const data = this.L.map(function (l) {
    const a = l.map(function (x) { return (x === null || x === undefined || (typeof x === "number" && !isFinite(x))) ? "" : x; });
    while (a.length < W) a.push("");
    return a;
  });
  if (sh.getMaxColumns() < W + 14) sh.insertColumnsAfter(sh.getMaxColumns(), W + 14 - sh.getMaxColumns());
  if (sh.getMaxRows() < data.length + 5) sh.insertRowsAfter(sh.getMaxRows(), data.length + 5 - sh.getMaxRows());
  sh.getRange(1, 1, data.length, W).setValues(data).setFontFamily("Arial").setFontSize(9).setVerticalAlignment("middle");
  const a1 = function (t) { return lettreColonne_(t[1]) + t[0] + ":" + lettreColonne_(t[1] + t[2] - 1) + (t[0] + (t[3] || 1) - 1); };
  const st = this.st;
  const appl = function (k, f) { if (st[k].length) f(sh.getRangeList(st[k].map(a1))); };
  appl("titre", function (r) { r.setFontSize(14).setFontWeight("bold").setFontColor("#1F4E78"); });
  appl("soustitre", function (r) { r.setFontSize(11).setFontWeight("bold").setBackground("#D9E1F2"); });
  appl("ttab", function (r) { r.setFontSize(10).setFontWeight("bold"); });
  appl("tete", function (r) { r.setBackground("#E8EDF4").setFontWeight("bold").setWrap(true).setHorizontalAlignment("center"); });
  appl("etiq", function (r) { r.setBackground("#F3F6FA"); });
  appl("gras", function (r) { r.setFontWeight("bold"); });
  appl("note", function (r) { r.setFontStyle("italic").setFontColor("#555555").setFontSize(8); });
  appl("syntaxe", function (r) { r.setFontFamily("Courier New").setFontSize(8).setFontColor("#1F4E78"); });
  appl("synth", function (r) { r.setFontWeight("bold").setFontColor("#1F4E78"); });
  appl("pct1", function (r) { r.setNumberFormat("0.0%"); });
  appl("n0", function (r) { r.setNumberFormat("0"); });
  appl("n1", function (r) { r.setNumberFormat("0.0"); });
  appl("n2", function (r) { r.setNumberFormat("0.00"); });
  appl("n3", function (r) { r.setNumberFormat("0.000"); });
  appl("f0", function (r) { r.setNumberFormat("0"); });
  appl("vert", function (r) { r.setBackground("#B6D7A8").setFontWeight("bold"); });
  appl("rouge", function (r) { r.setBackground("#F4CCCC").setFontWeight("bold"); });
  appl("lettre", function (r) { r.setFontColor("#1F4E78").setFontWeight("bold").setHorizontalAlignment("center"); });
  if (this.cadres.length) sh.getRangeList(this.cadres.map(function (t) { return lettreColonne_(t[1]) + t[0] + ":" + lettreColonne_(t[1] + t[3] - 1) + (t[0] + t[2] - 1); }))
    .setBorder(true, true, true, true, true, true, "#9FB1C8", SpreadsheetApp.BorderStyle.SOLID);
  this.fusions.forEach(function (f) { sh.getRange(f[0], f[1], 1, f[2]).merge(); });
  this.graph.forEach(function (g) {
    let b = sh.newChart().setChartType(g.type).setNumHeaders(1).setPosition(g.pos[0], g.pos[1], 0, 0)
      .setOption("title", g.titre).setOption("width", g.w || 520).setOption("height", g.h || 260);
    g.plages.forEach(function (p) { b = b.addRange(sh.getRange(p[0], p[1], p[2], p[3])); });
    if (g.transpose) b = b.setTransposeRowsAndColumns(true);
    if (g.empile) b = b.setOption("isStacked", true);
    if (g.sansLegende) b = b.setOption("legend", { position: "none" });
    if (g.axes) b = b.setOption("hAxis", { title: g.axes[0] }).setOption("vAxis", { title: g.axes[1] });
    sh.insertChart(b.build());
  });
};

// ---------- Utilitaires de sortie ----------
function f_(t, n) { return { t: t, n: n }; }                                  // en-tete fusionne sur n colonnes
function lib_(meta, code) { return code + " (" + String(meta[code].label).replace(/^Q\d+\. /, "") + ")"; }
function tInv_(pBilat, df) {                                                   // quantile de Student (bissection)
  let lo = 0, hi = 1000;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (pStudent2_(m, df) > pBilat) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function modalites_(code, meta) {
  return nature_(code, meta) === "binaire" ? [[1, "Cité"], [0, "Non cité"]] : meta[code].valeurs.filter(function (q) { return q[0] < 97; });
}
function synthese_(S, texte) { S.ligne(["► Synthèse (complément au format SPSS) : " + texte], "synth"); S.vide(); }

function entete_(S, titre, p, nBrut, nPond, cfg, syntaxe) {
  S.ligne([titre], "titre");
  S.tableau("Remarques", [["", ""]], [
    ["Sortie créée", Utilities.formatDate(new Date(), CONFIG.FUSEAU, "dd/MM/yyyy HH:mm")],
    ["Données", "MASQUE_DEPOUILLEMENT (fiches au statut REJETE exclues)"],
    ["Filtre", "ville = " + p.ville + " ; cible = " + p.cible + " ; jour = " + p.jour],
    ["Pondération", cfg.infoPoids + (cfg.pondere ? (cfg.modePond === "SPSS" ? " — calcul identique SPSS (WEIGHT BY, effectifs de cellules arrondis)" :
      " — tests sur base effective (correction de Kish)") : "")],
    ["N de lignes dans le fichier de travail", nBrut + (cfg.pondere ? " (pondéré : " + arr_(nPond, 1) + ")" : "")],
    ["Seuil de signification", Math.round(cfg.alpha * 100) + " %"],
    ["Syntaxe SPSS équivalente", syntaxe]
  ], { nEtiq: 1 });
  S.st.syntaxe.push([S.L.length - 1, 2, 1]);
  if (nBrut < 30) S.ligne(["⚠ Moins de 30 fiches : résultats indicatifs, aucune conclusion statistique possible."], "gras");
}

function syntaxeSPSS_(type, vars, cv, preds, cfg, meta) {
  const w = cfg.pondere ? "WEIGHT BY POIDS. " : "";
  const a = cfg.alpha;
  switch (type) {
    case "FREQUENCES": return w + "FREQUENCIES VARIABLES=" + vars.join(" ") + " /ORDER=ANALYSIS.";
    case "CROISEMENT": return w + "CROSSTABS /TABLES=" + vars.join(" ") + " BY " + cv + " /FORMAT=AVALUE TABLES /STATISTICS=CHISQ PHI" +
      " /CELLS=COUNT ROW COLUMN ASRESID /COUNT ROUND CELL.";
    case "REPONSES_MULTIPLES": return w + "MULT RESPONSE GROUPS=" + vars.join("_") + " (… (1)) /FREQUENCIES=" + vars.join("_") +
      (cv ? " /VARIABLES=" + cv + "(min,max) /TABLES=" + vars.join("_") + " BY " + cv + " /CELLS=COLUMN" : "") + " /BASE=CASES.";
    case "MOYENNES": return cv ? w + "ONEWAY " + vars.join(" ") + " BY " + cv + " /STATISTICS DESCRIPTIVES HOMOGENEITY /MISSING ANALYSIS /POSTHOC=BONFERRONI ALPHA(" + a + ")."
                               : w + "DESCRIPTIVES VARIABLES=" + vars.join(" ") + " /STATISTICS=MEAN STDDEV MIN MAX.";
    case "REGRESSION": return w + "REGRESSION /MISSING LISTWISE /STATISTICS COEFF OUTS R ANOVA COLLIN TOL /CRITERIA=PIN(.05) POUT(.10) /NOORIGIN /DEPENDENT " +
      vars[0] + " /METHOD=ENTER " + preds.join(" ") + ".  (variables nominales : indicatrices, référence = dernière modalité)";
    case "LOGISTIQUE": return w + "RECODE " + vars[0].split("=")[0] + " (" + (vars[0].split("=")[1] || "1") + "=1)(ELSE=0) INTO Y01. LOGISTIC REGRESSION VARIABLES Y01 /METHOD=ENTER " +
      preds.join(" ") + " /CONTRAST (…)=Indicator /PRINT=GOODFIT CI(95) /CRITERIA=PIN(0.05) POUT(0.10) ITERATE(20) CUT(0.5).";
    case "AFC": return w + "CORRESPONDENCE TABLE=" + vars[0] + "(min max) BY " + cv + "(min max) /DIMENSIONS=2 /MEASURE=CHISQ /STANDARDIZE=RCMEAN" +
      " /NORMALIZATION=SYMMETRICAL /PRINT=TABLE RPOINTS CPOINTS /PLOT=BIPLOT(20).";
    case "ACM": return w + "MULTIPLE CORRESPONDENCE VARIABLES=" + vars.join(" ") + " /ANALYSIS=" + vars.join(" ") +
      " /DIMENSION=2 /NORMALIZATION=VPRINCIPAL /MAXITER=100 /CRITITER=.00001 /PRINT=DISCRIM QUANT(" + vars.join(" ") + ") /PLOT=CATEGORY(" + vars.join(" ") + ").";
    case "ACP": return w + "FACTOR /VARIABLES " + vars.join(" ") + " /MISSING LISTWISE /PRINT INITIAL KMO EXTRACTION ROTATION /CRITERIA MINEIGEN(1) ITERATE(25)" +
      " /EXTRACTION PC /CRITERIA ITERATE(25) /ROTATION VARIMAX /METHOD=CORRELATION.";
    case "TYPOLOGIE": return w + "MULTIPLE CORRESPONDENCE … /SAVE=OBJECT. QUICK CLUSTER OBSCO1_1 OBSCO2_1 … /CRITERIA=CLUSTER(k) MXITER(200) CONVERGE(0) /PRINT ANOVA.";
  }
  return "";
}

/** Matrice de plan : constante + numeriques + indicatrices des nominales (reference = DERNIERE modalite, comme SPSS Indicator(last)). */
function matricePlan_(rows, preds, meta) {
  const cols = [{ nom: "(Constante)", constante: true, f: function () { return 1; } }];
  preds.forEach(function (code) {
    const nat = nature_(code, meta);
    if (nat === "nominale") {
      const mods = []; rows.forEach(function (o) { if (mods.indexOf(o[code]) < 0) mods.push(o[code]); });
      mods.sort(function (a, b) { return a - b; });
      mods.slice(0, -1).forEach(function (v, i) {
        cols.push({ nom: code + "(" + (i + 1) + ")", detail: libMod_(meta, code, v) + " vs " + libMod_(meta, code, mods[mods.length - 1]),
          var: code, mod: v, idx: i + 1, ref: mods[mods.length - 1], mods: mods, f: function (o) { return o[code] === v ? 1 : 0; } });
      });
    } else {
      cols.push({ nom: code, detail: nat === "binaire" ? "1 = cité" : nat === "ordinale" ? "code ordinal traité comme numérique" : "", var: code, num: true,
        f: function (o) { return o[code]; } });
    }
  });
  return cols;
}

// =====================================================================
// FREQUENCES  (= FREQUENCIES)
// =====================================================================
function anaFrequences_(S, base, vars, meta, cfg) {
  vars.forEach(function (code) {
    const m = meta[code];
    if (!m) throw new Error("Variable inconnue : " + code);
    if (m.items) throw new Error(code + " est un groupe de réponses multiples : utilisez le type REPONSES_MULTIPLES");
    if (!m.valeurs) throw new Error(code + " n'est pas une variable codée (texte ou numérique libre)");
  });
  const N = sommeW_(base);
  const stat = function (code, valid) { return base.reduce(function (s, o) { return s + (valide_(o[code]) === valid ? o._w : 0); }, 0); };
  S.tableau("Statistiques", [["", ""].concat(vars)], [["N", "Valide"].concat(vars.map(function (c) { return stat(c, true); })),
    ["", "Manquant"].concat(vars.map(function (c) { return stat(c, false); }))], { nEtiq: 2, fmt: {} });
  const zc = zCritique_(cfg.alpha);
  vars.forEach(function (code) {
    const m = meta[code];
    const val = m.valeurs.filter(function (p) { return p[0] < 97; }), manq = m.valeurs.filter(function (p) { return p[0] >= 97; });
    const cnt = {};
    base.forEach(function (o) { const v = o[code]; const k = (v === "" || v === null) ? "_sys" : (typeof v === "number" ? v : "_inc"); cnt[k] = (cnt[k] || 0) + o._w; });
    const nVal = val.reduce(function (s, p) { return s + (cnt[p[0]] || 0); }, 0);
    const vRows = base.filter(function (o) { return valide_(o[code]); });
    const s2 = vRows.reduce(function (s, o) { return s + o._w * o._w; }, 0), neff = s2 > 0 ? nVal * nVal / s2 : 0;
    const L = []; let cum = 0;
    val.forEach(function (p, i) {
      const e = cnt[p[0]] || 0; cum += e; const pv = nVal ? e / nVal : 0;
      L.push([i === 0 ? "Valide" : "", p[1], e, N ? 100 * e / N : 0, 100 * pv, nVal ? 100 * cum / nVal : 0,
        neff > 0 ? 100 * zc * Math.sqrt(pv * (1 - pv) / neff) : ""]);
    });
    L.push(["", "Total", nVal, N ? 100 * nVal / N : 0, nVal ? 100 : 0, "", ""]);
    const lm = [];
    manq.forEach(function (p) { if (cnt[p[0]]) lm.push([p[1], cnt[p[0]]]); });
    if (cnt._sys) lm.push(["Système manquant", cnt._sys]);
    if (cnt._inc) lm.push(["Valeur non reconnue", cnt._inc]);
    lm.forEach(function (x, i) { L.push([i === 0 ? "Manquant" : "", x[0], x[1], N ? 100 * x[1] / N : 0, "", "", ""]); });
    const nM = lm.reduce(function (s, x) { return s + x[1]; }, 0);
    if (lm.length > 1) L.push(["", "Total", nM, N ? 100 * nM / N : 0, "", "", ""]);
    L.push(["Total", "", N, N ? 100 : 0, "", "", ""]);
    const d0 = S.tableau(code + " " + String(m.label).replace(/^Q\d+\. /, ""), [["", "", "Fréquence", "Pourcentage", "Pourcentage valide", "Pourcentage cumulé",
      "± Marge (IC " + Math.round((1 - cfg.alpha) * 100) + " %) *"]], L,
      { nEtiq: 2, fmt: { 3: "n0", 4: "n1", 5: "n1", 6: "n1", 7: "n1" }, notes: ["* Colonne complémentaire (hors SPSS) : marge d'erreur du pourcentage valide, en points (hypothèse d'échantillon aléatoire)."] });
    S.graph.push({ type: Charts.ChartType.BAR, titre: code + " (% valide)", pos: [d0 - 1, 9], sansLegende: true,
      plages: [[d0 - 1, 2, val.length + 1, 1], [d0 - 1, 5, val.length + 1, 1]], h: Math.max(180, 26 * val.length + 60) });
    for (let k = 0; k < Math.max(0, 7 - L.length); k++) S.vide();
  });
}

// =====================================================================
// CROISEMENT  (= CROSSTABS /STATISTICS=CHISQ PHI /CELLS=COUNT ROW COLUMN ASRESID)
// =====================================================================
function anaCroisement_(S, base, rv, cv, meta, cfg) {
  [rv, cv].forEach(function (x) {
    if (!meta[x]) throw new Error("Variable inconnue : " + x);
    if (meta[x].items) throw new Error(x + " est un groupe de réponses multiples : utilisez REPONSES_MULTIPLES");
    if (!meta[x].valeurs) throw new Error(x + " n'est pas une variable codée");
  });
  const R = meta[rv].valeurs.filter(function (p) { return p[0] < 97; }), C = meta[cv].valeurs.filter(function (p) { return p[0] < 97; });
  const iR = {}, iC = {}; R.forEach(function (p, i) { iR[p[0]] = i; }); C.forEach(function (p, j) { iC[p[0]] = j; });
  let O = R.map(function () { return C.map(function () { return 0; }); });
  const inclus = base.filter(function (o) { return iR[o[rv]] !== undefined && iC[o[cv]] !== undefined; });
  inclus.forEach(function (o) { O[iR[o[rv]]][iC[o[cv]]] += o._w; });
  if (cfg.pondere && cfg.modePond === "SPSS") O = O.map(function (l) { return l.map(function (x) { return Math.round(x); }); });   // /COUNT ROUND CELL
  const fT = poidsTests_(inclus, cfg);
  const kd = khiDeux_(O), N = kd.N, nc = C.length, nr = R.length;
  const k = fT === 1 ? kd : khiDeux_(O.map(function (l) { return l.map(function (x) { return x * fT; }); }));
  const Ntot = sommeW_(base), nMan = Ntot - sommeW_(inclus);
  const rl = lib_(meta, rv), cl = lib_(meta, cv);

  S.ligne([rv + " * " + cv], "soustitre");
  S.tableau("Récapitulatif du traitement des observations",
    [["", f_("Observations", 6), "", "", "", "", ""], ["", f_("Valide", 2), "", f_("Manquante", 2), "", f_("Total", 2), ""],
     ["", "N", "Pourcentage", "N", "Pourcentage", "N", "Pourcentage"]],
    [[rv + " * " + cv, N, Ntot ? N / Ntot : 0, nMan, Ntot ? nMan / Ntot : 0, Ntot, Ntot ? 1 : 0]],
    { nEtiq: 1, fmt: { 2: "n0", 3: "pct1", 4: "n0", 5: "pct1", 6: "n0", 7: "pct1" } });

  // Tableau croise
  const L = [], zc = zCritique_(cfg.alpha), marques = [];
  R.forEach(function (p, i) {
    const e = O[i];
    const lt = lettresProportions_(e.map(function (x) { return x * fT; }), kd.ct.map(function (x) { return x * fT; }), cfg.alpha, cfg.pooled);
    L.push([i === 0 ? rl : "", p[1], "Effectif"].concat(e).concat([kd.rt[i]]));
    L.push(["", "", "% compris dans " + rv].concat(C.map(function (c, j) { return kd.rt[i] ? e[j] / kd.rt[i] : 0; })).concat([kd.rt[i] ? 1 : 0]));
    L.push(["", "", "% compris dans " + cv].concat(C.map(function (c, j) { return kd.ct[j] ? e[j] / kd.ct[j] : 0; })).concat([N ? kd.rt[i] / N : 0]));
    L.push(["", "", "Résidu ajusté"].concat(k.z[i]).concat([""]));
    L.push(["", "", "Comparaison des colonnes (a)"].concat(lt).concat([""]));
    k.z[i].forEach(function (z, j) { if (z !== "" && Math.abs(z) >= zc) marques.push([L.length - 3, 4 + j, z > 0 ? "vert" : "rouge"], [L.length - 2, 4 + j, z > 0 ? "vert" : "rouge"]); });
  });
  L.push(["Total", "", "Effectif"].concat(kd.ct).concat([N]));
  L.push(["", "", "% compris dans " + rv].concat(kd.ct.map(function (x) { return N ? x / N : 0; })).concat([N ? 1 : 0]));
  L.push(["", "", "% compris dans " + cv].concat(kd.ct.map(function (x) { return x ? 1 : 0; })).concat([N ? 1 : 0]));
  const d0 = S.tableau("Tableau croisé " + rv + " * " + cv,
    [["", "", "", f_(cl, nc)].concat(new Array(nc - 1).fill("")).concat(["Total"]), ["", "", ""].concat(C.map(function (p, j) { return p[1] + " (" + LETTRES[j] + ")"; })).concat([""])],
    L, { nEtiq: 3, notes: ["a. Colonne dont la proportion est significativement INFÉRIEURE (test z de " + (cfg.pooled === false ? "proportions séparées" : "proportion commune") +
      ", correction de Bonferroni, seuil " + Math.round(cfg.alpha * 100) + " %) — style « Tableaux personnalisés ». Vert/rouge : résidu ajusté ≥ |" + zc.toFixed(2) + "|."] });
  for (let t = 0; t < L.length; t++) {
    const lab = L[t][2];
    if (lab === "Effectif") S.cell("n0", d0 + t, 4, nc + 1);
    else if (String(lab).indexOf("% compris") === 0) S.cell("pct1", d0 + t, 4, nc + 1);
    else if (lab === "Résidu ajusté") S.cell("n1", d0 + t, 4, nc);
    else if (String(lab).indexOf("Comparaison") === 0) S.cell("lettre", d0 + t, 4, nc);
  }
  marques.forEach(function (m) { S.cell(m[2], d0 + m[0], m[1]); });

  // Tests du khi-carre
  const is2x2 = k.yates !== null;
  let lin = 0;                                                     // association lineaire par lineaire (codes des modalites)
  (function () {
    let sw = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    k.ri.forEach(function (i) { k.cj.forEach(function (j) { const w = O[i][j] * fT, x = R[i][0], y = C[j][0];
      sw += w; sx += w * x; sy += w * y; sxx += w * x * x; syy += w * y * y; sxy += w * x * y; }); });
    const cov = sxy - sx * sy / sw, vx = sxx - sx * sx / sw, vy = syy - sy * sy / sw;
    lin = (vx > 0 && vy > 0) ? (sw - 1) * cov * cov / (vx * vy) : 0;
  })();
  const T = [["Khi-carré de Pearson", k.chi2, k.ddl, pKhi2_(k.chi2, k.ddl), "", ""]];
  if (is2x2) T.push(["Correction pour continuité b", k.yates, 1, pKhi2_(k.yates, 1), "", ""]);
  T.push(["Rapport de vraisemblance", k.g2, k.ddl, pKhi2_(k.g2, k.ddl), "", ""]);
  let pF2 = "", pF1 = "";
  if (is2x2 && !cfg.pondere) {
    const a = O[k.ri[0]][k.cj[0]], b = O[k.ri[0]][k.cj[1]], c = O[k.ri[1]][k.cj[0]], d = O[k.ri[1]][k.cj[1]];
    pF2 = fisher2x2_(a, b, c, d); pF1 = fisherUni_(a, b, c, d);
    T.push(["Test exact de Fisher", "", "", "", pF2, pF1]);
  }
  T.push(["Association linéaire par linéaire", lin, 1, pKhi2_(lin, 1), "", ""]);
  T.push(["N d'observations valides", k.N, "", "", "", ""]);
  const pf = k.nCases ? k.nFaible / k.nCases : 0;
  const dT = S.tableau("Tests du khi-carré", [["", "Valeur", "ddl", "Signification asymptotique (bilatérale)", "Sig. exacte (bilatérale)", "Sig. exacte (unilatérale)"]], T,
    { nEtiq: 1, fmt: { 2: "n3", 4: "n3", 5: "n3", 6: "n3" }, notes: ["a. " + k.nFaible + " cellules (" + (100 * pf).toFixed(1) + " %) ont un effectif théorique inférieur à 5. L'effectif théorique minimum est de " +
      (k.minE === null ? "—" : k.minE.toFixed(2)) + "."].concat(is2x2 ? ["b. Calculé uniquement pour un tableau 2x2"] : [])
      .concat(cfg.pondere && cfg.modePond === "EFFECTIF" ? ["Données pondérées : tests sur base effective (effectifs × " + fT.toFixed(3) + ")."] : []) });
  S.cell("f0", dT + T.length - 1, 2);
  let phi = k.N ? Math.sqrt(k.chi2 / k.N) : "";
  if (is2x2) { const a = O[k.ri[0]][k.cj[0]], b = O[k.ri[0]][k.cj[1]], c = O[k.ri[1]][k.cj[0]], d = O[k.ri[1]][k.cj[1]]; if (a * d - b * c < 0) phi = -phi; }
  const dM = S.tableau("Mesures symétriques", [["", "", "Valeur", "Signification approx."]],
    [["Nominal par Nominal", "Phi", phi, pKhi2_(k.chi2, k.ddl)], ["", "V de Cramer", k.V === null ? "" : k.V, pKhi2_(k.chi2, k.ddl)], ["N d'observations valides", "", k.N, ""]],
    { nEtiq: 2, fmt: { 3: "n3", 4: "n3" } });
  S.cell("f0", dM + 2, 3);
  const pDec = (is2x2 && pf > 0.2 && pF2 !== "") ? pF2 : pKhi2_(k.chi2, k.ddl);
  synthese_(S, N < 30 ? "base insuffisante (< 30) : ne pas conclure." : k.ddl < 1 ? "test impossible (une seule modalité observée)." :
    (pDec < cfg.alpha ? "lien SIGNIFICATIF entre " + rv + " et " + cv + " (p = " + pDec.toFixed(3) + (pDec === pF2 ? ", test exact de Fisher" : "") + ")"
                      : "pas de lien significatif (p = " + pDec.toFixed(3) + ")") +
    ", intensité " + intensiteV_(k.V) + " (V de Cramer = " + (k.V === null ? "—" : k.V.toFixed(3)) + ")" + (pf > 0.2 && !is2x2 ? " — ⚠ plus de 20 % de cellules à effectif théorique < 5 : regrouper des modalités." : "."));
  // Graphique (% en colonne)
  const rm = S.ligne(["Graphique"].concat(C.map(function (p) { return p[1]; })), "tete");
  R.forEach(function (p, i) { const r = S.ligne([p[1]].concat(C.map(function (c, j) { return kd.ct[j] ? O[i][j] / kd.ct[j] : 0; }))); S.cell("pct1", r, 2, nc); });
  S.graph.push({ type: Charts.ChartType.COLUMN, titre: rv + " selon " + cv + " (% compris dans " + cv + ")", pos: [rm, nc + 6],
    plages: [[rm, 1, nr + 1, nc + 1]], transpose: true, empile: true, w: 620, h: 340 });
  S.vide(); S.vide();
}
function fisherUni_(a, b, c, d) {                          // Sig. exacte unilaterale (dans le sens de l'ecart observe)
  const n = a + b + c + d, r1 = a + b, c1 = a + c;
  const lf = function (x) { return lnGamma_(x + 1); };
  const pr = function (x) { return Math.exp(lf(r1) + lf(n - r1) + lf(c1) + lf(n - c1) - lf(n) - lf(x) - lf(r1 - x) - lf(c1 - x) - lf(n - r1 - c1 + x)); };
  const lo = Math.max(0, r1 + c1 - n), hi = Math.min(r1, c1), E = r1 * c1 / n;
  let p = 0;
  if (a >= E) for (let x = a; x <= hi; x++) p += pr(x); else for (let x = lo; x <= a; x++) p += pr(x);
  return Math.min(1, p);
}

// =====================================================================
// REPONSES MULTIPLES  (= MULT RESPONSE)
// =====================================================================
function anaReponsesMultiples_(S, base, vars, cv, meta, cfg) {
  const g = itemsGroupe_(vars, meta), items = g.items, nomG = "$" + (vars.length === 1 ? vars[0] : "ENSEMBLE");
  const cas = base.filter(function (o) { return items.some(function (it) { return o[it[0]] === 0 || o[it[0]] === 1; }); });
  const Ntot = sommeW_(base), Nv = sommeW_(cas);
  const cit = items.map(function (it) { return cas.reduce(function (s, o) { return s + (o[it[0]] === 1 ? o._w : 0); }, 0); });
  const tot = cit.reduce(function (s, x) { return s + x; }, 0);
  const nRep = cas.filter(function (o) { return items.some(function (it) { return o[it[0]] === 1; }); });
  const Nr = sommeW_(nRep);
  S.ligne([nomG + " — " + g.label], "soustitre");
  S.tableau("Récapitulatif des observations", [["", f_("Observations", 6), "", "", "", "", ""], ["", f_("Valide", 2), "", f_("Manquante", 2), "", f_("Total", 2), ""],
    ["", "N", "Pourcentage", "N", "Pourcentage", "N", "Pourcentage"]],
    [[nomG + " a", Nr, Ntot ? Nr / Ntot : 0, Ntot - Nr, Ntot ? (Ntot - Nr) / Ntot : 0, Ntot, 1]],
    { nEtiq: 1, fmt: { 2: "n0", 3: "pct1", 4: "n0", 5: "pct1", 6: "n0", 7: "pct1" }, notes: ["a. Groupe de dichotomies mis en tableau à la valeur 1."] });
  const L = items.map(function (it, i) { return [i === 0 ? nomG + " a" : "", it[1], cit[i], tot ? cit[i] / tot : 0, Nr ? cit[i] / Nr : 0]; });
  L.push(["Total", "", tot, tot ? 1 : 0, Nr ? tot / Nr : 0]);
  const d0 = S.tableau("Fréquences " + nomG, [["", "", f_("Réponses", 2), "", "Pourcentage d'observations"], ["", "", "N", "Pourcentage", ""]], L,
    { nEtiq: 2, fmt: { 3: "n0", 4: "pct1", 5: "pct1" }, notes: ["a. Groupe de dichotomies mis en tableau à la valeur 1."] });
  S.graph.push({ type: Charts.ChartType.BAR, titre: "Pourcentage d'observations", pos: [d0 - 2, 8], sansLegende: true,
    plages: [[d0 - 1, 2, items.length + 1, 1], [d0 - 1, 5, items.length + 1, 1]], h: Math.max(200, 30 * items.length + 60) });
  if (!cv) return;
  const mc = meta[cv];
  if (!mc || !mc.valeurs || mc.items) throw new Error("Variable en colonne invalide : " + cv);
  const C = mc.valeurs.filter(function (p) { return p[0] < 97; }), nc = C.length;
  const cas2 = nRep.filter(function (o) { return valide_(o[cv]); });
  const baseC = C.map(function (p) { return cas2.reduce(function (s, o) { return s + (o[cv] === p[0] ? o._w : 0); }, 0); });
  const N2 = baseC.reduce(function (s, x) { return s + x; }, 0), fT = poidsTests_(cas2, cfg), zc = zCritique_(cfg.alpha);
  const X = [], tests = [], marques = [];
  items.forEach(function (it, i) {
    const oui = C.map(function (p) { return cas2.reduce(function (s, o) { return s + (o[cv] === p[0] && o[it[0]] === 1 ? o._w : 0); }, 0); });
    const k = khiDeux_([oui.map(function (x) { return x * fT; }), oui.map(function (x, j) { return (baseC[j] - x) * fT; })]);
    const n1 = oui.reduce(function (s, x) { return s + x; }, 0);
    X.push([i === 0 ? nomG + " a" : "", it[1], "Effectif"].concat(oui).concat([n1]));
    X.push(["", "", "% dans " + cv].concat(C.map(function (p, j) { return baseC[j] ? oui[j] / baseC[j] : 0; })).concat([N2 ? n1 / N2 : 0]));
    X.push(["", "", "Comparaison des colonnes (b)"].concat(lettresProportions_(oui.map(function (x) { return x * fT; }), baseC.map(function (x) { return x * fT; }), cfg.alpha, cfg.pooled)).concat([""]));
    k.z[0].forEach(function (z, j) { if (z !== "" && Math.abs(z) >= zc) marques.push([X.length - 2, 4 + j, z > 0 ? "vert" : "rouge"]); });
    tests.push([it[1], k.chi2, k.ddl, pKhi2_(k.chi2, k.ddl)]);
  });
  X.push(["Total", "", "Effectif"].concat(baseC).concat([N2]));
  const d1 = S.tableau(nomG + "*" + cv + " Tableau croisé", [["", "", "", f_(lib_(meta, cv), nc)].concat(new Array(nc - 1).fill("")).concat(["Total"]),
    ["", "", ""].concat(C.map(function (p, j) { return p[1] + " (" + LETTRES[j] + ")"; })).concat([""])], X,
    { nEtiq: 3, notes: ["Les pourcentages et les totaux sont basés sur les répondants.", "a. Groupe de dichotomies mis en tableau à la valeur 1.",
      "b. Colonne dont la proportion est significativement inférieure (test z, Bonferroni) ; vert/rouge : résidu ajusté (complément hors MULT RESPONSE)."] });
  for (let t = 0; t < X.length; t++) {
    const lab = X[t][2];
    if (lab === "Effectif") S.cell("n0", d1 + t, 4, nc + 1); else if (String(lab).indexOf("% dans") === 0) S.cell("pct1", d1 + t, 4, nc + 1);
    else S.cell("lettre", d1 + t, 4, nc);
  }
  marques.forEach(function (m) { S.cell(m[2], d1 + m[0], m[1]); });
  S.tableau("Tests du khi-carré par item (complément, équivalent CTABLES)", [["Item", "Khi-carré de Pearson", "ddl", "Signification asymptotique (bilatérale)"]], tests,
    { nEtiq: 1, fmt: { 2: "n3", 4: "n3" } });
}

// =====================================================================
// MOYENNES  (= ONEWAY /STATISTICS DESCRIPTIVES HOMOGENEITY /POSTHOC=BONFERRONI ; sans groupe : DESCRIPTIVES)
// =====================================================================
function anaMoyennes_(S, base, vars, cv, meta, cfg) {
  let C = null;
  if (cv) { const mc = meta[cv]; if (!mc || !mc.valeurs || mc.items) throw new Error("Variable de groupe invalide : " + cv); C = mc.valeurs.filter(function (p) { return p[0] < 97; }); }
  vars.forEach(function (code) {
    const m = meta[code];
    if (!m) throw new Error("Variable inconnue : " + code);
    if (m.items || m.groupe) throw new Error(code + " : moyenne impossible sur des réponses multiples");
    if (m.mesure === "NOMINAL") throw new Error(code + " est nominale : une moyenne n'a pas de sens, utilisez CROISEMENT");
  });
  const ok = function (code) { const nat = nature_(code, meta); return function (v) { return okVal_(v, nat); }; };
  const stat = function (rows, code) {
    const n = sommeW_(rows); if (!rows.length || !(n > 0)) return { n: 0, nb: 0 };
    const mo = rows.reduce(function (s, o) { return s + o._w * o[code]; }, 0) / n;
    const ss = rows.reduce(function (s, o) { return s + o._w * (o[code] - mo) * (o[code] - mo); }, 0);
    const xs = rows.map(function (o) { return o[code]; });
    return { n: n, nb: rows.length, m: mo, ss: ss, sd: n > 1 ? Math.sqrt(ss / (n - 1)) : "", min: Math.min.apply(null, xs), max: Math.max.apply(null, xs) };
  };
  if (!cv) {
    const L = vars.map(function (code) { const s = stat(base.filter(function (o) { return ok(code)(o[code]); }), code); return [code, s.n, s.min, s.max, s.m, s.sd]; });
    const nl = sommeW_(base.filter(function (o) { return vars.every(function (c) { return ok(c)(o[c]); }); }));
    L.push(["N valide (liste)", nl, "", "", "", ""]);
    S.tableau("Statistiques descriptives", [["", "N", "Minimum", "Maximum", "Moyenne", "Ecart type"]], L, { nEtiq: 1, fmt: { 2: "n0", 3: "n0", 4: "n0", 5: "n2", 6: "n3" } });
    return;
  }
  const Ld = [], La = [], Lh = [], Lb = [], zNotes = [];
  vars.forEach(function (code) {
    const fT = poidsTests_(base.filter(function (o) { return ok(code)(o[code]) && valide_(o[cv]); }), cfg);
    const G = C.map(function (p) { return { lib: p[1], rows: base.filter(function (o) { return o[cv] === p[0] && ok(code)(o[code]); }) }; });
    G.forEach(function (g) { g.s = stat(g.rows, code); });
    const all = [].concat.apply([], G.map(function (g) { return g.rows; })), T = stat(all, code);
    const act = G.filter(function (g) { return g.s.n > 0; });
    G.forEach(function (g, j) {
      const s = g.s, se = s.n > 1 ? s.sd / Math.sqrt(s.n) : "", tq = s.n > 1 ? tInv_(0.05, s.n - 1) : "";
      Ld.push([j === 0 ? code : "", g.lib, s.n, s.n ? s.m : "", s.sd, se, se === "" ? "" : s.m - tq * se, se === "" ? "" : s.m + tq * se, s.nb ? s.min : "", s.nb ? s.max : ""]);
    });
    const seT = T.n > 1 ? T.sd / Math.sqrt(T.n) : "", tqT = T.n > 1 ? tInv_(0.05, T.n - 1) : "";
    Ld.push(["", "Total", T.n, T.m, T.sd, seT, seT === "" ? "" : T.m - tqT * seT, seT === "" ? "" : T.m + tqT * seT, T.nb ? T.min : "", T.nb ? T.max : ""]);
    const k = act.length, Nn = T.n * fT;
    if (k < 2 || Nn - k < 1) { zNotes.push(code + " : moins de deux groupes renseignés, tests impossibles."); return; }
    let ssb = 0, ssw = 0;
    act.forEach(function (g) { ssb += g.s.n * fT * (g.s.m - T.m) * (g.s.m - T.m); ssw += g.s.ss * fT; });
    const d1 = k - 1, d2 = Nn - k, msw = ssw / d2, F = ssw > 0 ? (ssb / d1) / msw : "";
    La.push([code, "Inter-groupes", ssb, d1, ssb / d1, F, F === "" ? "" : pFisherF_(F, d1, d2)]);
    La.push(["", "Intra-groupes", ssw, arr_(d2, 3), msw, "", ""]);
    La.push(["", "Total", ssb + ssw, arr_(Nn - 1, 3), "", "", ""]);
    // Levene (base sur la moyenne) = ANOVA sur |x - moyenne du groupe|
    let lb = 0, lw = 0; const dev = act.map(function (g) { return g.rows.map(function (o) { return { w: o._w * fT, z: Math.abs(o[code] - g.s.m) }; }); });
    const zg = dev.map(function (d) { const n = d.reduce(function (s, x) { return s + x.w; }, 0); return { n: n, m: d.reduce(function (s, x) { return s + x.w * x.z; }, 0) / n }; });
    const zt = zg.reduce(function (s, x) { return s + x.n * x.m; }, 0) / Nn;
    zg.forEach(function (x, i) { lb += x.n * (x.m - zt) * (x.m - zt); dev[i].forEach(function (y) { lw += y.w * (y.z - x.m) * (y.z - x.m); }); });
    const Lev = lw > 0 ? (lb / d1) / (lw / d2) : "";
    Lh.push([code, "Basé sur la moyenne", Lev, d1, arr_(d2, 3), Lev === "" ? "" : pFisherF_(Lev, d1, d2)]);
    // Bonferroni
    const npair = k * (k - 1) / 2, tb = tInv_(cfg.alpha / npair, d2);
    let premier = true;
    G.forEach(function (gi, i) {
      if (!(gi.s.n > 0)) return;
      let pI = true;
      G.forEach(function (gj, j) {
        if (i === j || !(gj.s.n > 0)) return;
        const dm = gi.s.m - gj.s.m, se = Math.sqrt(msw * (1 / (gi.s.n * fT) + 1 / (gj.s.n * fT)));
        const sig = Math.min(1, pStudent2_(Math.abs(dm / se), d2) * npair);
        Lb.push([premier ? code : "", pI ? gi.lib : "", gj.lib, dm, sig < cfg.alpha ? "*" : "", se, sig, dm - tb * se, dm + tb * se]);
        premier = false; pI = false;
      });
    });
  });
  const dD = S.tableau("Descriptives", [["", "", "N", "Moyenne", "Ecart type", "Erreur standard", f_("Intervalle de confiance à 95 % pour la moyenne", 2), "", "Minimum", "Maximum"],
    ["", "", "", "", "", "", "Borne inférieure", "Borne supérieure", "", ""]], Ld, { nEtiq: 2, fmt: { 3: "n0", 4: "n2", 5: "n3", 6: "n3", 7: "n2", 8: "n2", 9: "n0", 10: "n0" } });
  if (Lh.length) S.tableau("Test d'homogénéité des variances", [["", "", "Statistique de Levene", "ddl1", "ddl2", "Sig."]], Lh, { nEtiq: 2, fmt: { 3: "n3", 6: "n3" } });
  if (La.length) S.tableau("ANOVA", [["", "", "Somme des carrés", "ddl", "Carré moyen", "F", "Sig."]], La, { nEtiq: 2, fmt: { 3: "n3", 5: "n3", 6: "n3", 7: "n3" } });
  if (Lb.length) {
    const d = S.tableau("Comparaisons multiples — Bonferroni", [["Variable dépendante", "(I) " + cv, "(J) " + cv, "Différence moyenne (I-J)", "", "Erreur standard", "Sig.",
      f_("Intervalle de confiance à " + Math.round((1 - cfg.alpha) * 100) + " %", 2), ""], ["", "", "", "", "", "", "", "Borne inférieure", "Borne supérieure"]], Lb,
      { nEtiq: 3, fmt: { 4: "n3", 6: "n3", 7: "n3", 8: "n3", 9: "n3" }, notes: ["*. La différence moyenne est significative au niveau " + cfg.alpha + "."] });
    Lb.forEach(function (l, t) { if (l[4] === "*") S.cell(l[3] > 0 ? "vert" : "rouge", d + t, 4); });
  }
  zNotes.forEach(function (n) { S.ligne([n], "note"); });
  if (La.length) synthese_(S, La.filter(function (l) { return l[1] === "Inter-groupes"; }).map(function (l) {
    return l[0] + " : " + (l[6] !== "" && l[6] < cfg.alpha ? "moyennes SIGNIFICATIVEMENT différentes selon " + cv : "pas de différence significative") + " (F = " + (l[5] === "" ? "—" : l[5].toFixed(2)) + ", p = " + (l[6] === "" ? "—" : l[6].toFixed(3)) + ")";
  }).join(" ; "));
}

// =====================================================================
// REGRESSION LINEAIRE  (= REGRESSION /METHOD=ENTER /STATISTICS COEFF OUTS R ANOVA COLLIN TOL)
// =====================================================================
function anaRegression_(S, base, vars, preds, meta, cfg) {
  if (vars.length !== 1) throw new Error("REGRESSION : une seule variable dépendante en colonne D");
  if (!preds.length) throw new Error("REGRESSION : variables explicatives obligatoires en colonne E");
  const y = vars[0], ny = nature_(y, meta);
  if (ny === "nominale") throw new Error(y + " est nominale : utilisez LOGISTIQUE (ex. " + y + "=1)");
  const tous = [y].concat(preds);
  const rows = base.filter(function (o) { return tous.every(function (c) { return okVal_(o[c], nature_(c, meta)); }); });
  const cols = matricePlan_(rows, preds, meta), p = cols.length;
  const fe = poidsTests_(rows, cfg), w = rows.map(function (o) { return o._w * fe; });
  const X = rows.map(function (o) { return cols.map(function (c) { return c.f(o); }); }), Y = rows.map(function (o) { return o[y]; });
  const N = w.reduce(function (s, x) { return s + x; }, 0);
  if (N <= p + 1) throw new Error("Trop peu d'observations complètes (" + rows.length + ") pour " + (p - 1) + " variables explicatives");
  const XtX = cols.map(function () { return cols.map(function () { return 0; }); }), XtY = cols.map(function () { return 0; });
  X.forEach(function (x, i) { for (let a = 0; a < p; a++) { XtY[a] += w[i] * x[a] * Y[i]; for (let b = 0; b < p; b++) XtX[a][b] += w[i] * x[a] * x[b]; } });
  const inv = inverse_(XtX);
  if (!inv) throw new Error("Colinéarité parfaite entre variables explicatives : retirez-en une");
  const B = inv.map(function (l) { return l.reduce(function (s, x, j) { return s + x * XtY[j]; }, 0); });
  const my = Y.reduce(function (s, v, i) { return s + w[i] * v; }, 0) / N;
  let ssr = 0, sst = 0;
  X.forEach(function (x, i) { const yh = x.reduce(function (s, v, j) { return s + v * B[j]; }, 0); ssr += w[i] * (Y[i] - yh) * (Y[i] - yh); sst += w[i] * (Y[i] - my) * (Y[i] - my); });
  const df = N - p, s2 = ssr / df, r2 = sst > 0 ? 1 - ssr / sst : 0, r2a = 1 - (1 - r2) * (N - 1) / df, ssreg = sst - ssr;
  const F = (p > 1 && ssr > 0) ? (ssreg / (p - 1)) / s2 : "", sdy = Math.sqrt(sst / (N - 1));
  const vif = {};
  if (p > 2) {
    const k = p - 1, mu = [], sd = [];
    for (let a = 1; a < p; a++) { let m = 0; X.forEach(function (x, i) { m += w[i] * x[a]; }); m /= N; let v = 0; X.forEach(function (x, i) { v += w[i] * (x[a] - m) * (x[a] - m); }); mu.push(m); sd.push(Math.sqrt(v / (N - 1)) || 1); }
    const Rm = []; for (let a = 0; a < k; a++) { Rm.push([]); for (let b = 0; b < k; b++) { let s = 0; X.forEach(function (x, i) { s += w[i] * (x[a + 1] - mu[a]) * (x[b + 1] - mu[b]); }); Rm[a].push(s / (N - 1) / (sd[a] * sd[b])); } }
    const iR = inverse_(Rm); if (iR) for (let a = 0; a < k; a++) vif[a + 1] = iR[a][a];
  } else if (p === 2) vif[1] = 1;
  const pred = cols.slice(1).map(function (c) { return c.nom; });
  S.ligne(["Régression — variable dépendante : " + lib_(meta, y)], "soustitre");
  S.tableau("Variables introduites/éliminées a", [["Modèle", "Variables introduites", "Variables éliminées", "Méthode"]], [["1", pred.slice().reverse().join(", ") + " b", ".", "Introduire"]],
    { nEtiq: 1, notes: ["a. Variable dépendante : " + y, "b. Toutes les variables demandées ont été introduites."] });
  S.tableau("Récapitulatif des modèles", [["Modèle", "R", "R-deux", "R-deux ajusté", "Erreur standard de l'estimation"]], [["1", Math.sqrt(Math.max(r2, 0)), r2, r2a, Math.sqrt(s2)]],
    { nEtiq: 1, fmt: { 2: "n3", 3: "n3", 4: "n3", 5: "n3" }, notes: ["a. Prédicteurs : (Constante), " + pred.slice().reverse().join(", ")] });
  S.tableau("ANOVA a", [["Modèle", "", "Somme des carrés", "ddl", "Carré moyen", "F", "Sig."]],
    [["1", "Régression", ssreg, p - 1, ssreg / (p - 1), F, F === "" ? "" : pFisherF_(F, p - 1, df)], ["", "de Student", ssr, arr_(df, 3), s2, "", ""], ["", "Total", sst, arr_(N - 1, 3), "", "", ""]],
    { nEtiq: 2, fmt: { 3: "n3", 5: "n3", 6: "n3", 7: "n3" }, notes: ["a. Variable dépendante : " + y, "b. Prédicteurs : (Constante), " + pred.slice().reverse().join(", ")] });
  const Lc = cols.map(function (c, j) {
    const se = Math.sqrt(s2 * inv[j][j]), t = B[j] / se, pv = pStudent2_(Math.abs(t), df);
    let beta = "";
    if (j > 0) { let m = 0; X.forEach(function (x, i) { m += w[i] * x[j]; }); m /= N; let v = 0; X.forEach(function (x, i) { v += w[i] * (x[j] - m) * (x[j] - m); }); beta = sdy > 0 ? B[j] * Math.sqrt(v / (N - 1)) / sdy : ""; }
    return [j === 0 ? "1" : "", c.nom + (c.detail ? "  [" + c.detail + "]" : ""), B[j], se, beta, t, pv, j > 0 && vif[j] ? 1 / vif[j] : "", j > 0 ? (vif[j] || "") : ""];
  });
  const d = S.tableau("Coefficients a", [["Modèle", "", f_("Coefficients non standardisés", 2), "", "Coefficients standardisés", "t", "Sig.", f_("Statistiques de colinéarité", 2), ""],
    ["", "", "B", "Erreur standard", "Bêta", "", "", "Tolérance", "VIF"]], Lc,
    { nEtiq: 2, fmt: { 3: "n3", 4: "n3", 5: "n3", 6: "n3", 7: "n3", 8: "n3", 9: "n3" },
      notes: ["a. Variable dépendante : " + y, "Variables nominales codées en indicatrices ; référence = dernière modalité (comme Indicator(last) de SPSS)."].concat(ny === "ordinale" ? ["⚠ " + y + " est ordinale, traitée comme numérique."] : []) });
  Lc.forEach(function (l, t) { if (t > 0 && l[6] < cfg.alpha) S.cell(l[2] > 0 ? "vert" : "rouge", d + t, 3); });
  const sig = Lc.slice(1).filter(function (l) { return l[6] < cfg.alpha; }).map(function (l) { return l[1].split("  [")[0] + (l[2] > 0 ? " (+)" : " (−)"); });
  synthese_(S, "R² = " + r2.toFixed(3) + " : le modèle explique " + Math.round(100 * r2) + " % de la variance de " + y + ". Effets significatifs : " + (sig.join(", ") || "aucun") + ".");
}

// =====================================================================
// REGRESSION LOGISTIQUE BINAIRE  (= LOGISTIC REGRESSION /METHOD=ENTER /PRINT=GOODFIT CI(95))
// =====================================================================
function anaLogistique_(S, base, vars, preds, meta, cfg) {
  if (vars.length !== 1) throw new Error("LOGISTIQUE : une seule variable dépendante (ex. PRETACLI=1)");
  if (!preds.length) throw new Error("LOGISTIQUE : variables explicatives obligatoires en colonne E");
  const sp = vars[0].split("="), y = sp[0], ny = nature_(y, meta);
  let succes;
  if (sp.length > 1) succes = Number(sp[1]);
  else if (ny === "binaire") succes = 1;
  else { const vs = meta[y].valeurs.filter(function (q) { return q[0] < 97; }); if (vs.length !== 2) throw new Error(y + " a " + vs.length + " modalités : précisez la modalité « succès », ex. " + y + "=1"); succes = vs[0][0]; }
  const tous = [y].concat(preds);
  const rows = base.filter(function (o) { return tous.every(function (c) { return okVal_(o[c], nature_(c, meta)); }); });
  const cols0 = matricePlan_(rows, preds, meta), cols = cols0.slice(1).concat([cols0[0]]);    // constante en DERNIER (comme SPSS)
  const p = cols.length, ic = p - 1;
  const fe = poidsTests_(rows, cfg), w = rows.map(function (o) { return o._w * fe; });
  const X = rows.map(function (o) { return cols.map(function (c) { return c.f(o); }); });
  const Y = rows.map(function (o) { return o[y] === succes ? 1 : 0; });
  const N = w.reduce(function (s, x) { return s + x; }, 0), n1 = Y.reduce(function (s, v, i) { return s + w[i] * v; }, 0);
  if (n1 <= 0 || n1 >= N) throw new Error("La variable dépendante ne varie pas (tous succès ou tous échecs)");
  let b = cols.map(function () { return 0; }), H = null, it = 0;
  const ll = function (bb) { let s = 0; X.forEach(function (x, i) { const e = x.reduce(function (a, v, j) { return a + v * bb[j]; }, 0), pi = 1 / (1 + Math.exp(-e));
    s += w[i] * (Y[i] ? Math.log(Math.max(pi, 1e-300)) : Math.log(Math.max(1 - pi, 1e-300))); }); return s; };
  for (it = 0; it < 50; it++) {
    const g = cols.map(function () { return 0; }), Hm = cols.map(function () { return cols.map(function () { return 0; }); });
    X.forEach(function (x, i) { const e = x.reduce(function (a, v, j) { return a + v * b[j]; }, 0), pi = 1 / (1 + Math.exp(-e)), wi = w[i] * pi * (1 - pi);
      for (let a = 0; a < p; a++) { g[a] += w[i] * (Y[i] - pi) * x[a]; for (let c = 0; c < p; c++) Hm[a][c] += wi * x[a] * x[c]; } });
    H = inverse_(Hm);
    if (!H) throw new Error("Matrice singulière (séparation ou colinéarité) : simplifiez le modèle");
    const step = H.map(function (l) { return l.reduce(function (s, v, j) { return s + v * g[j]; }, 0); });
    b = b.map(function (v, j) { return v + step[j]; });
    if (Math.max.apply(null, step.map(Math.abs)) < 1e-10) break;
  }
  const prob = X.map(function (x) { return 1 / (1 + Math.exp(-x.reduce(function (a, v, j) { return a + v * b[j]; }, 0))); });
  const LL = ll(b), p0 = n1 / N, LL0 = N * (p0 * Math.log(p0) + (1 - p0) * Math.log(1 - p0));
  const LR = 2 * (LL - LL0), dfm = p - 1, cs = 1 - Math.exp(-LR / N), nag = cs / (1 - Math.exp(2 * LL0 / N));
  const lSucc = libMod_(meta, y, succes), lEch = ny === "binaire" && succes === 1 ? "Non cité" : "Autres réponses";
  const nIncl = rows.length, nTot = base.length;
  S.ligne(["Régression logistique — " + lib_(meta, y) + " : « " + lSucc + " » vs « " + lEch + " »"], "soustitre");
  S.tableau("Récapitulatif de traitement des observations", [["Observations non pondérées a", "", "N", "Pourcentage"]],
    [["Observations sélectionnées", "Incluses dans l'analyse", nIncl, nTot ? nIncl / nTot : 0], ["", "Observations manquantes", nTot - nIncl, nTot ? (nTot - nIncl) / nTot : 0],
     ["", "Total", nTot, 1], ["Observations non sélectionnées", "", 0, 0], ["Total", "", nTot, 1]],
    { nEtiq: 2, fmt: { 3: "n0", 4: "pct1" }, notes: ["a. Si la pondération est effective, consultez le tableau de classement pour connaître le nombre total d'observations."] });
  S.tableau("Codage de variables dépendantes", [["Valeur d'origine", "Valeur interne"]], [[lEch, 0], [lSucc, 1]], { nEtiq: 1 });
  const nomin = preds.filter(function (c) { return nature_(c, meta) === "nominale"; });
  if (nomin.length) {
    const maxk = Math.max.apply(null, nomin.map(function (c) { return cols.filter(function (x) { return x.var === c; }).length; }));
    const Lk = [];
    nomin.forEach(function (c) {
      const d = cols.filter(function (x) { return x.var === c; }), mods = d.length ? d[0].mods : [];
      mods.forEach(function (v, i) {
        const fr = rows.filter(function (o) { return o[c] === v; }).length;
        const code = []; for (let j = 0; j < maxk; j++) code.push(j < d.length ? (i === j ? 1 : 0) : "");
        Lk.push([i === 0 ? c : "", libMod_(meta, c, v), fr].concat(code));
      });
    });
    const h2 = ["", "", ""]; for (let j = 0; j < maxk; j++) h2.push("(" + (j + 1) + ")");
    S.tableau("Codages des variables nominales", [["", "", "Fréquence", f_("Codage des paramètres", maxk)].concat(new Array(maxk - 1).fill("")), h2], Lk, { nEtiq: 2, fmt: { 3: "n0" } });
  }
  S.ligne(["Bloc 1 : Méthode = Entrée"], "ttab");
  const pLR = pKhi2_(LR, dfm);
  S.tableau("Tests de spécification du modèle", [["", "", "Khi-deux", "ddl", "Sig."]],
    [["Étape 1", "Étape", LR, dfm, pLR], ["", "Bloc", LR, dfm, pLR], ["", "Modèle", LR, dfm, pLR]], { nEtiq: 2, fmt: { 3: "n3", 5: "n3" } });
  S.tableau("Récapitulatif des modèles", [["Étape", "-2 log-vraisemblance", "R-deux de Cox & Snell", "R-deux de Nagelkerke"]], [["1", -2 * LL, cs, nag]],
    { nEtiq: 1, fmt: { 2: "n3", 3: "n3", 4: "n3" }, notes: ["a. L'estimation a été interrompue au numéro d'itération " + (it + 1) + " parce que les estimations de paramètres ont changé de moins de .001."] });
  // Hosmer-Lemeshow (groupes de risque ~ deciles, ex-aequo regroupes)
  const ord = prob.map(function (q, i) { return i; }).sort(function (a, c) { return prob[a] - prob[c]; });
  const groupes = []; let cur = [], cumw = 0;
  ord.forEach(function (i, t) {
    cur.push(i); cumw += w[i];
    const next = ord[t + 1];
    if (next !== undefined && prob[next] === prob[i]) return;
    if (cumw >= N * (groupes.length + 1) / 10 - 1e-9 || next === undefined) { groupes.push(cur); cur = []; }
  });
  if (cur.length) groupes.push(cur);
  let hl = 0; const Lhl = [];
  groupes.forEach(function (gr, gI) {
    let o1 = 0, e1 = 0, nw = 0; gr.forEach(function (i) { o1 += w[i] * Y[i]; e1 += w[i] * prob[i]; nw += w[i]; });
    const o0 = nw - o1, e0 = nw - e1;
    if (e1 > 0) hl += (o1 - e1) * (o1 - e1) / e1; if (e0 > 0) hl += (o0 - e0) * (o0 - e0) / e0;
    Lhl.push([gI === 0 ? "1" : "", gI + 1, o0, e0, o1, e1, nw]);
  });
  const dfhl = Math.max(1, groupes.length - 2);
  S.tableau("Test de Hosmer-Lemeshow", [["Étape", "Khi-deux", "ddl", "Sig."]], [["1", hl, dfhl, pKhi2_(hl, dfhl)]], { nEtiq: 1, fmt: { 2: "n3", 4: "n3" } });
  S.tableau("Tableau de contingence pour le test de Hosmer-Lemeshow", [["", "", f_(lEch, 2), "", f_(lSucc, 2), "", "Total"], ["", "", "Observé", "Théorique", "Observé", "Théorique", ""]], Lhl,
    { nEtiq: 2, fmt: { 3: "n0", 4: "n3", 5: "n0", 6: "n3", 7: "n0" }, notes: ["Regroupement par déciles de risque (ex-aequo gardés ensemble) : peut différer légèrement du découpage interne de SPSS."] });
  let vp = 0, vn = 0, fp = 0, fn = 0;
  prob.forEach(function (pr, i) { if (pr >= 0.5) { if (Y[i]) vp += w[i]; else fp += w[i]; } else { if (Y[i]) fn += w[i]; else vn += w[i]; } });
  S.tableau("Tableau de classement a", [[f_("Observé", 3), "", "", f_("Prévu", 3), "", ""], ["", "", "", lEch, lSucc, "Pourcentage correct"]],
    [["Étape 1", y, lEch, vn, fp, (vn + fp) ? 100 * vn / (vn + fp) : ""], ["", "", lSucc, fn, vp, (fn + vp) ? 100 * vp / (fn + vp) : ""], ["", "Pourcentage global", "", "", "", 100 * (vp + vn) / N]],
    { nEtiq: 3, fmt: { 4: "n0", 5: "n0", 6: "n1" }, notes: ["a. La valeur de césure est .500"] });
  const Lv = []; let premier = true, separation = false;
  const ligneCoef = function (j, nom) {
    const se = Math.sqrt(H[j][j]), wald = (b[j] / se) * (b[j] / se), pv = pKhi2_(wald, 1);
    if (Math.abs(b[j]) > 15) separation = true;
    const isC = j === ic;
    Lv.push([premier ? "Étape 1 a" : "", nom, b[j], se, wald, 1, pv, Math.exp(b[j]), isC ? "" : Math.exp(b[j] - 1.959964 * se), isC ? "" : Math.exp(b[j] + 1.959964 * se)]);
    premier = false;
  };
  preds.forEach(function (c) {
    const idx = []; cols.forEach(function (x, j) { if (x.var === c) idx.push(j); });
    if (nature_(c, meta) === "nominale" && idx.length) {
      const sub = idx.map(function (a) { return idx.map(function (bb) { return H[a][bb]; }); }), iS = inverse_(sub);
      let W = ""; if (iS) { W = 0; idx.forEach(function (a, u) { idx.forEach(function (bb, v) { W += b[a] * iS[u][v] * b[bb]; }); }); }
      Lv.push([premier ? "Étape 1 a" : "", c, "", "", W, idx.length, W === "" ? "" : pKhi2_(W, idx.length), "", "", ""]); premier = false;
      idx.forEach(function (j) { ligneCoef(j, cols[j].nom + "  [" + cols[j].detail + "]"); });
    } else idx.forEach(function (j) { ligneCoef(j, c); });
  });
  ligneCoef(ic, "Constante");
  const d = S.tableau("Variables de l'équation", [["", "", "B", "E.S.", "Wald", "ddl", "Sig.", "Exp(B)", f_("IC pour Exp(B) 95%", 2), ""],
    ["", "", "", "", "", "", "", "", "Inférieur", "Supérieur"]], Lv,
    { nEtiq: 2, fmt: { 3: "n3", 4: "n3", 5: "n3", 6: "n0", 7: "n3", 8: "n3", 9: "n3", 10: "n3" },
      notes: ["a. Variable(s) entrées à l'étape 1 : " + preds.join(", ") + ".", "Codage Indicator(last) : référence = dernière modalité de chaque variable nominale."] });
  Lv.forEach(function (l, t) { if (l[2] !== "" && l[1] !== "Constante" && l[6] < cfg.alpha) S.cell(l[2] > 0 ? "vert" : "rouge", d + t, 8); });
  if (separation) S.ligne(["⚠ Coefficients très élevés : séparation quasi complète probable. Regroupez des modalités."], "gras");
  const sig = Lv.filter(function (l) { return l[2] !== "" && l[1] !== "Constante" && l[6] < cfg.alpha; }).map(function (l) { return l[1].split("  [")[0] + " (OR = " + l[7].toFixed(2) + ")"; });
  synthese_(S, "modèle " + (pLR < cfg.alpha ? "significatif" : "non significatif") + " (khi-deux = " + LR.toFixed(2) + ", p = " + pLR.toFixed(3) + "), R² de Nagelkerke = " + nag.toFixed(3) +
    ", " + Math.round(100 * (vp + vn) / N) + " % bien classés. Facteurs significatifs : " + (sig.join(", ") || "aucun") + ".");
}

// =====================================================================
// AFC  (= CORRESPONDENCE /NORMALIZATION=SYMMETRICAL)
// =====================================================================
function anaAFC_(S, base, vars, cv, meta, cfg) {
  if (vars.length !== 1 || !cv) throw new Error("AFC : une variable en ligne (D) et une variable en colonne (E)");
  const rv = vars[0];
  [rv, cv].forEach(function (x) { if (nature_(x, meta) === "echelle") throw new Error(x + " n'est pas catégorielle"); });
  const R = modalites_(rv, meta), C = modalites_(cv, meta);
  const O = R.map(function (a) { return C.map(function (bb) { return base.reduce(function (s, o) { return s + (o[rv] === a[0] && o[cv] === bb[0] ? o._w : 0); }, 0); }); });
  const a = afc_(O);
  if (!a.lam.length) throw new Error("Tableau trop petit pour une AFC (au moins 2 modalités observées de chaque côté)");
  const k = khiDeux_(O), nax = Math.min(2, a.lam.length), sv = a.lam.map(Math.sqrt);
  S.ligne(["Analyse des correspondances — " + rv + " × " + cv], "soustitre");
  const Lt = a.ri.map(function (i) { return [R[i][1]].concat(a.cj.map(function (j) { return O[i][j]; })).concat([a.r[i] * a.tot]); });
  Lt.push(["Marge active"].concat(a.cj.map(function (j) { return a.c[j] * a.tot; })).concat([a.tot]));
  S.tableau("Tableau de correspondance", [[rv, f_(cv, a.cj.length)].concat(new Array(a.cj.length - 1).fill("")).concat([""]), [""].concat(a.cj.map(function (j) { return C[j][1]; })).concat(["Marge active"])], Lt,
    { nEtiq: 1, fmt: (function () { const f = {}; for (let c = 2; c <= a.cj.length + 2; c++) f[c] = "n0"; return f; })() });
  let cum = 0;
  const Lr = a.lam.map(function (l, q) { cum += l / a.inertie; return [q + 1, sv[q], l, "", "", l / a.inertie, cum]; });
  Lr.push(["Total", "", a.inertie, k.chi2, pKhi2_(k.chi2, k.ddl), 1, 1]);
  S.tableau("Récapitulatif", [["Dimension", "Valeur singulière", "Inertie", "Khi-deux", "Sig.", f_("Proportion d'inertie", 2), ""], ["", "", "", "", "", "Représentée", "Cumulée"]], Lr,
    { nEtiq: 1, fmt: { 2: "n3", 3: "n3", 4: "n3", 5: "n3", 6: "n3", 7: "n3" }, notes: ["a. " + k.ddl + " degrés de liberté"] });
  const vue = function (titre, idx, mods, masses, P, d2) {
    const L = idx.map(function (i, ii) {
      const sc = [], ctr = [], cos = [];
      for (let q = 0; q < 2; q++) {
        if (q < nax) { const x = P[ii][q]; sc.push(x / Math.sqrt(sv[q])); ctr.push(masses[i] * x * x / a.lam[q]); cos.push(d2[ii] > 0 ? x * x / d2[ii] : 0); }
        else { sc.push(""); ctr.push(""); cos.push(""); }
      }
      return [mods[i][1], masses[i], sc[0], sc[1], masses[i] * d2[ii], ctr[0], ctr[1], cos[0], cos[1], (cos[0] || 0) + (cos[1] || 0)];
    });
    L.push(["Total actif", 1, "", "", a.inertie, 1, nax > 1 ? 1 : "", "", "", ""]);
    const d = S.tableau(titre, [["", "Masse", f_("Score dans la dimension", 2), "", "Inertie", f_("Contribution", 5), "", "", "", ""],
      ["", "", "1", "2", "", f_("Du point à l'inertie de la dimension", 2), "", f_("De la dimension à l'inertie du point", 3), "", ""],
      ["", "", "", "", "", "1", "2", "1", "2", "Total"]], L,
      { nEtiq: 1, fmt: { 2: "n3", 3: "n3", 4: "n3", 5: "n3", 6: "n3", 7: "n3", 8: "n3", 9: "n3", 10: "n3" }, notes: ["a. Normalisation symétrique"] });
    L.forEach(function (l, t) { for (let q = 0; q < nax; q++) if (l[5 + q] !== "" && l[5 + q] > 1 / idx.length && t < idx.length) S.cell("vert", d + t, 6 + q); });
    return L;
  };
  const Lrw = vue("Points de ligne : vue d'ensemble a", a.ri, R, a.r, a.F, a.d2r);
  const Lcl = vue("Points de colonne : vue d'ensemble a", a.cj, C, a.c, a.G, a.d2c);
  S.ligne(["Vert = contribution supérieure à la moyenne (la modalité « construit » la dimension)."], "note");
  const pts = [];
  Lrw.slice(0, -1).forEach(function (l) { pts.push([l[0], l[2], l[3] === "" ? 0 : l[3], rv]); });
  Lcl.slice(0, -1).forEach(function (l) { pts.push([l[0], l[2], l[3] === "" ? 0 : l[3], cv]); });
  carteSPSS_(S, pts, "Points de ligne et de colonne — Normalisation symétrique", ["Dimension 1", "Dimension 2"]);
  synthese_(S, "les 2 premières dimensions représentent " + Math.round(100 * (a.lam[0] + (a.lam[1] || 0)) / a.inertie) + " % de l'inertie. Lien global " +
    (pKhi2_(k.chi2, k.ddl) < cfg.alpha ? "significatif" : "non significatif") + " (khi-deux = " + k.chi2.toFixed(2) + ").");
}
function carteSPSS_(S, pts, titre, axes) {
  const rh = S.ligne(["Étiquette", "Dimension 1", "Dimension 2", "Groupe", "Taille"], "tete");
  pts.forEach(function (p) { const r = S.ligne([p[0], p[1], p[2], p[3], 1]); S.cell("n3", r, 2, 2); });
  S.graph.push({ type: Charts.ChartType.BUBBLE, titre: titre, pos: [rh, 8], plages: [[rh, 1, pts.length + 1, 5]], w: 760, h: 560, axes: axes });
  S.vide();
}

// =====================================================================
// ACM  (= MULTIPLE CORRESPONDENCE /NORMALIZATION=VPRINCIPAL)
// =====================================================================
function anaACM_(S, base, vars, meta, cfg) {
  const R = calculACM_(base, vars, meta), a = R.a, Q = R.Q;
  const nd = Math.min(2, a.lam.length);
  S.ligne(["Analyse des correspondances multiples — " + vars.length + " variables actives, " + R.mods.length + " modalités"], "soustitre");
  S.tableau("Récapitulatif du traitement des observations", [["", ""]], [["Observations actives valides", R.rows.length],
    ["Observations actives avec valeurs manquantes", base.length - R.rows.length], ["Observations supplémentaires", 0], ["Total", base.length],
    ["Observations utilisées dans l'analyse", R.rows.length]], { nEtiq: 1, fmt: { 2: "n0" } });
  const alpha = function (tot) { return Q > 1 && tot > 0 ? (Q / (Q - 1)) * (1 - 1 / tot) : ""; };
  const Ls = []; let sT = 0, sI = 0;
  for (let q = 0; q < nd; q++) { const tot = Q * a.lam[q]; sT += tot; sI += a.lam[q]; Ls.push([q + 1, alpha(tot), tot, a.lam[q], 100 * a.lam[q]]); }
  Ls.push(["Total", "", sT, sI, ""]);
  Ls.push(["Moyenne", alpha(sT / nd), sT / nd, sI / nd, 100 * sI / nd]);
  S.tableau("Récapitulatif des modèles", [["Dimension", "Alpha de Cronbach", f_("Variance représentée", 3), "", ""], ["", "", "Total (valeur propre)", "Inertie", "% de la variance"]], Ls,
    { nEtiq: 1, fmt: { 2: "n3", 3: "n3", 4: "n3", 5: "n3" }, notes: ["a. La moyenne de l'alpha de Cronbach est basée sur la valeur propre moyenne."] });
  // Mesures de discrimination (eta2 de chaque variable sur chaque dimension)
  const disc = vars.map(function (v) {
    const e = [];
    for (let q = 0; q < nd; q++) { let s = 0; a.cj.forEach(function (j, jj) { if (R.mods[j].v === v) s += a.c[j] * Q * a.G[jj][q] * a.G[jj][q]; }); e.push(s); }
    return e;
  });
  const Ld = vars.map(function (v, i) { return [v].concat(disc[i]).concat([disc[i].reduce(function (s, x) { return s + x; }, 0) / nd]); });
  const tt = []; for (let q = 0; q < nd; q++) tt.push(disc.reduce(function (s, e) { return s + e[q]; }, 0));
  Ld.push(["Total actif"].concat(tt).concat([tt.reduce(function (s, x) { return s + x; }, 0) / nd]));
  Ld.push(["% de la variance"].concat(tt.map(function (x) { return 100 * x / Q; })).concat([100 * tt.reduce(function (s, x) { return s + x; }, 0) / nd / Q]));
  const hq = [""]; for (let q = 0; q < nd; q++) hq.push(String(q + 1)); hq.push("");
  const dd = S.tableau("Mesures de discrimination", [["", f_("Dimension", nd)].concat(new Array(nd - 1).fill("")).concat(["Moyenne"]), hq], Ld,
    { nEtiq: 1, fmt: (function () { const f = {}; for (let c = 2; c <= nd + 2; c++) f[c] = "n3"; return f; })() });
  disc.forEach(function (e, i) { e.forEach(function (x, q) { if (x >= 0.3) S.cell("vert", dd + i, 2 + q); }); });
  const Lq = a.cj.map(function (j, jj) { const m = R.mods[j], row = [m.v, m.lib, a.c[j] * a.tot]; for (let q = 0; q < nd; q++) row.push(a.G[jj][q]); return row; });
  S.tableau("Points de modalité — coordonnées (centroïdes)", [["Variable", "Modalité", "Fréquence", f_("Dimension", nd)].concat(new Array(nd - 1).fill("")),
    ["", "", "", "1", "2"].slice(0, 3 + nd)], Lq, { nEtiq: 2, fmt: { 3: "n0", 4: "n3", 5: "n3" }, notes: ["Normalisation par variable principale (VPRINCIPAL). Signe des dimensions arbitraire (peut être inversé par rapport à SPSS)."] });
  // Complement (ecole francaise) : taux corriges de Benzecri
  const tb = R.benz.reduce(function (s, x) { return s + x; }, 0); let cb = 0;
  const Lb = R.benz.slice(0, Math.min(8, R.benz.length)).map(function (x, q) { cb += tb ? x / tb : 0; return [q + 1, a.lam[q], x, tb ? x / tb : 0, cb]; });
  S.tableau("Complément (hors SPSS) — valeurs propres et taux d'inertie corrigés de Benzécri", [["Dimension", "Valeur propre", "Valeur corrigée", "% corrigé", "% corrigé cumulé"]], Lb,
    { nEtiq: 1, fmt: { 2: "n3", 3: "n3", 4: "pct1", 5: "pct1" }, notes: ["Les % d'inertie bruts d'une ACM sous-estiment toujours l'importance des axes ; les % corrigés donnent la lecture pertinente."] });
  carteSPSS_(S, a.cj.map(function (j, jj) { const m = R.mods[j]; return [m.v + " : " + m.lib, a.G[jj][0], nd > 1 ? a.G[jj][1] : 0, m.v]; }),
    "Tracé joint des points de modalité", ["Dimension 1", "Dimension 2"]);
  const top = vars.map(function (v, i) { return [v, disc[i][0]]; }).sort(function (x, z) { return z[1] - x[1]; }).slice(0, 3).map(function (x) { return x[0]; });
  synthese_(S, "la dimension 1 est surtout structurée par " + top.join(", ") + " (mesures de discrimination les plus élevées) ; taux corrigé de Benzécri des 2 premiers axes = " +
    Math.round(100 * (Lb[1] ? Lb[1][4] : (Lb[0] ? Lb[0][4] : 0))) + " %.");
}

// =====================================================================
// ACP / ANALYSE FACTORIELLE  (= FACTOR /EXTRACTION PC /ROTATION VARIMAX)
// =====================================================================
function anaACP_(S, base, vars, meta, cfg) {
  if (vars.length < 3) throw new Error("ACP : au moins 3 variables");
  vars.forEach(function (x) { if (nature_(x, meta) === "nominale") throw new Error(x + " est nominale : utilisez ACM"); });
  const rows = base.filter(function (o) { return vars.every(function (c) { return okVal_(o[c], nature_(c, meta)); }); });
  const fe = poidsTests_(rows, cfg), n = sommeW_(rows) * fe, p = vars.length;
  if (rows.length < 3 * p) throw new Error("Trop peu d'observations complètes (" + rows.length + ") pour " + p + " variables");
  const st = vars.map(function (v) { return moyVar_(rows, function (o) { return o[v]; }); });
  if (st.some(function (s) { return !(s.sd > 0); })) throw new Error("Une variable est constante : retirez-la");
  const Rm = vars.map(function (va, a) { return vars.map(function (vb, b) { let s = 0; rows.forEach(function (o) { s += o._w * (o[va] - st[a].m) * (o[vb] - st[b].m); });
    return s / (sommeW_(rows) - 1) / (st[a].sd * st[b].sd); }); });
  const e = jacobi_(Rm), det = e.val.reduce(function (s, x) { return s * x; }, 1), iR = inverse_(Rm);
  let r2 = 0, a2 = 0;
  if (iR) for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) if (i !== j) { r2 += Rm[i][j] * Rm[i][j]; const aij = -iR[i][j] / Math.sqrt(iR[i][i] * iR[j][j]); a2 += aij * aij; }
  const kmo = iR ? r2 / (r2 + a2) : "", bart = det > 0 ? -(n - 1 - (2 * p + 5) / 6) * Math.log(det) : "", dfb = p * (p - 1) / 2;
  const kf = Math.max(1, e.val.filter(function (x) { return x > 1; }).length);
  const L = vars.map(function (_, i) { const l = []; for (let k = 0; k < kf; k++) l.push(e.vec[i][k] * Math.sqrt(Math.max(e.val[k], 0))); return l; });
  for (let k = 0; k < kf; k++) if (L.reduce(function (s, l) { return s + l[k]; }, 0) < 0) L.forEach(function (l) { l[k] = -l[k]; });
  const Lr = kf > 1 ? varimax_(L) : null;
  S.ligne(["Analyse factorielle — " + p + " variables, " + rows.length + " observations complètes"], "soustitre");
  S.tableau("Indice KMO et test de Bartlett", [["", "", ""]], [["Mesure de précision de l'échantillonnage de Kaiser-Meyer-Olkin.", "", kmo],
    ["Test de sphéricité de Bartlett", "Khi-deux approx.", bart], ["", "ddl", dfb], ["", "Signification", bart === "" ? "" : pKhi2_(bart, dfb)]], { nEtiq: 2, fmt: { 3: "n3" } });
  const com = L.map(function (l) { return l.reduce(function (s, x) { return s + x * x; }, 0); });
  S.tableau("Qualités de représentation", [["", "Initiales", "Extraction"]], vars.map(function (v, i) { return [v, 1, com[i]]; }),
    { nEtiq: 1, fmt: { 2: "n3", 3: "n3" }, notes: ["Méthode d'extraction : Analyse en composantes principales."] });
  const rot = Lr ? Lr[0].map(function (_, k) { return Lr.reduce(function (s, l) { return s + l[k] * l[k]; }, 0); }) : [];
  let c1 = 0, c2 = 0, c3 = 0;
  const Lv = e.val.map(function (v, k) {
    c1 += 100 * v / p; const row = [k + 1, v, 100 * v / p, c1];
    if (k < kf) { c2 += 100 * v / p; row.push(v, 100 * v / p, c2); } else row.push("", "", "");
    if (Lr && k < kf) { c3 += 100 * rot[k] / p; row.push(rot[k], 100 * rot[k] / p, c3); } else row.push("", "", "");
    return row;
  });
  S.tableau("Variance totale expliquée", [["Composante", f_("Valeurs propres initiales", 3), "", "", f_("Sommes extraites du carré des chargements", 3), "", "",
    f_("Sommes de rotation du carré des chargements", 3), "", ""], ["", "Total", "% de la variance", "% cumulé", "Total", "% de la variance", "% cumulé", "Total", "% de la variance", "% cumulé"]], Lv,
    { nEtiq: 1, fmt: { 2: "n3", 3: "n3", 4: "n3", 5: "n3", 6: "n3", 7: "n3", 8: "n3", 9: "n3", 10: "n3" }, notes: ["Méthode d'extraction : Analyse en composantes principales."] });
  const hk = [""]; for (let k = 0; k < kf; k++) hk.push(String(k + 1));
  const fm = (function () { const f = {}; for (let c = 2; c <= kf + 1; c++) f[c] = "n3"; return f; })();
  const lab = function (v) { return v + " " + String(meta[v].label).replace(/^Q\d+\. /, "").substr(0, 40); };
  S.tableau("Matrice des composantes a", [["", f_("Composante", kf)].concat(new Array(kf - 1).fill("")), hk], vars.map(function (v, i) { return [lab(v)].concat(L[i]); }),
    { nEtiq: 1, fmt: fm, notes: ["Méthode d'extraction : Analyse en composantes principales.", "a. " + kf + " composantes extraites.", "Signe des composantes arbitraire (peut être inversé par rapport à SPSS)."] });
  if (Lr) {
    const d = S.tableau("Matrice des composantes après rotation a", [["", f_("Composante", kf)].concat(new Array(kf - 1).fill("")), hk], vars.map(function (v, i) { return [lab(v)].concat(Lr[i]); }),
      { nEtiq: 1, fmt: fm, notes: ["Méthode d'extraction : Analyse en composantes principales.", "Méthode de rotation : Varimax avec normalisation Kaiser.", "Saturations ≥ |0,5| en couleur."] });
    Lr.forEach(function (l, i) { l.forEach(function (x, k) { if (Math.abs(x) >= 0.5) S.cell(x > 0 ? "vert" : "rouge", d + i, 2 + k); }); });
    const LtL = L[0].map(function (_, a) { return L[0].map(function (__, b) { return L.reduce(function (s, l) { return s + l[a] * l[b]; }, 0); }); });
    const iL = inverse_(LtL);
    if (iL) {
      const LtR = L[0].map(function (_, a) { return L[0].map(function (__, b) { return L.reduce(function (s, l, i) { return s + l[a] * Lr[i][b]; }, 0); }); });
      const Tm = iL.map(function (l) { return LtR[0].map(function (_, b) { return l.reduce(function (s, x, t) { return s + x * LtR[t][b]; }, 0); }); });
      S.tableau("Matrice de transformation des composantes", [["Composante"].concat(hk.slice(1))], Tm.map(function (l, k) { return [k + 1].concat(l); }),
        { nEtiq: 1, fmt: fm, notes: ["Méthode d'extraction : Analyse en composantes principales.", "Méthode de rotation : Varimax avec normalisation Kaiser."] });
    }
  } else S.ligne(["Une seule composante a été extraite. La solution ne peut pas subir de rotation."], "note");
  const def = (Lr || L)[0].map(function (_, k) { return "F" + (k + 1) + " = " + vars.filter(function (v, i) { return Math.abs((Lr || L)[i][k]) >= 0.5; }).join(" + "); });
  synthese_(S, "KMO = " + (kmo === "" ? "—" : kmo.toFixed(3)) + " ; " + kf + " facteur(s) expliquant " + Math.round(Lv[kf - 1][3]) + " % de la variance. " + def.join(" ; ") + ".");
}

// =====================================================================
// TYPOLOGIE  (= ACM puis QUICK CLUSTER sur les coordonnees factorielles)
// =====================================================================
function anaTypologie_(S, base, vars, kTxt, meta, cfg, ss, nomOnglet) {
  const R = calculACM_(base, vars, meta), a = R.a;
  const nax = Math.max(2, Math.min(5, R.benz.filter(function (x) { return x > 0; }).length, a.lam.length));
  const P = R.rows.map(function (o, i) { const ii = a.ri.indexOf(i); return ii >= 0 ? a.F[ii].slice(0, nax) : new Array(nax).fill(0); });
  const w = R.rows.map(function (o) { return o._w; }), sw = w.reduce(function (s, x) { return s + x; }, 0);
  const g = P[0].map(function (_, t) { return P.reduce(function (s, x, i) { return s + w[i] * x[t]; }, 0) / sw; });
  const tss = P.reduce(function (s, x, i) { return s + w[i] * x.reduce(function (a2, v, t) { return a2 + (v - g[t]) * (v - g[t]); }, 0); }, 0);
  const res = {};
  for (let k = 2; k <= 6; k++) { const km = kmeans_(P, w, k, 15, 12345 + k), bss = tss - km.wss; res[k] = { km: km, r2: bss / tss, ch: (bss / (k - 1)) / (km.wss / (sw - k)) }; }
  let kc = parseInt(String(kTxt || "").trim(), 10);
  if (!(kc >= 2 && kc <= 6)) { kc = 2; for (let k = 3; k <= 6; k++) if (res[k].ch > res[kc].ch) kc = k; }
  const km = res[kc].km;
  R.rows.forEach(function (o, i) { o._classe = km.lab[i] + 1; });
  S.ligne(["Typologie — ACM (" + nax + " dimensions) puis classification des nuées dynamiques (k-means)"], "soustitre");
  S.tableau("Choix du nombre de classes (complément)", [["Nombre de classes", "R² (inertie inter / totale)", "Pseudo-F de Calinski-Harabasz", "Retenu"]],
    [2, 3, 4, 5, 6].map(function (k) { return [k, res[k].r2, res[k].ch, k === kc ? "◄" : ""]; }), { nEtiq: 1, fmt: { 2: "pct1", 3: "n3" },
      notes: [String(kTxt || "").trim() ? "Nombre de classes imposé." : "Nombre de classes retenu : meilleur pseudo-F.", "15 initialisations k-means++ par solution (graine fixe : résultats reproductibles)."] });
  const hk = [""]; for (let c = 1; c <= kc; c++) hk.push(String(c));
  S.tableau("Centres de classes finaux", [["", f_("Classe", kc)].concat(new Array(kc - 1).fill("")), hk],
    P[0].map(function (_, t) { return ["Dimension " + (t + 1) + " (ACM)"].concat(km.C.map(function (c) { return c[t]; })); }),
    { nEtiq: 1, fmt: (function () { const f = {}; for (let c = 2; c <= kc + 1; c++) f[c] = "n3"; return f; })() });
  const tailles = []; for (let c = 1; c <= kc; c++) tailles.push(R.rows.filter(function (o) { return o._classe === c; }));
  const La = P[0].map(function (_, t) {
    let bss = 0, wss = 0;
    km.C.forEach(function (c, j) { const nj = tailles[j].reduce(function (s, o) { return s + o._w; }, 0); bss += nj * (c[t] - g[t]) * (c[t] - g[t]); });
    P.forEach(function (x, i) { wss += w[i] * (x[t] - km.C[km.lab[i]][t]) * (x[t] - km.C[km.lab[i]][t]); });
    const d1 = kc - 1, d2 = sw - kc, F = wss > 0 ? (bss / d1) / (wss / d2) : "";
    return ["Dimension " + (t + 1), bss / d1, d1, wss / d2, arr_(d2, 3), F, F === "" ? "" : pFisherF_(F, d1, d2)];
  });
  S.tableau("ANOVA", [["", f_("Classe", 2), "", f_("Erreur", 2), "", "F", "Sig."], ["", "Carré moyen", "ddl", "Carré moyen", "ddl", "", ""]], La,
    { nEtiq: 1, fmt: { 2: "n3", 4: "n3", 6: "n3", 7: "n3" }, notes: ["Les tests F ne doivent être utilisés que dans un but descriptif car les classes ont été choisies de manière à maximiser les différences entre les observations " +
      "de différentes classes. Les niveaux de signification observés ne sont pas corrigés et ne peuvent donc pas être interprétés comme des tests de l'hypothèse selon laquelle les moyennes des classes sont égales."] });
  const Ln = tailles.map(function (t, c) { return [c === 0 ? "Classe" : "", c + 1, t.length]; });
  Ln.push(["Valide", "", R.rows.length], ["Manquant", "", base.length - R.rows.length]);
  S.tableau("Nombre d'observations dans chaque classe", [["", "", ""]], Ln, { nEtiq: 2, fmt: { 3: "n0" } });
  // Portrait des classes (complement) : modalites actives et illustratives
  const desc = vars.concat(["CODEZONE", "VOUSETES"].filter(function (x) { return vars.indexOf(x) < 0; }));
  const prof = [], zc = zCritique_(cfg.alpha);
  desc.forEach(function (v) {
    const mods = modalites_(v, meta);
    const O = mods.map(function (m) { return tailles.map(function (t) { return t.reduce(function (s, o) { return s + (o[v] === m[0] ? o._w : 0); }, 0); }); });
    const kk = khiDeux_(O);
    const totG = O.reduce(function (s, l) { return s + l.reduce(function (a2, x) { return a2 + x; }, 0); }, 0);
    mods.forEach(function (m, i) {
      const tot = O[i].reduce(function (s, x) { return s + x; }, 0); if (!tot) return;
      prof.push({ v: v, lib: m[1], ill: vars.indexOf(v) < 0, z: kk.z[i], ens: tot / totG,
        pc: tailles.map(function (t, c) { const bs = O.reduce(function (s, l) { return s + l[c]; }, 0); return bs ? O[i][c] / bs : 0; }) });
    });
  });
  const Lp = [];
  for (let c = 0; c < kc; c++) {
    const car = prof.filter(function (l) { return l.z[c] !== "" && l.z[c] >= zc; }).sort(function (x, y) { return y.z[c] - x.z[c]; }).slice(0, 8);
    Lp.push(["Classe " + (c + 1) + " (" + Math.round(100 * sommeW_(tailles[c]) / sw) + " %)", car.map(function (l) {
      return l.v + " = " + l.lib + " (" + Math.round(100 * l.pc[c]) + " % vs " + Math.round(100 * l.ens) + " %)" + (l.ill ? " [illustr.]" : ""); }).join(" · ") || "aucune modalité significative"]);
  }
  S.tableau("Portrait des classes (complément) — modalités sur-représentées", [["Classe", "Modalités caractéristiques (% dans la classe vs % dans l'ensemble)"]], Lp, { nEtiq: 1 });
  const d = S.tableau("Profil des classes (complément) — % de chaque modalité par classe", [["Variable", "Modalité"].concat(hk.slice(1).map(function (c) { return "Classe " + c; })).concat(["Ensemble"])],
    prof.map(function (l) { return [l.v + (l.ill ? " (illustr.)" : ""), l.lib].concat(l.pc).concat([l.ens]); }),
    { nEtiq: 2, fmt: (function () { const f = {}; for (let c = 3; c <= kc + 3; c++) f[c] = "pct1"; return f; })(), notes: ["Vert/rouge : modalité sur/sous-représentée dans la classe (résidu ajusté). (illustr.) = variable illustrative."] });
  prof.forEach(function (l, t) { l.z.forEach(function (z, c) { if (z !== "" && Math.abs(z) >= zc) S.cell(z > 0 ? "vert" : "rouge", d + t, 3 + c); }); });
  if (ss) {
    const nom = (nomOnglet + "_CLASSES").substr(0, 99);
    let sh = ss.getSheetByName(nom); if (sh) sh.clear(); else sh = ss.insertSheet(nom, ss.getSheets().length);
    const data = [["NUMFICHE", "CODEENQU", "CODEZONE", "VOUSETES", "CLASSE"]].concat(R.rows.map(function (o) { return [o.NUMFICHE, o.CODEENQU, o.CODEZONE, o.VOUSETES, o._classe]; }));
    sh.getRange(1, 1, data.length, 5).setValues(data); styleEntete_(sh.getRange(1, 1, 1, 5)); sh.setFrozenRows(1);
  }
  synthese_(S, kc + " classes (R² = " + Math.round(100 * res[kc].r2) + " %). Voir le portrait des classes ; l'affectation de chaque fiche est dans l'onglet " + nomOnglet + "_CLASSES.");
}

// =====================================================================
// 17. MISE A JOUR V2 -> V3 (questionnaire « 03 » + cahier des charges « 02 »)
//     Le formulaire existant est modifie SUR PLACE : meme lien public,
//     memes liens personnels des enqueteurs, reponses deja recues conservees.
// =====================================================================

/** Cree (item = null) ou met a jour une question du formulaire selon le dictionnaire.
 *  @return {{item: Object, cree: boolean, change: boolean}} */
function appliquerItem_(form, it, item) {
  const T = FormApp.ItemType;
  const attendu = it.type === "radio" ? T.MULTIPLE_CHOICE : it.type === "multi" ? T.CHECKBOX :
                  it.type === "grille" ? T.GRID : T.PARAGRAPH_TEXT;
  let change = false;
  if (item && item.getType() !== attendu) { change = true; item = null; }
  const cree = !item;
  let x;
  if (it.type === "radio") {
    x = item ? item.asMultipleChoiceItem() : form.addMultipleChoiceItem();
    x.setTitle(it.q).setRequired(true).setHelpText(it.aide || "");
    x.setChoiceValues(it.choix.map(function (c) { return c[1]; }));
    x.showOtherOption(!!it.autre);
  } else if (it.type === "multi") {
    x = item ? item.asCheckboxItem() : form.addCheckboxItem();
    x.setTitle(it.q).setRequired(true).setHelpText(it.aide || "");
    x.setChoiceValues(it.sousItems.map(function (s) { return s[1]; }));
  } else if (it.type === "grille") {
    x = item ? item.asGridItem() : form.addGridItem();
    x.setTitle(it.q).setRequired(true).setHelpText(it.aide || "");      // requis = une reponse par ligne
    x.setRows(it.lignes.map(function (l) { return l[1]; }));
    x.setColumns(it.choix.map(function (c) { return c[1]; }));
  } else {
    x = item ? item.asParagraphTextItem() : form.addParagraphTextItem();
    x.setTitle(it.q).setRequired(false);
  }
  return { item: x, cree: cree, change: change };
}

/** Remet le formulaire dans l'ordre exact du questionnaire V3. Ne supprime AUCUNE question. */
function migrerQuestionnaireV3_(form) {
  const journal = [];
  const parTitre = {};
  form.getItems().forEach(function (x) { const k = norm_(x.getTitle()); if (!(k in parTitre)) parTitre[k] = x; });

  // Bloc d'identification (enqueteur, quartier, site, nom, tel, e-mail, accord) : garde en tete
  const place = {};
  let pos = 0;
  [TITRE_ENQ, TITRE_QUARTIER, TITRE_SITE_ANCIEN, TITRE_SITE, TITRE_NOM, TITRE_TEL, TITRE_MAIL, TITRE_ACCORD].forEach(function (t) {
    const x = parTitre[norm_(t)];
    if (x) { place[x.getId()] = true; pos = Math.max(pos, x.getIndex() + 1); }
  });

  let section = null;
  ITEMS.forEach(function (it) {
    if (it.section !== section) {
      section = it.section;
      let h = parTitre[norm_(section)];
      if (!h || h.getType() !== FormApp.ItemType.SECTION_HEADER || place[h.getId()]) {
        h = form.addSectionHeaderItem().setTitle(section);
        journal.push("+ titre de section ajouté : " + section);
      }
      form.moveItem(h.getIndex(), pos); pos++; place[h.getId()] = true;
    }
    let x = parTitre[norm_(it.q)] || (it.ancien ? parTitre[norm_(it.ancien)] : null) || null;
    if (x && place[x.getId()]) x = null;
    const avant = x ? x.getTitle() : "";
    const r = appliquerItem_(form, it, x);
    form.moveItem(r.item.getIndex(), pos); pos++; place[r.item.getId()] = true;
    if (r.change) journal.push("⚠ type différent : « " + avant + " » laissée en fin de formulaire ; nouvelle question créée : " + it.q);
    else if (r.cree) journal.push("+ ajoutée : " + it.q);
    else if (norm_(avant) !== norm_(it.q)) journal.push("~ renumérotée : « " + avant + " » → « " + it.q + " »");
    else journal.push("= vérifiée : " + it.q);
  });

  // Restes : titres de section orphelins supprimes ; questions inconnues laissees en fin (aucune donnee detruite)
  form.getItems().filter(function (x) { return !place[x.getId()]; }).forEach(function (x) {
    if (x.getType() === FormApp.ItemType.SECTION_HEADER) {
      journal.push("- titre de section orphelin supprimé : " + x.getTitle());
      form.deleteItem(x);
    } else {
      journal.push("⚠ question hors questionnaire V3, laissée en fin de formulaire (réponses conservées) : " + x.getTitle());
    }
  });
  return journal;
}

/** Supprime un onglet sans jamais supprimer l'onglet ACTIF (source des erreurs
 *  « Sheet xxx not found » / « Service Spreadsheets failed »). */
function supprimerOnglet_(ss, s) {
  if (!s) return;
  const id = s.getSheetId();
  const autre = ss.getSheets().filter(function (x) { return x.getSheetId() !== id; })[0];
  if (!autre) return;                                     // jamais le dernier onglet du classeur
  try { ss.setActiveSheet(autre); } catch (e) { /* sans effet si deja actif */ }
  ss.deleteSheet(s);
  SpreadsheetApp.flush();
}

/** Rouvre le classeur : apres suppression/recreation d'onglets, l'ancien objet
 *  Spreadsheet garde en memoire des onglets disparus (« Sheet xxx not found »). */
function ssFrais_() {
  SpreadsheetApp.flush();
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || CLASSEUR_ID;
  return SpreadsheetApp.openById(id);
}

function ecrireJournal_(ss, lignes) {
  ss = ssFrais_();
  let sh = ss.getSheetByName("JOURNAL_MIGRATION_V3");
  if (!sh) {
    sh = ss.insertSheet("JOURNAL_MIGRATION_V3", ss.getSheets().length);
    sh.getRange(1, 1, 1, 2).setValues([["DATE", "ACTION"]]);
    styleEntete_(sh.getRange(1, 1, 1, 2));
    sh.setColumnWidth(1, 140); sh.setColumnWidth(2, 900);
    sh.setFrozenRows(1);
  }
  const t = Utilities.formatDate(new Date(), CONFIG.FUSEAU, "dd/MM/yyyy HH:mm");
  if (lignes.length) sh.getRange(sh.getLastRow() + 1, 1, lignes.length, 2).setValues(lignes.map(function (l) { return [t, l]; }));
}

/** ETAPE 1 : formulaire + masque + tableau de bord + tri a plat + dictionnaire + contacts. */
function migrerV3_etape1() {
  const props = PropertiesService.getScriptProperties();
  const ss = contexte_();
  const form = FormApp.openById(props.getProperty("FORM_ID"));
  const nRep = form.getResponses().length;

  const journal = ["ÉTAPE 1 — " + nRep + " réponse(s) déjà reçue(s) : conservées et recodées."].concat(migrerQuestionnaireV3_(form));
  feuilleContacts_(ss).getRange(1, 1, 1, ENTETE_CONTACTS.length).setValues([ENTETE_CONTACTS]);
  SpreadsheetApp.flush();

  mettreAJourCodes();          // en-tetes du masque, TABLEAU_DE_BORD, TRI_A_PLAT, DICTIONNAIRE + recodage complet
  corrigerFormat();            // format date, couleurs et liste STATUTQC sur les nouvelles colonnes

  const sh = ssFrais_().getSheetByName("MASQUE_DEPOUILLEMENT");
  const nMasque = Math.max(sh.getLastRow() - CONFIG.PREMIERE_LIGNE_DONNEES + 1, 0);
  journal.push("Masque : " + colonnesMasque_().length + " colonnes, " + nMasque + " fiche(s) recodée(s) (attendu : " + nRep + ").");
  journal.push(nRep === nMasque ? "✔ ÉTAPE 1 TERMINÉE — lancez migrerV3_etape2()." : "⚠ Écart réponses / masque : relancez reparer().");
  props.setProperty("VERSION_QUESTIONNAIRE", "V3");
  ecrireJournal_(ss, journal);
  journal.forEach(function (l) { Logger.log(l); });
  Logger.log("Formulaire : " + form.getEditUrl());
}

/** ETAPE 2 : reconstruit les onglets complementaires QUI EXISTENT deja dans le classeur. */
function migrerV3_etape2() {
  contexte_();
  const existe = function (n) { return !!ssFrais_().getSheetByName(n); };
  const fait = ["ÉTAPE 2"];
  if (existe("REF_CODES") || existe("CONTROLE_CODIFICATION")) { creerControleCodification(); fait.push("✔ CONTROLE_CODIFICATION + REF_CODES (grille Q23 incluse)"); }
  if (existe("CIBLES") || existe("SUIVI_CIBLES")) { creerSuiviCibles(); fait.push("✔ CIBLES + SUIVI_CIBLES (quotas du cahier des charges : 200 / 200 / 100)"); }
  if (existe("VARS_CROIS") || existe("CROISEMENT_1")) { creerTableauxCroises(); fait.push("✔ CROISEMENT_1 à 4 (sélections remises par défaut)"); }
  if (existe("LISTE_VARIABLES")) { creerListeVariables_(ssFrais_()); fait.push("✔ LISTE_VARIABLES"); }
  const plan = ssFrais_().getSheetByName("PLAN_ANALYSES");
  if (plan) { fait.push(ajouterLignesPlanV3_(plan)); }
  if (existe("EXPORT_SPSS")) { exporterPourSPSS(); fait.push("✔ EXPORT_SPSS"); }
  if (existe("SYNTAXE_SPSS")) { genererSyntaxeSPSS(); fait.push("✔ SYNTAXE_SPSS"); }
  if (fait.length === 1) fait.push("Aucun onglet complémentaire à mettre à jour.");
  fait.push("✔ MIGRATION V3 TERMINÉE.");
  ecrireJournal_(null, fait);
  fait.forEach(function (l) { Logger.log(l); });
}

/** Ajoute au PLAN_ANALYSES existant les analyses du bloc « gammes » et met a jour la liste des cibles. */
function ajouterLignesPlanV3_(sh) {
  const v = sh.getRange(PLAN_L0, 1, PLAN_NLIGNES, 9).getValues();
  const titres = v.map(function (l) { return norm_(l[8]); });
  const vides = []; v.forEach(function (l, i) { if (!String(l[2]).trim()) vides.push(i); });
  let n = 0;
  PLAN_DEFAUT.filter(function (d) { return /DEAVHAGA|PXHAUTGA|ORASHAGA/.test(d[1]); }).forEach(function (d) {
    if (titres.indexOf(norm_(d[3])) >= 0 || !vides.length) return;
    sh.getRange(PLAN_L0 + vides.shift(), 2, 1, 8).setValues([["Oui", d[0], d[1], d[2], "Toutes", "Toutes", "Tous", d[3]]]);
    n++;
  });
  // Filtre cible : nouvelles modalites de Q1 (les anciens libelles sont convertis)
  const q1 = ITEMS.filter(function (it) { return it.code === "VOUSETES"; })[0];
  const cibles = q1.choix.map(function (c) { return c[1]; });
  const g = sh.getRange(PLAN_L0, 7, PLAN_NLIGNES, 1);
  g.setValues(g.getValues().map(function (l) {
    const x = String(l[0]);
    return [x === "Revendeur/grossiste" ? "Revendeur/Grossiste/Distributeur" : (x && x !== "Toutes" && cibles.indexOf(x) < 0 ? "Toutes" : (x || "Toutes"))];
  }));
  g.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Toutes"].concat(cibles), true).build());
  return "✔ PLAN_ANALYSES : " + n + " analyse(s) du bloc gammes ajoutée(s), filtre cible mis à jour — cochez B2 pour recalculer.";
}
