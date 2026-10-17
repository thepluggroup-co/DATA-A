/**
 * =====================================================================
 *  EDM ELECTRIQUE CAMEROUN - MASQUE CODIFIE TEMPS REEL
 *  Version 11 (07/10/2026) - TRI A PLAT CONTROLE + FICHES VIDES SIGNALEES + JOUR 4
 *  (contient toute la V10 : synchronisation, suivi par jour, rapports, anglais)
 *  Formulaire : https://docs.google.com/forms/d/e/1FAIpQLSdEmfwEHV-E0wI1IcUgGthmc7pB9UaOnIjz0NyeCMX7bqEzhw/viewform
 * =====================================================================
 *
 *  >>> MISE A JOUR (3 minutes, les enqueteurs continuent) <<<
 *   1. Projet Apps Script actuel : remplacer TOUT le code par ce fichier, enregistrer.
 *   2. Executer la fonction « mettreAJour » (une seule fois). C'est tout.
 *
 *  CE QUE CETTE VERSION CORRIGE (constate dans le classeur le 07/10 au matin)
 *   - « 228 fiches au tableau de bord, mais moins dans Q1 Vous etes » : 4 fiches du 06/10
 *     (11 h 15 - 11 h 22) ont ete envoyees avec l'identification seule, sans aucune reponse
 *     au questionnaire. Elles etaient comptees comme valides (statut OK) et n'apparaissaient
 *     dans le tri a plat que sur la ligne « 99 Non-reponse », sans total. Desormais :
 *       . une fiche sans aucune reponse porte l'anomalie FICHE_VIDE, une fiche sans Q1 porte
 *         Q1_VIDE ; les deux passent en A_VERIFIER (au superviseur d'ecrire REJETE) ;
 *       . TRI_A_PLAT : chaque question se termine par une ligne TOTAL egale a la base ; la
 *         ligne 99 passe en orange des qu'elle n'est pas vide ; un controle en ligne 3 ;
 *       . SUIVI_CIBLES : lignes « Q1 non renseignee » et « TOTAL GENERAL (= tableau de bord) » ;
 *       . TABLEAU_DE_BORD, RECAP_JOURS et rapports : nombre de fiches sans Q1 affiche.
 *   - Nouvelle fonction « verifierFormulaire » (lancee aussi par mettreAJour) : rend Q1
 *     obligatoire en francais et en anglais si elle ne l'est pas, et cherche dans les pages
 *     du formulaire un chemin qui permettrait d'envoyer une fiche sans Q1.
 *
 *  JOUR 4 (PROLONGATION)
 *   - Une ligne DATE_J4 est ajoutee en bas de l'onglet PARAMETRES et remplie avec le
 *     lendemain de DATE_J3 (08/10/2026 si J3 = 07/10). Modifiable ; la vider = pas de J4.
 *   - Tous les tableaux ont une colonne J4 : TABLEAU_DE_BORD, TRI_A_PLAT, SUIVI_CIBLES,
 *     RECAP_JOURS. Le rapport RAPPORT_J4 se genere tout seul comme les autres.
 *   - L'objectif par enqueteur (objectif/jour x NB_JOURS = 75) n'est PAS modifie : le jour 4
 *     sert a rattraper, pas a augmenter l'objectif. Pour le changer : NB_JOURS dans PARAMETRES.
 *   - Les rapports comptent J4 comme un jour restant pour toutes les villes. Si une ville
 *     n'est pas prolongee, lire sa ligne « requis par enqueteur et par jour » en consequence.
 *
 *  TOUT EST AUTOMATIQUE APRES « mettreAJour » (rien a relancer)
 *   - Chaque fiche arrive dans le masque a la soumission ; les colonnes J1 a J4, AUJOURD'HUI
 *     et CUMUL de tous les tableaux sont des formules : elles bougent seules.
 *   - Toutes les 10 minutes : rattrapage des fiches manquantes, controle des dates J1 a J3.
 *   - Rapport du jour en cours regenere toutes les heures (PROVISOIRE), definitif a 19 h.
 *
 *  FONCTIONS
 *   - mettreAJour()         -> a lancer une fois apres avoir colle cette version
 *   - verifierFormulaire()  -> Q1 obligatoire + recherche d'un chemin d'envoi sans Q1
 *   - rapportJournalier()   -> (re)genere les rapports RAPPORT_J1 a J4
 *   - calerJours()          -> recale DATE_J1 a J3 sur les jours reels de collecte
 *   - reparer()             -> en cas de doute sur la synchronisation + bilan SANTE_SYNC
 *   - sante()               -> bilan de synchronisation seul (ne modifie rien)
 *   - actualiser()          -> apres modification de l'onglet ENQUETEURS (zones, noms)
 *   - reconstruireMasque()  -> recode toutes les reponses
 *   - diagnostiquer()       -> compare le formulaire au dictionnaire
 *   - exporterPourSPSS()    -> onglet EXPORT_SPSS, a telecharger en EXPORT_SPSS.csv
 *   - ajouterAnglaisAuFormulaire() -> deja fait sur ce formulaire (un 2e lancement ne fait rien)
 *
 *  CONTROLE QUALITE : colonne STATUTQC = OK / A_VERIFIER (automatique) ; le superviseur
 *  peut ecrire OK (fiche verifiee) ou REJETE (fiche exclue du suivi, du tri a plat, des
 *  rapports et de l'export). NE PAS trier ni inserer de lignes dans MASQUE_DEPOUILLEMENT.
 *  Les 67 variables et les scripts SPSS ne changent pas.
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

// Jours de terrain suivis dans les tableaux et les rapports (J4 = prolongation)
const NJ = 4;
const JK = [1, 2, 3, 4];

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
  { champ: "enq",      cles: ["identifiantenqueteur", "enumeratorid"],          titre: "Identifiant enquêteur" },
  { champ: "accord",   cles: ["recontacte", "contactedagain"],                    titre: "L'enquêté accepte d'être recontacté à des fins commerciales" },
  { champ: "site",     cles: ["siteprecis", "exactsite"],                    titre: "Site précis / repère" },
  { champ: "quartier", cles: ["quartier", "neighbourhood"],                      titre: "Quartier / zone" },
  { champ: "tel",      cles: ["telephone", "phone"],                     titre: "Téléphone de l'enquêté" },
  { champ: "mail",     cles: ["email", "mail"],                 titre: "E-mail de l'enquêté" },
  { champ: "nom",      cles: ["nomdelenquete", "raisonsociale", "respondentsname", "companyname"], titre: "Nom de l'enquêté ou raison sociale" }
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
    if (n) { if (!(n in out.q) || vide_(out.q[n].rep)) out.q[n] = { rep: x.rep, lignes: x.lignes || null }; return; }   // FR ou EN : la version repondue
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
      let code = chercherCode_(it.choix, fr_(it, r));
      if (code === null && it.alias) {
        const a = Object.keys(it.alias).filter(function (x) { return cle_(x) === cle_(r); })[0];
        if (a) code = it.alias[a];
      }
      if (code !== null) { valeurs[it.code] = code; return; }
      if (it.autre) { valeurs[it.code] = it.autre.code; valeurs[it.autre.variable] = r; return; }
      valeurs[it.code] = NR; anomalies.push("CODE_INCONNU:" + it.code);
    } else if (it.type === "multi") {
      if (absent) { it.sousItems.forEach(function (s) { valeurs[s[0]] = NR; }); return; }
      const coches = (Array.isArray(brut) ? brut : [brut]).map(function (x) { return cle_(fr_(it, x)); });
      it.sousItems.forEach(function (s) { valeurs[s[0]] = coches.indexOf(cle_(s[1])) >= 0 ? 1 : 0; });
      const connus = it.sousItems.map(function (s) { return cle_(s[1]); });
      if (coches.some(function (c) { return c && connus.indexOf(c) < 0; })) anomalies.push("CODE_INCONNU:" + it.code);
    } else if (it.type === "grille") {
      const rep = absent ? [] : (Array.isArray(brut) ? brut : [brut]);
      const lignesForm = src && src.lignes ? src.lignes.map(function (x) { return cle_(frLigne_(it, x)); }) : null;
      it.lignes.forEach(function (li, k) {
        const idx = lignesForm ? lignesForm.indexOf(cle_(li[1])) : k;
        const r = idx >= 0 ? rep[idx] : null;
        if (vide_(r)) { valeurs[li[0]] = NR; return; }
        const code = chercherCode_(it.choix, fr_(it, r));
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
  // Fiche envoyee sans questionnaire, ou sans Q1 (la ville Q4, pre-remplie par le lien, ne compte pas)
  const nRep = varsQuestions_().filter(function (q) { return q[0] !== "VILLEREG" && valeurs[q[0]] !== NR; }).length;
  if (!nRep) anomalies.push("FICHE_VIDE");
  else if (valeurs.VOUSETES === NR) anomalies.push("Q1_VIDE");
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
  v.ACCRECON = /^(oui|yes)$/.test(cle_(accord)) ? 1 : (/^(non|no)$/.test(cle_(accord)) ? 2 : CONFIG.CODE_NR);

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

  const q = fiche.lu.q, r = function (n) {                      // libelles francais, meme si la fiche est saisie en anglais
    if (!q[n]) return "";
    const it = ITEMS.filter(function (x) { return x.n === n; })[0], rp = q[n].rep;
    const t = function (x) { return it ? fr_(it, x) : x; };
    return Array.isArray(rp) ? rp.filter(function (y) { return y; }).map(t).join(", ") : norm_(t(rp));
  };
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

/** Un identifiant d'enqueteur est un mot court sans espace (ENQ1, ENQ12…) : exclut les notes ecrites dans l'onglet. */
function estIdEnq_(x) { const t = norm_(x); return t !== "" && t.length <= 15 && !/\s/.test(t); }

function lireEnqueteurs_(ss) {
  const sh = ss.getSheetByName("ENQUETEURS"), map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (l) {
    if (estIdEnq_(l[0])) map[norm_(l[0]).toUpperCase()] = norm_(l[2]).toUpperCase();
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
  assurerJours_(ss);
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
  creerRecapJours_(ss);
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
  creerRecapJours_(ss);
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
    if (estIdEnq_(l[0])) avant[norm_(l[0]).toUpperCase()] = { nom: l[1], zone: norm_(l[2]).toUpperCase() };
  });
  Object.keys(avant).forEach(function (k) { if (ids.indexOf(k) < 0) ids.push(k); });

  const itemVille = items.filter(function (x) { return numeroQuestion_(x.getTitle()) === 4; })[0];
  const formEnq = formulaireAnglais_();
  const lignes = [["ENQ_ID", "NOM_ENQUETEUR", "ZONE", "OBJECTIF_TOTAL", "LIEN_PERSONNEL", "DANS LE FORMULAIRE", "LIEN_PERSONNEL_EN"]];
  ids.forEach(function (e) {
    const zid = avant[e] ? avant[e].zone : (ZONES_PAR_DEFAUT[e] || "");
    const zone = ZONES.filter(function (z) { return z.id === zid; })[0];
    let url = "";
    const dansForm = itemEnq.getType() === T.LIST
      ? itemEnq.asListItem().getChoices().some(function (c) { return norm_(c.getValue()).toUpperCase() === e; })
      : itemEnq.asMultipleChoiceItem().getChoices().some(function (c) { return norm_(c.getValue()).toUpperCase() === e; });
    if (dansForm) {
      url = lienPersonnel_(form, e, zone);
    }
    lignes.push([e, avant[e] ? avant[e].nom : "", zid, "=P_OBJ_JOUR*P_NB_JOURS", url, dansForm ? "Oui" : "NON : absent de la liste du formulaire",
      formEnq ? lienPersonnel_(formEnq, e, zone) : ""]);
  });
  // Onglet jamais supprime ni vide (d'autres onglets y font reference) : les donnees sont
  // reecrites par-dessus en une seule operation, la mise en forme vient ensuite.
  let sh = ss.getSheetByName("ENQUETEURS");
  if (!sh) sh = ss.insertSheet("ENQUETEURS", ss.getSheets().length);
  if (sh.getMaxColumns() < 7) sh.insertColumnsAfter(sh.getMaxColumns(), 7 - sh.getMaxColumns());
  const dernier = sh.getLastRow();
  sh.getRange(1, 1, lignes.length, 7).setValues(lignes);
  if (dernier > lignes.length) sh.getRange(lignes.length + 1, 1, dernier - lignes.length, sh.getMaxColumns()).clearContent();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations(); sh.clearConditionalFormatRules();
  styleEntete_(sh.getRange(1, 1, 1, 7));
  sh.getRange(2, 2, ids.length, 2).setBackground("#FFF2CC");
  sh.getRange(2, 3, ids.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ZONES.map(function (z) { return z.id; }), true).build());
  sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenCellEmpty()
    .setBackground("#F4CCCC").setRanges([sh.getRange(2, 3, ids.length, 1)]).build()]);
  sh.setColumnWidth(2, 200); sh.setColumnWidth(5, 420); sh.setColumnWidth(6, 260); sh.setColumnWidth(7, 420);
  sh.setFrozenRows(1);
  sh.getRange(ids.length + 3, 2).setValue("Case ZONE en rouge = à saisir, puis exécuter actualiser() : sans zone, la fiche prend la ville de Q4 et est marquée ZONE_ENQ_NON_PARAMETREE.")
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
    if (n) {
      if (!parNum[n]) parNum[n] = x;
      else if (EN.q[n] && cle_(x.getTitle()) === cle_(EN.q[n].q)) vus[x.getId()] = true;          // version anglaise de la question
      else L.push([x.getTitle(), "⚠", "Numéro Q" + n + " en double : seule la 1re question est codée"]);
    } else if (cle_(x.getTitle()) === cle_(EN.langue)) vus[x.getId()] = true;
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
  const rejId = {}, rejNum = {}, seqConnu = {}, valide = {};
  let nRej = 0, nOk = 0;
  data.forEach(function (l) {
    const id = norm_(l[nC]), num = norm_(l[0]);
    if (l[iStat] === "REJETE") { if (id) rejId[id] = true; else if (num) rejNum[num] = true; }
    if (id && l[iStat] === "OK" && norm_(l[iStat - 1])) valide[id] = norm_(l[iStat - 1]);     // anomalies vues et validees par le superviseur
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
    else if (l[iStat] === "A_VERIFIER" && valide[f.id] === norm_(l[iStat - 1])) { l[iStat] = "OK"; x.contact[x.contact.length - 1] = "OK"; nOk++; }
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
  return { n: lignes.length, rejetes: nRej, valides: nOk };
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
    let reps = complet ? toutesReponses_(null) : toutesReponses_(new Date(t0 - 20 * 60000));
    if (reponseDirecte && !reps.some(function (r) { return r.getId() === reponseDirecte.getId(); })) reps.push(reponseDirecte);

    const plan = planSync_(data.map(function (l) { return { id: norm_(l[nC]), num: norm_(l[0]) }; }),
                           reps.map(function (r) { return { id: r.getId() }; }), complet);
    if (forcer && plan.mode !== "RECONSTRUIRE") { plan.mode = "RECONSTRUIRE"; plan.raisons.push("demande manuelle"); }

    if (plan.mode === "RECONSTRUIRE") {
      if (!complet) reps = toutesReponses_(null);
      const r = reconstruire_(ss, sh, data, reps, props);
      plan.n = r.n;
      journal_(ss, source, "Masque reconstruit : " + r.n + " fiche(s) pour " + reps.length + " réponse(s), " + r.rejetes +
        " REJETE et " + r.valides + " OK superviseur conservé(s). Motif : " + plan.raisons.join(" ; "));
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
    // La reponse recue est relue dans son formulaire (francais ou anglais) par la synchronisation elle-meme.
    synchroniser_("SOUMISSION", null, false, false);
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
  try { suiviAutomatique_(); }
  catch (err) { try { journal_(classeur_(), "ERREUR", "SUIVI AUTO : " + err.message); } catch (e2) { /* rien */ } }
}

const MINUTES_ENTRE_RAPPORTS = 55;     // rapport du jour en cours : au plus un par heure

/**
 * Suivi sans intervention (appele toutes les 10 minutes par le filet de securite) :
 *  1. DATE_J1 a J3 sont recalees si elles ne correspondent a aucun jour de collecte ;
 *  2. le rapport du jour en cours est regenere s'il y a de nouvelles fiches depuis une heure.
 */
function suiviAutomatique_() {
  const ss = classeur_(), props = PropertiesService.getScriptProperties(), base = lireBase_(ss);
  calerJours_(ss, base);
  const mnt = new Date(), aujourdhui = fmtDouala_(mnt, "yyyy-MM-dd"), h = Number(fmtDouala_(mnt, "HH"));
  if (h < 7 || h >= 19) return "";                                  // le soir, le rapport definitif de 19 h prend le relais
  const n = base.filter(function (o) { return o._jour === aujourdhui; }).length;
  if (!n) return "";
  const m = String(props.getProperty("RAPPORT_AUTO") || "").split("|");
  const recent = m[0] && fmtDouala_(new Date(Number(m[0])), "yyyy-MM-dd") === aujourdhui;
  if (recent && (Number(m[1]) === n || mnt.getTime() - Number(m[0]) < MINUTES_ENTRE_RAPPORTS * 60000)) return "";
  return rapports_(true).join(" ; ");
}

/** Recode toutes les reponses du formulaire (conserve les REJETE et les N° de fiche). */
function reconstruireMasque() {
  const plan = synchroniser_("MANUEL", null, true, true);
  Logger.log(plan.mode === "OCCUPE" ? "Synchronisation déjà en cours : relancez dans une minute." : plan.n + " fiche(s) dans le masque.");
}

function installerDeclencheurs_(form) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (["surSoumission", "filetDeSecurite", "rapportJournalier"].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("surSoumission").forForm(form).onFormSubmit().create();
  const formEn = formulaireAnglais_();
  if (formEn) ScriptApp.newTrigger("surSoumission").forForm(formEn).onFormSubmit().create();
  ScriptApp.newTrigger("filetDeSecurite").timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger("rapportJournalier").timeBased().everyDays(1).atHour(19).inTimezone(CONFIG.FUSEAU).create();   // rapport du soir
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
  const reps = toutesReponses_(null), nForm = formulaireAnglais_() ? 2 : 1;
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
  const jP = JK.map(function (k) { return "P_J" + k; }).map(function (k) {
    try { const v = ss.getRangeByName(k).getValue(); return v instanceof Date ? fmtDouala_(v, "dd/MM/yyyy") : "(non saisie)"; } catch (e) { return "(introuvable)"; }
  });

  const L = [["CONTRÔLE", "VALEUR", "ÉTAT", "QUE FAIRE"]];
  const ok = function (c) { return c ? "✔" : "✘"; };
  const ecart = reps.length - nFiches;
  L.push(["Réponses dans le(s) formulaire(s)", reps.length, "", nForm === 2 ? "dont " + reps.filter(function (r) { return r.getId().indexOf("EN:") === 0; }).length + " par le formulaire anglais" : ""]);
  L.push(["Fiches dans le masque", nFiches, ok(ecart === 0), ecart === 0 ? "" : "Écart de " + ecart + " : exécuter reparer()"]);
  L.push(["Réponses absentes du masque", plan.aAjouter.length, ok(!plan.aAjouter.length), plan.aAjouter.length ? "Rattrapage automatique sous 10 min, ou reparer()" : ""]);
  L.push(["Fiches en double dans le masque", plan.doublons, ok(!plan.doublons), plan.doublons ? "reparer()" : ""]);
  L.push(["Lignes sans identifiant de réponse", plan.sansId, ok(!plan.sansId),
    plan.sansId ? "Si elles reviennent après reparer() : un AUTRE script écrit dans ce masque. Supprimer son déclencheur sur script.google.com > Déclencheurs" : ""]);
  L.push(["Fiches dont la réponse a été supprimée du formulaire", plan.orphelines, ok(!plan.orphelines), plan.orphelines ? "reparer()" : ""]);
  L.push(["Lignes vides au milieu du masque", plan.trous, ok(!plan.trous), plan.trous ? "reparer()" : ""]);
  L.push(["N° de fiche en double", numDoublons, ok(!numDoublons), numDoublons ? "reparer()" : ""]);
  L.push(["Dates du masque avec une heure parasite", dateAvecHeure, ok(!dateAvecHeure), dateAvecHeure ? "Cause des colonnes J1/J2/J3 à 0 : reparer()" : ""]);
  L.push(["Déclencheurs « à la soumission » (1 par formulaire : " + nForm + ")", nSub, ok(nSub === nForm), nSub === nForm ? "" : "reparer()"]);
  L.push(["Déclencheur « filet de sécurité » (10 min)", nFilet, ok(nFilet === 1), nFilet === 1 ? "" : "reparer()"]);
  L.push(["Classeur de destination du formulaire = ce classeur", dest ? (dest === ss.getId() ? "Oui" : "NON") : "(aucune destination)", ok(!dest || dest === ss.getId()),
    dest && dest !== ss.getId() ? "Le formulaire écrit ses réponses brutes dans un autre classeur : vous regardez peut-être le mauvais fichier" : ""]);
  L.push(["Fuseau du classeur", ss.getSpreadsheetTimeZone(), ok(ss.getSpreadsheetTimeZone() === CONFIG.FUSEAU), ""]);
  L.push(["Fuseau du projet de script", Session.getScriptTimeZone(), "", "Sans incidence depuis la V5"]);
  L.push(["Dates J1 à J" + NJ + " (onglet PARAMETRES)", jP.join(" · "), "", "Doivent correspondre aux jours ci-dessous"]);
  jours.forEach(function (j) {
    L.push(["Jour " + j + " — réponses formulaire / fiches masque (hors REJETE)", (parJourF[j] || 0) + " / " + (parJourM[j] || 0), "", jP.indexOf(j) < 0 ? "Jour absent de PARAMETRES : non compté dans les colonnes J1 à J" + NJ : ""]);
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
// 8. TABLEAUX DE SUIVI (100 % formules) — tous ventiles par jour J1 / J2 / J3
//    Les jours sont les dates saisies dans l'onglet PARAMETRES (DATE_J1, J2, J3).
// =====================================================================
function listeEnqueteurs_(ss) {
  const sh = ss.getSheetByName("ENQUETEURS");
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().filter(function (l) { return estIdEnq_(l[0]); })
    .map(function (l) { return { id: norm_(l[0]).toUpperCase(), nom: norm_(l[1]), zone: norm_(l[2]).toUpperCase() }; });
}

/** Quotas en vigueur : cases jaunes de SUIVI_CIBLES si l'onglet existe, sinon cahier des charges. */
function lireQuotas_(ss) {
  const q = {};
  Object.keys(QUOTAS).forEach(function (k) { q[k] = QUOTAS[k].slice(); });
  const sh = ss.getSheetByName("SUIVI_CIBLES");
  if (!sh || sh.getRange(3, 1).getValue() !== "CODE Q1") return q;
  sh.getRange(4, 1, Object.keys(QUOTAS).length, 9).getValues().forEach(function (l) {
    const c = Number(l[0]);
    if (!q[c]) return;
    [2, 5, 8].forEach(function (j, k) { const v = Number(l[j]); if (l[j] !== "" && isFinite(v) && v >= 0) q[c][1 + k] = v; });
  });
  return q;
}

function libelleJour_(k) { return '=IF(P_J' + k + '="","J' + k + ' (date à saisir)","J' + k + ' — "&TEXT(P_J' + k + ',"dd/mm"))'; }

function creerTableauDeBord_(ss) {
  const sh = ongletNeuf_(ss, "TABLEAU_DE_BORD");
  const E = refMasque_("CODEENQU"), D = refMasque_("DATEENQU"), S = refMasque_("STATUTQC"), A = refMasque_("ANOMALIE"), Z = refMasque_("CODEZONE"), Q1 = refMasque_("VOUSETES");
  const V = S + ",\"<>REJETE\"", Lc = lettreColonne_;
  const nEnq = Math.max(listeEnqueteurs_(ss).length, 1);
  const c0 = 4 + NJ;                                          // colonne AUJOURD'HUI (apres J1 … J4)
  const cAuj = Lc(c0), cCum = Lc(c0 + 1), cObj = Lc(c0 + 2), cDel = Lc(c0 + 4);
  sh.getRange("A1").setValue("SUIVI TERRAIN EN TEMPS RÉEL — EDM Électrique Cameroun").setFontSize(14).setFontWeight("bold");
  sh.getRange("A2").setValue("Fiches REJETE exclues. Dates J1 à J" + NJ + " et seuils : onglet PARAMETRES. Détail par jour : RECAP_JOURS et RAPPORT_J1 à J" + NJ + ".")
    .setFontStyle("italic").setFontColor("#666666");
  const ent = ["ENQ_ID", "NOM", "ZONE"].concat(JK.map(function (k) { return "J" + k; }))
    .concat(["AUJOURD'HUI", "CUMUL", "OBJECTIF", "% RÉALISÉ", "DÉLAIS COURTS", "À VÉRIFIER", "REJETÉES", "STATUT", "RANG (cumul)"]);
  if (sh.getMaxColumns() < ent.length) sh.insertColumnsAfter(sh.getMaxColumns(), ent.length - sh.getMaxColumns());
  sh.getRange(3, 4, 1, NJ).setFormulas([JK.map(libelleJour_)]).setFontStyle("italic").setFontColor("#666666").setHorizontalAlignment("center");
  sh.getRange(4, 1, 1, ent.length).setValues([ent]); styleEntete_(sh.getRange(4, 1, 1, ent.length));
  const fin = 4 + nEnq, f = [];
  const jr = function (k, r) { return "=IF(P_J" + k + "=\"\",\"\",COUNTIFS(" + E + ",$A" + r + "," + D + ",P_J" + k + "," + V + "))"; };
  for (let i = 0; i < nEnq; i++) {
    const r = 5 + i, re = 2 + i;
    f.push(["=ENQUETEURS!A" + re, "=ENQUETEURS!B" + re, "=ENQUETEURS!C" + re].concat(JK.map(function (k) { return jr(k, r); })).concat([
      "=COUNTIFS(" + E + ",$A" + r + "," + D + ",TODAY()," + V + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + V + ")",
      "=ENQUETEURS!D" + re,
      "=IF(N(" + cObj + r + ")=0,0," + cCum + r + "/" + cObj + r + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + A + ",\"*DELAI_COURT*\"," + V + ")",
      "=COUNTIFS(" + E + ",$A" + r + "," + S + ",\"A_VERIFIER\")",
      "=COUNTIFS(" + E + ",$A" + r + "," + S + ",\"REJETE\")",
      "=IF(C" + r + "=\"\",\"⚠ Zone à saisir\",IF(" + cAuj + r + ">P_SEUIL_VOLUME,\"⚠ Volume suspect\",IF(" + cCum + r + ">=" + cObj + r + ",\"✔ Objectif atteint\"," +
        "IF(" + cDel + r + ">0,\"⚠ Délais courts\",\"En cours\"))))",
      "=IF(" + cCum + r + "=0,\"\",RANK(" + cCum + r + ",$" + cCum + "$5:$" + cCum + "$" + fin + "))"]));
  }
  sh.getRange(5, 1, nEnq, ent.length).setFormulas(f);
  // Fiches dont l'identifiant n'est pas dans ENQUETEURS, puis total general
  const tj = function (k) { return "=IF(P_J" + k + "=\"\",\"\",COUNTIFS(" + E + ",\"<>\"," + D + ",P_J" + k + "," + V + "))"; };
  const hors = ent.map(function () { return ""; });
  hors[0] = "Hors liste"; hors[c0] = "=" + cCum + (fin + 2) + "-SUM(" + cCum + "5:" + cCum + fin + ")";
  const tot = ["TOTAL", "", ""].concat(JK.map(tj)).concat([
    "=COUNTIFS(" + E + ",\"<>\"," + D + ",TODAY()," + V + ")", "=COUNTIFS(" + E + ",\"<>\"," + V + ")",
    "=SUM(" + cObj + "5:" + cObj + fin + ")", "=IF(N(" + cObj + (fin + 2) + ")=0,0," + cCum + (fin + 2) + "/" + cObj + (fin + 2) + ")",
    "=COUNTIFS(" + A + ",\"*DELAI_COURT*\"," + V + ")", "=COUNTIFS(" + S + ",\"A_VERIFIER\")", "=COUNTIFS(" + S + ",\"REJETE\")", "", ""]);
  sh.getRange(fin + 1, 1, 2, ent.length).setValues([hors, tot]);
  sh.getRange(fin + 1, 1, 1, ent.length).setFontStyle("italic");
  sh.getRange(fin + 2, 1, 1, ent.length).setFontWeight("bold").setBackground("#D9E1F2");
  sh.getRange(5, c0 + 3, nEnq + 2, 1).setNumberFormat("0%");

  const z0 = fin + 5, Q = lireQuotas_(ss), nz = 6 + NJ;
  const zCum = Lc(3 + NJ), zObj = Lc(4 + NJ), zQuo = Lc(5 + NJ);
  sh.getRange(z0 - 1, 1).setValue("RÉCAPITULATIF PAR ZONE ET PAR JOUR").setFontWeight("bold");
  sh.getRange(z0, 1, 1, nz).setValues([["ZONE", "ENQUÊTEURS"].concat(JK.map(function (k) { return "J" + k; })).concat(["CUMUL", "OBJECTIF (capacité)", "QUOTA", "% DU QUOTA"])]);
  styleEntete_(sh.getRange(z0, 1, 1, nz));
  const zf = ZONES.map(function (z, i) {
    const r = z0 + 1 + i, q = Object.keys(Q).reduce(function (s, k) { return s + Q[k][1 + i]; }, 0);
    const zj = function (k) { return "=IF(P_J" + k + "=\"\",\"\",COUNTIFS(" + Z + "," + z.code + "," + D + ",P_J" + k + "," + V + "))"; };
    return [z.id, "=COUNTIF($C$5:$C$" + fin + ",A" + r + ")"].concat(JK.map(zj)).concat(["=COUNTIFS(" + Z + "," + z.code + "," + V + ")",
            "=SUMIF($C$5:$C$" + fin + ",A" + r + ",$" + cObj + "$5:$" + cObj + "$" + fin + ")", q, "=IF(" + zQuo + r + "=0,0," + zCum + r + "/" + zQuo + r + ")"]);
  });
  const rt = z0 + 1 + ZONES.length;
  const som = function (L) { return "=SUM(" + L + (z0 + 1) + ":" + L + (rt - 1) + ")"; };
  const ztot = ["TOTAL"];
  for (let c = 2; c < nz; c++) ztot.push(som(Lc(c)));
  ztot.push("=IF(" + zQuo + rt + "=0,0," + zCum + rt + "/" + zQuo + rt + ")");
  zf.push(ztot);
  sh.getRange(z0 + 1, 1, zf.length, nz).setValues(zf);
  sh.getRange(rt, 1, 1, nz).setFontWeight("bold");
  sh.getRange(z0 + 1, nz, zf.length, 1).setNumberFormat("0%");
  // Controle de coherence avec le tri a plat et le suivi des cibles
  sh.getRange(rt + 2, 1).setFormula("=\"CONTRÔLE — fiches comptées ci-dessus mais sans réponse à Q1 « Vous êtes » : \"&COUNTIFS(" + Q1 + ",99," + E + ",\"<>\"," + V +
    ")&\" (elles expliquent l'écart entre ce total et la somme des cibles ; à vérifier puis à passer en REJETE dans MASQUE_DEPOUILLEMENT)\"")
    .setFontWeight("bold").setFontColor("#990000");

  const plS = sh.getRange(5, c0 + 7, nEnq, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("⚠").setBackground("#F4CCCC").setRanges([plS]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("✔").setBackground("#D9EAD3").setRanges([plS]).build(),
    SpreadsheetApp.newConditionalFormatRule().setGradientMaxpoint("#6AA84F").setGradientMidpointWithValue("#FFD966",
      SpreadsheetApp.InterpolationType.NUMBER, "0.5").setGradientMinpoint("#E06666").setRanges([sh.getRange(5, c0 + 3, nEnq, 1)]).build()
  ]);
  // Fiches par enqueteur et par jour (barres empilees J1 + … + J4)
  sh.insertChart(sh.newChart().setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange(4, 1, nEnq + 1, 1)).addRange(sh.getRange(4, 4, nEnq + 1, NJ))
    .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_COLUMNS).setNumHeaders(1)
    .setOption("isStacked", true).setOption("colors", PALETTE.slice(0, NJ))
    .setOption("title", "Fiches valides par enquêteur et par jour").setOption("legend", { position: "top" })
    .setPosition(rt + 4, 1, 0, 0).build());
  sh.setFrozenRows(4); sh.setColumnWidth(2, 180); sh.setColumnWidth(c0 + 7, 170);
}

function creerTriAPlat_(ss) {
  const sh = ongletNeuf_(ss, "TRI_A_PLAT");
  const Z = refMasque_("CODEZONE"), S = refMasque_("STATUTQC"), E = refMasque_("CODEENQU"), D = refMasque_("DATEENQU"), Q1 = refMasque_("VOUSETES");
  const V = S + ",\"<>REJETE\"", W = 7 + 2 * NJ, Lc = lettreColonne_, NR = CONFIG.CODE_NR;
  if (sh.getMaxColumns() < W) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());
  const vide = function () { return new Array(W).fill(""); };
  const bj = function (k) { return "=IF(P_J" + k + "=\"\",\"\",COUNTIFS(" + E + ",\"<>\"," + D + ",P_J" + k + "," + V + "))"; };
  const lignes = [];
  let l = vide(); l[0] = "TRI À PLAT EN TEMPS RÉEL, PAR VILLE ET PAR JOUR (fiches REJETE exclues)"; lignes.push(l);
  l = vide(); l[0] = "Base : fiches valides"; l[1] = "=COUNTIFS(" + E + ",\"<>\"," + V + ")"; l[6] = "Base du jour →"; JK.forEach(function (k, i) { l[7 + i] = bj(k); }); lignes.push(l);
  l = vide(); l[0] = "=\"Contrôle : \"&COUNTIFS(" + Q1 + "," + NR + "," + E + ",\"<>\"," + V + ")&\" fiche(s) sans réponse à Q1. Ligne TOTAL = base ; ligne 99 = question laissée vide.\""; lignes.push(l);
  const titres = [], totaux = [];
  colonnesMasque_().filter(function (c) { return c.valeurs && c.code !== "CODEZONE"; }).forEach(function (c) {
    const X = refMasque_(c.code);
    titres.push(lignes.length + 1);
    l = vide(); l[0] = c.code + " — " + c.label; lignes.push(l);
    lignes.push(["Code", "Modalité"].concat(ZONES.map(function (z) { return z.libelle; })).concat(["Total", "% base"])
      .concat(JK.map(function (k) { return "J" + k; })).concat(JK.map(function (k) { return "% J" + k; })));
    const vals = c.groupe ? c.valeurs.filter(function (p) { return p[0] === 1; }) : c.valeurs;
    const r1 = lignes.length + 1;
    vals.forEach(function (p) {
      const r = lignes.length + 1;
      lignes.push([p[0], p[0] === NR ? "Non-réponse (question laissée vide)" : p[1]].concat(ZONES.map(function (z) { return "=COUNTIFS(" + X + "," + p[0] + "," + Z + "," + z.code + "," + V + ")"; }))
        .concat(["=COUNTIFS(" + X + "," + p[0] + "," + E + ",\"<>\"," + V + ")", "=IF($B$2=0,0,F" + r + "/$B$2)"])
        .concat(JK.map(function (k) { return "=IF(P_J" + k + "=\"\",\"\",COUNTIFS(" + X + "," + p[0] + "," + D + ",P_J" + k + "," + V + "))"; }))
        .concat(JK.map(function (k, i) { const L = Lc(8 + i); return "=IF(N(" + L + "$2)=0,\"\"," + L + r + "/" + L + "$2)"; })));
    });
    if (!c.groupe) {                                           // ligne TOTAL : doit etre egale a la base (controle de coherence)
      const r2 = lignes.length, r = r2 + 1;
      const som = function (L) { return "=SUM(" + L + r1 + ":" + L + r2 + ")"; };
      totaux.push(r);
      lignes.push(["", "TOTAL (= base)"].concat(ZONES.map(function (z, i) { return som(Lc(3 + i)); })).concat([som("F"), "=IF($B$2=0,0,F" + r + "/$B$2)"])
        .concat(JK.map(function (k, i) { return "=IF(P_J" + k + "=\"\",\"\"," + som(Lc(8 + i)).substr(1) + ")"; })).concat(JK.map(function () { return ""; })));
    }
    lignes.push(vide());
  });
  sh.getRange(1, 1, lignes.length, W).setValues(lignes);
  sh.getRange("A1").setFontSize(13).setFontWeight("bold");
  sh.getRange(2, 1, 1, 7 + NJ).setFontWeight("bold");
  sh.getRange(3, 1).setFontWeight("bold").setFontColor("#990000");
  sh.getRange(1, 7, lignes.length, 1).setNumberFormat("0.0%");
  sh.getRange(1, 8 + NJ, lignes.length, NJ).setNumberFormat("0.0%");
  sh.getRange(2, 7).setNumberFormat("@");
  const LW = Lc(W);
  sh.getRangeList(titres.map(function (r) { return "A" + r + ":" + LW + r; })).setFontWeight("bold").setBackground("#D9E1F2");
  sh.getRangeList(titres.map(function (r) { return "A" + (r + 1) + ":" + LW + (r + 1); })).setFontWeight("bold").setBackground("#1F4E78").setFontColor("#FFFFFF");
  sh.getRangeList(totaux.map(function (r) { return "A" + r + ":" + LW + r; })).setFontWeight("bold").setBackground("#F3F3F3");
  // La ligne 99 passe en orange des qu'elle n'est pas vide : question non renseignee sur des fiches valides
  sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=AND($A4=" + NR + ",N($F4)>0)")
    .setBackground("#FCE5CD").setRanges([sh.getRange(4, 1, lignes.length, W)]).build()]);
  sh.getRange(3, 8, 1, NJ).setFormulas([JK.map(libelleJour_)]).setFontStyle("italic").setFontColor("#666666");
  sh.setColumnWidth(1, 70); sh.setColumnWidth(2, 260); sh.setFrozenRows(3);
}

function creerSuiviCibles_(ss) {
  const Q = lireQuotas_(ss);                              // conserve les quotas modifies (cases jaunes)
  const sh = ongletNeuf_(ss, "SUIVI_CIBLES");
  const ENQ = refMasque_("CODEENQU"), CIB = refMasque_("VOUSETES"), ZON = refMasque_("CODEZONE"), STA = refMasque_("STATUTQC"), D = refMasque_("DATEENQU");
  const V = STA + ",\"<>REJETE\"", codes = Object.keys(Q).map(Number), nC = codes.length, NR = CONFIG.CODE_NR;
  if (sh.getMaxColumns() < 2 + 3 * NJ + NJ) sh.insertColumnsAfter(sh.getMaxColumns(), 2 + 3 * NJ + NJ - sh.getMaxColumns());
  sh.getRange("A1").setValue("QUOTAS PAR CIBLE (Q1) ET PAR VILLE — cahier des charges 02 (cases jaunes modifiables)").setFontSize(13).setFontWeight("bold");
  const h = ["CODE Q1", "CIBLE"];
  ZONES.forEach(function (z) { h.push(z.id + " quota", "réalisé", "%"); });
  h.push("TOTAL quota", "réalisé", "%");
  sh.getRange(3, 1, 1, h.length).setValues([h]); styleEntete_(sh.getRange(3, 1, 1, h.length));
  const rows = codes.map(function (c, i) {
    const r = 4 + i, row = [c, Q[c][0]];
    ZONES.forEach(function (z, k) {
      const Lq = lettreColonne_(3 + 3 * k), Lr = lettreColonne_(4 + 3 * k);
      row.push(Q[c][1 + k], "=COUNTIFS(" + CIB + "," + c + "," + ZON + "," + z.code + "," + V + ")", "=IF(" + Lq + r + "=0,0," + Lr + r + "/" + Lq + r + ")");
    });
    row.push("=C" + r + "+F" + r + "+I" + r, "=D" + r + "+G" + r + "+J" + r, "=IF(L" + r + "=0,0,M" + r + "/L" + r + ")");
    return row;
  });
  const rT = 4 + nC, tot = ["", "TOTAL DES CIBLES"];
  for (let k = 3; k <= h.length; k++) {
    const L = lettreColonne_(k);
    tot.push((k - 3) % 3 === 2 ? "=IF(" + lettreColonne_(k - 2) + rT + "=0,0," + lettreColonne_(k - 1) + rT + "/" + lettreColonne_(k - 2) + rT + ")" : "=SUM(" + L + "4:" + L + (rT - 1) + ")");
  }
  rows.push(tot);
  // Rapprochement avec le tableau de bord : fiches valides dont Q1 est restee vide (code 99)
  const sans = ["", "Q1 non renseignée (code " + NR + ")"], gen = ["", "TOTAL GÉNÉRAL (= tableau de bord)"];
  ZONES.forEach(function (z, k) {
    const Lr = lettreColonne_(4 + 3 * k);
    sans.push("", "=COUNTIFS(" + CIB + "," + NR + "," + ZON + "," + z.code + "," + V + ")", "");
    gen.push("", "=" + Lr + rT + "+" + Lr + (rT + 1), "");
  });
  sans.push("", "=COUNTIFS(" + CIB + "," + NR + "," + ENQ + ",\"<>\"," + V + ")", "");
  gen.push("", "=COUNTIFS(" + ENQ + ",\"<>\"," + V + ")", "");
  rows.push(sans, gen);
  sh.getRange(4, 1, rows.length, h.length).setValues(rows);
  [3, 6, 9].forEach(function (c) { sh.getRange(4, c, nC, 1).setBackground("#FFF2CC"); });
  [5, 8, 11, 14].forEach(function (c) { sh.getRange(4, c, nC + 1, 1).setNumberFormat("0%"); });
  sh.getRange(rT, 1, 1, h.length).setFontWeight("bold");
  sh.getRange(rT + 1, 1, 1, h.length).setFontColor("#990000");
  sh.getRange(rT + 2, 1, 1, h.length).setFontWeight("bold").setBackground("#D9E1F2");

  // Cibles par ville et par jour
  const rj = rT + 6;
  sh.getRange(rj - 1, 1).setValue("CIBLES PAR VILLE ET PAR JOUR (fiches valides)").setFontWeight("bold");
  const hj = ["CODE Q1", "CIBLE"];
  ZONES.forEach(function (z) { JK.forEach(function (k) { hj.push(z.id + " J" + k); }); });
  JK.forEach(function (k) { hj.push("TOTAL J" + k); });
  sh.getRange(rj, 1, 1, hj.length).setValues([hj]); styleEntete_(sh.getRange(rj, 1, 1, hj.length)); sh.getRange(rj, 1, 1, hj.length).setWrap(true);
  const rowsJ = codes.map(function (c, i) {
    const row = [c, Q[c][0]];
    ZONES.forEach(function (z) { JK.forEach(function (k) {
      row.push("=IF(P_J" + k + "=\"\",\"\",COUNTIFS(" + CIB + "," + c + "," + ZON + "," + z.code + "," + D + ",P_J" + k + "," + V + "))"); }); });
    JK.forEach(function (k) { row.push("=IF(P_J" + k + "=\"\",\"\",COUNTIFS(" + CIB + "," + c + "," + D + ",P_J" + k + "," + V + "))"); });
    return row;
  });
  const totJ = ["", "TOTAL"];
  for (let k = 3; k <= hj.length; k++) { const L = lettreColonne_(k); totJ.push("=SUM(" + L + (rj + 1) + ":" + L + (rj + nC) + ")"); }
  rowsJ.push(totJ);
  sh.getRange(rj + 1, 1, rowsJ.length, hj.length).setValues(rowsJ);
  sh.getRange(rj + nC + 1, 1, 1, hj.length).setFontWeight("bold");

  // Enqueteur x cible : cumul puis chaque jour
  let r0 = rj + nC + 5;
  const ids = listeEnqueteurs_(ss);
  [["CUMUL", 0]].concat(JK.map(function (k) { return ["JOUR " + k, k]; })).forEach(function (b) {
    sh.getRange(r0 - 1, 1).setValue("PRODUCTION PAR ENQUÊTEUR ET PAR CIBLE — " + b[0]).setFontWeight("bold");
    const he = ["ENQ", "ZONE"].concat(codes.map(function (c) { return Q[c][0]; })).concat(["TOTAL"]);
    sh.getRange(r0, 1, 1, he.length).setValues([he]); styleEntete_(sh.getRange(r0, 1, 1, he.length)); sh.getRange(r0, 1, 1, he.length).setWrap(true);
    const re = ids.map(function (_, i) {
      const r = r0 + 1 + i, row = ["=ENQUETEURS!A" + (2 + i), "=ENQUETEURS!C" + (2 + i)];
      codes.forEach(function (c) {
        row.push(b[1] ? "=IF(P_J" + b[1] + "=\"\",\"\",COUNTIFS(" + ENQ + ",$A" + r + "," + CIB + "," + c + "," + D + ",P_J" + b[1] + "," + V + "))"
                      : "=COUNTIFS(" + ENQ + ",$A" + r + "," + CIB + "," + c + "," + V + ")");
      });
      row.push("=SUM(C" + r + ":" + lettreColonne_(2 + nC) + r + ")");
      return row;
    });
    if (re.length) sh.getRange(r0 + 1, 1, re.length, he.length).setValues(re);
    r0 += ids.length + 4;
  });
  const plq = [5, 8, 11].map(function (c) { return sh.getRange(4, c, nC, 1); });
  sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().setGradientMaxpoint("#6AA84F")
    .setGradientMidpointWithValue("#FFD966", SpreadsheetApp.InterpolationType.NUMBER, "0.5").setGradientMinpoint("#E06666").setRanges(plq).build()]);
  sh.setColumnWidth(2, 220); sh.setFrozenRows(3);
}

/** RECAP_JOURS : les statistiques de chaque jour cote a cote (J1 | J2 | J3 | cumul), en direct. */
function creerRecapJours_(ss) {
  const sh = ongletNeuf_(ss, "RECAP_JOURS");
  const E = refMasque_("CODEENQU"), D = refMasque_("DATEENQU"), S = refMasque_("STATUTQC"), A = refMasque_("ANOMALIE"),
        Z = refMasque_("CODEZONE"), DL = refMasque_("DELAIPRE"), Q1 = refMasque_("VOUSETES");
  const V = S + ",\"<>REJETE\"", cols = colonnesMasque_(), nCol = 2 + NJ, Lc = lettreColonne_, LC = Lc(nCol);
  const lettres = []; for (let c = 2; c <= nCol; c++) lettres.push(Lc(c));          // colonnes J1 … J4 puis CUMUL
  const L = [], sections = [], pcts = [], dec = [];
  const pousser = function (a) { const x = a.slice(); while (x.length < nCol) x.push(""); L.push(x); return L.length; };
  const jour = function (k, crit) { return "=IF(P_J" + k + "=\"\",\"\",COUNTIFS(" + D + ",P_J" + k + "," + crit + "))"; };
  const tous = function (crit) { return JK.map(function (k) { return jour(k, crit); }).concat(["=COUNTIFS(" + crit + ")"]); };
  const section = function (t) { sections.push(pousser([t])); };
  pousser(["RÉCAPITULATIF PAR JOUR — statistiques de J1 à J" + NJ + " et cumul (temps réel)"]);
  pousser(["Fiches REJETE exclues sauf mention. Dates : onglet PARAMETRES. Rapport rédigé de chaque jour : onglets RAPPORT_J1 à RAPPORT_J" + NJ + "."]);
  pousser(["INDICATEUR"].concat(JK.map(libelleJour_)).concat(["CUMUL"]));
  section("1. PRODUCTION");
  const rV = pousser(["Fiches valides"].concat(tous(E + ",\"<>\"," + V)));
  pousser(["Objectif (enquêteurs × objectif/jour)"].concat(JK.map(function (k) { return "=IF(P_J" + k + "=\"\",\"\",COUNTA(ENQUETEURS!$A$2:$A)*P_OBJ_JOUR)"; }))
    .concat(["=COUNTA(ENQUETEURS!$A$2:$A)*P_OBJ_JOUR*P_NB_JOURS"]));
  pcts.push(pousser(["% de l'objectif"].concat(lettres.map(function (c) { return "=IF(N(" + c + (rV + 1) + ")=0,\"\"," + c + rV + "/" + c + (rV + 1) + ")"; }))));
  const rA = pousser(["Enquêteurs ayant produit"].concat(JK.map(function (k) { return "=IF(P_J" + k + "=\"\",\"\",COUNTUNIQUEIFS(" + E + "," + D + ",P_J" + k + "," + V + "))"; }))
    .concat(["=COUNTUNIQUEIFS(" + E + "," + V + ")"]));
  dec.push(pousser(["Fiches par enquêteur actif"].concat(lettres.map(function (c) { return "=IF(N(" + c + rA + ")=0,\"\"," + c + rV + "/" + c + rA + ")"; }))));
  section("2. QUALITÉ");
  const rQ = pousser(["Fiches à vérifier"].concat(tous(S + ",\"A_VERIFIER\"")));
  pcts.push(pousser(["% à vérifier"].concat(lettres.map(function (c) { return "=IF(N(" + c + rV + ")=0,\"\"," + c + rQ + "/" + c + rV + ")"; }))));
  pousser(["Fiches rejetées par le superviseur"].concat(tous(S + ",\"REJETE\"")));
  pousser(["Fiches sans réponse à Q1 « Vous êtes » (code 99)"].concat(tous(Q1 + "," + CONFIG.CODE_NR + "," + E + ",\"<>\"," + V)));
  pousser(["Fiches vides (aucune question renseignée)"].concat(tous(A + ",\"*FICHE_VIDE*\"," + V)));
  pousser(["Fiches avec délai court"].concat(tous(A + ",\"*DELAI_COURT*\"," + V)));
  pousser(["Fiches avec incohérence de réponses"].concat(tous(A + ",\"*INCOHERENCE*\"," + V)));
  pousser(["Téléphones en double"].concat(tous(A + ",\"*TEL_DOUBLON*\"," + V)));
  dec.push(pousser(["Minutes moyennes entre deux fiches"].concat(JK.map(function (k) { return "=IF(P_J" + k + "=\"\",\"\",IFERROR(AVERAGEIFS(" + DL + "," + D + ",P_J" + k + "," + V + "),\"\"))"; }))
    .concat(["=IFERROR(AVERAGEIFS(" + DL + "," + V + "),\"\")"])));
  section("3. PAR VILLE (fiches valides)");
  const rVille = L.length + 1;
  ZONES.forEach(function (z) { pousser([z.libelle].concat(tous(Z + "," + z.code + "," + V))); });
  const part = function (X, code) {
    return JK.map(function (k) { return "=IF(N(" + Lc(1 + k) + "$" + rV + ")=0,\"\",COUNTIFS(" + X + "," + code + "," + D + ",P_J" + k + "," + V + ")/" + Lc(1 + k) + "$" + rV + ")"; })
      .concat(["=IF(N($" + LC + "$" + rV + ")=0,\"\",COUNTIFS(" + X + "," + code + "," + V + ")/$" + LC + "$" + rV + ")"]);
  };
  let n = 4;
  ["VOUSETES"].concat(RAPPORT_VARS).forEach(function (code) {
    const c = cols.filter(function (x) { return x.code === code; })[0];
    section(n++ + ". " + c.label + " (% des fiches du jour)");
    c.valeurs.filter(function (p) { return p[0] < 97 || code === "VOUSETES"; }).forEach(function (p) {
      pcts.push(pousser([p[0] === CONFIG.CODE_NR ? "Non-réponse (question laissée vide)" : p[1]].concat(part(refMasque_(code), p[0])))); });
  });
  if (sh.getMaxColumns() < nCol) sh.insertColumnsAfter(sh.getMaxColumns(), nCol - sh.getMaxColumns());
  sh.getRange(1, 1, L.length, nCol).setValues(L);
  sh.getRange("A1").setFontSize(14).setFontWeight("bold");
  sh.getRange("A2").setFontStyle("italic").setFontColor("#666666");
  styleEntete_(sh.getRange(3, 1, 1, nCol));
  sh.getRangeList(sections.map(function (r) { return "A" + r + ":" + LC + r; })).setFontWeight("bold").setBackground("#D9E1F2");
  sh.getRangeList(pcts.map(function (r) { return "B" + r + ":" + LC + r; })).setNumberFormat("0%");
  sh.getRangeList(dec.map(function (r) { return "B" + r + ":" + LC + r; })).setNumberFormat("0.0");
  sh.getRange(rV, 1, 1, nCol).setFontWeight("bold");
  sh.setColumnWidth(1, 430); for (let c = 2; c <= nCol; c++) sh.setColumnWidth(c, 120);
  sh.setFrozenRows(3); sh.setFrozenColumns(1);
  sh.insertChart(sh.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(3, 1, 1, 1 + NJ)).addRange(sh.getRange(rVille, 1, ZONES.length, 1 + NJ))
    .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_ROWS).setTransposeRowsAndColumns(true).setNumHeaders(1)
    .setOption("isStacked", true).setOption("colors", PALETTE.slice(0, 3)).setOption("title", "Fiches valides par jour et par ville")
    .setOption("legend", { position: "top" }).setOption("width", 520).setOption("height", 300).setPosition(4, nCol + 2, 0, 0).build());
}

// =====================================================================
// 8 bis. RAPPORT JOURNALIER (onglets RAPPORT_J1, RAPPORT_J2, RAPPORT_J3)
//    Photographie redigee d'un jour de terrain : synthese, recommandations pour
//    le lendemain, classement des enqueteurs, cibles, tendances compares aux
//    jours precedents, camemberts. Genere par rapportJournalier() : a la demande,
//    et automatiquement chaque soir a 19 h (heure de Douala).
// =====================================================================
const RAPPORT_VARS = ["MAACPLSO", "GAACPLSO", "ORIGPRIV", "PRCRICHO", "PRINFREI", "LIEACHPR", "CANAPREF", "PRETACLI"];
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const SEUIL_BASE_TENDANCE = 30;       // en dessous, un % du jour n'est pas commente
const SEUIL_ECART_POINTS = 10;        // ecart jour / jours precedents signale
const SEUIL_NR_QUESTION = 0.15;       // question sautee par plus de 15 % des fiches du jour

const SEUIL_JOUR_TERRAIN = 5;         // un jour compte comme jour de terrain a partir de 5 fiches valides
const DEBUT_JOURNEE = 8, FIN_JOURNEE = 18;   // heures de terrain : sert au prorata d'un rapport lance en cours de journee

/** « yyyy-MM-dd » d'une cellule de date (Date, ou texte jj/mm/aaaa) ; null sinon. */
function jourDe_(v) {
  if (v instanceof Date) return fmtDouala_(v, "yyyy-MM-dd");
  const m = norm_(v).match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null;
  return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
}
function lendemain_(j) {
  const p = j.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + 86400000);
  return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
}
function estDimanche_(j) { const p = j.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() === 0; }

/**
 * FONCTION PURE : decide des dates J1 a J3.
 * @param {Array<string|null>} declares  jours lus dans PARAMETRES (« yyyy-MM-dd » ou null)
 * @param {Object} compte                {« yyyy-MM-dd » : nb de fiches valides}
 * @return {string[]|null} les 3 jours a ecrire, ou null s'il ne faut rien changer
 */
function planJours_(declares, compte) {
  let obs = Object.keys(compte).filter(function (j) { return compte[j] >= SEUIL_JOUR_TERRAIN; }).sort();
  if (!obs.length) obs = Object.keys(compte).sort();
  if (!obs.length) return null;                                               // aucune fiche : rien a caler
  if (declares.some(function (d) { return d && compte[d]; })) return null;    // au moins une date saisie est un jour de collecte : on respecte la saisie
  const jours = obs.slice(0, 3);
  while (jours.length < 3) { let j = lendemain_(jours[jours.length - 1]); if (estDimanche_(j)) j = lendemain_(j); jours.push(j); }
  return jours;
}

/** Cale DATE_J1 a J3 sur les jours reels de collecte si les dates saisies ne correspondent a aucun jour de terrain. */
function calerJours_(ss, base) {
  const cells = [1, 2, 3].map(function (k) { try { return ss.getRangeByName("P_J" + k); } catch (e) { return null; } });
  if (cells.some(function (c) { return !c; })) return "Plages P_J1 à P_J3 introuvables : onglet PARAMETRES à recréer (fonction installer).";
  const lus = cells.map(function (c) { return c.getValue(); }), declares = lus.map(jourDe_), compte = {};
  base.forEach(function (o) { if (!o._rej && /^\d{4}-\d{2}-\d{2}$/.test(o._jour)) compte[o._jour] = (compte[o._jour] || 0) + 1; });
  const ecrire = function (c, j) { c.setValue(Utilities.parseDate(j + " 00:00:00", CONFIG.FUSEAU, "yyyy-MM-dd HH:mm:ss")).setNumberFormat("dd/MM/yyyy"); };
  const fr = function (j) { if (!j) return "(vide)"; const p = j.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
  const plan = planJours_(declares, compte);
  if (!plan) {
    let n = 0;                                                                 // dates justes mais saisies comme du texte : converties en vraies dates
    cells.forEach(function (c, i) { if (declares[i] && !(lus[i] instanceof Date)) { ecrire(c, declares[i]); n++; } });
    if (n) { SpreadsheetApp.flush(); journal_(ss, "JOURS", n + " date(s) de PARAMETRES saisie(s) comme du texte, convertie(s) en vraies dates."); }
    return n ? n + " date(s) texte convertie(s)" : "";
  }
  cells.forEach(function (c, i) { ecrire(c, plan[i]); });
  SpreadsheetApp.flush();
  const msg = "Dates de terrain recalées sur les jours de collecte : J1 = " + fr(plan[0]) + ", J2 = " + fr(plan[1]) + ", J3 = " + fr(plan[2]) +
    " (PARAMETRES contenait : " + declares.map(fr).join(", ") + ", sans aucune fiche ces jours-là).";
  journal_(ss, "JOURS", msg);
  return msg;
}

/** A lancer a la main si besoin : recale DATE_J1 a J3 puis regenere les rapports. */
function calerJours() {
  const ss = classeur_();
  const msg = calerJours_(ss, lireBase_(ss));
  Logger.log(msg || "Dates J1 à J3 déjà cohérentes avec les jours de collecte : rien à changer.");
  rapportJournalier();
}

/** Une variable par question (sert au taux de non-reponse). */
function varsQuestions_() {
  const out = [];
  ITEMS.forEach(function (it) {
    if (it.type === "radio") out.push([it.code, it.q]);
    else if (it.type === "multi") out.push([it.sousItems[0][0], it.q]);
    else if (it.type === "grille") it.lignes.forEach(function (l) { out.push([l[0], it.q.split(".")[0] + ". Fourchette de prix — " + l[1]]); });
  });
  return out;
}

/** Base codee lue dans le masque : une fiche = un objet {CODE: valeur, _jour, _heure, _rej}. */
function lireBase_(ss) {
  const sh = masque_(ss), codes = colonnesMasque_().map(function (c) { return c.code; });
  const p0 = CONFIG.PREMIERE_LIGNE_DONNEES, n = sh.getLastRow() - p0 + 1;
  if (n <= 0) return [];
  const iD = codes.indexOf("DATEENQU"), iH = codes.indexOf("HEUREENQ");
  return sh.getRange(p0, 1, n, codes.length).getValues().filter(function (l) { return norm_(l[0]); }).map(function (l) {
    const o = {};
    codes.forEach(function (c, i) { o[c] = l[i]; });
    const d = l[iD], h = l[iH];
    o._jour = d instanceof Date ? fmtDouala_(d, "yyyy-MM-dd") : String(d).substr(0, 10);
    o._heure = h instanceof Date ? h.getHours() : (/^\d{1,2}:/.test(String(h)) ? Number(String(h).split(":")[0]) : null);
    o._rej = o.STATUTQC === "REJETE";
    return o;
  });
}

/**
 * FONCTION PURE : calcule tout le contenu du rapport d'un jour.
 * p = { jour:"yyyy-MM-dd", jours:[jours de terrain declares], nbJours, enqueteurs:[{id,nom,zone}],
 *       objectifJour, seuilDelai, seuilVolume, quotas:{code:[cible, DLA, YDE, BAF]} }
 */
function calculerRapport_(base, p) {
  const NR = CONFIG.CODE_NR, jour = p.jour, obj = p.objectifJour;
  // Journee en cours : la production est jugee au prorata du temps de terrain ecoule
  const partiel = !!(p.maintenant && p.maintenant.jour === jour && p.maintenant.heure < FIN_JOURNEE);
  const part = partiel ? Math.min(1, Math.max(0.1, (p.maintenant.heure - DEBUT_JOURNEE) / (FIN_JOURNEE - DEBUT_JOURNEE))) : 1;
  const objScore = obj * part;
  const arr = function (x) { return Math.round(x); };
  const pc = function (x) { return x === null ? "—" : Math.round(100 * x) + " %"; };
  const valides = base.filter(function (o) { return !o._rej; });
  const J = valides.filter(function (o) { return o._jour === jour; });
  const AV = valides.filter(function (o) { return o._jour < jour; });
  const CU = valides.filter(function (o) { return o._jour <= jour; });
  const rejJ = base.filter(function (o) { return o._rej && o._jour === jour; });
  const obs = [];
  CU.forEach(function (o) { if (obs.indexOf(o._jour) < 0) obs.push(o._jour); });
  const declare = p.jours.indexOf(jour) >= 0;
  const rang = declare ? p.jours.indexOf(jour) + 1 : obs.length;
  const restants = declare ? p.jours.filter(function (d) { return d > jour; }).length : Math.max(0, p.nbJours - obs.length);

  const qv = varsQuestions_();
  const txNR = function (o) { return qv.filter(function (q) { return o[q[0]] === NR; }).length / qv.length; };
  const anomalies = function (o) { return String(o.ANOMALIE || "").split(" | ").filter(function (x) { return x && x !== "ZONE_ENQ_NON_PARAMETREE"; }); };
  const a = function (o, mot) { return String(o.ANOMALIE || "").indexOf(mot) >= 0; };
  const moy = function (t) { return t.length ? t.reduce(function (s, x) { return s + x; }, 0) / t.length : null; };

  // ---------- Classement des enqueteurs ----------
  const liste = p.enqueteurs.slice(), connus = {};
  liste.forEach(function (e) { connus[e.id] = true; });
  J.concat(rejJ).forEach(function (o) { const id = String(o.CODEENQU || ""); if (id && !connus[id]) { connus[id] = true; liste.push({ id: id, nom: "(hors liste)", zone: "" }); } });
  const classement = liste.map(function (e) {
    const f = J.filter(function (o) { return o.CODEENQU === e.id; });
    const rj = rejJ.filter(function (o) { return o.CODEENQU === e.id; }).length;
    const n = f.length, tot = n + rj;
    const pb = f.filter(function (o) { return o.STATUTQC === "A_VERIFIER" && anomalies(o).length; }).length;
    const dc = f.filter(function (o) { return a(o, "DELAI_COURT"); }).length;
    const nr = moy(f.map(txNR));
    const prod = objScore > 0 ? Math.min(1, n / objScore) : 0;
    const score = tot ? arr(50 * prod + 30 * (1 - (pb + rj) / tot) + 20 * (1 - Math.min(1, (nr || 0) / 0.20))) : 0;
    let avis = score >= 80 ? "Très bon" : score >= 65 ? "Bon" : score >= 50 ? "À suivre" : "Insuffisant";
    if (!tot) avis = "Aucune fiche";
    else if (n > p.seuilVolume) avis = "À contrôler (volume suspect)";
    return { id: e.id, nom: e.nom, zone: e.zone, n: n, pObj: obj > 0 ? n / obj : null, cumul: CU.filter(function (o) { return o.CODEENQU === e.id; }).length,
             pb: pb, rej: rj, dc: dc, nr: nr, tel: f.filter(function (o) { return a(o, "TEL_DOUBLON"); }).length, score: score, avis: avis };
  }).sort(function (x, y) { return y.score - x.score || y.n - x.n || (x.id < y.id ? -1 : 1); });
  classement.forEach(function (c, i) { c.rang = i + 1; });

  // ---------- Villes ----------
  const villes = ZONES.map(function (z, k) {
    const quota = Object.keys(p.quotas).reduce(function (s, c) { return s + p.quotas[c][1 + k]; }, 0);
    const nJ = J.filter(function (o) { return o.CODEZONE === z.code; }).length, cu = CU.filter(function (o) { return o.CODEZONE === z.code; }).length;
    const nEnq = p.enqueteurs.filter(function (e) { return e.zone === z.id; }).length, reste = Math.max(0, quota - cu);
    const requis = reste && restants && nEnq ? reste / nEnq / restants : null;
    const etat = !reste ? "Quota atteint" : !restants ? "Quota non atteint : " + reste + " fiches manquantes" : !nEnq ? "Aucun enquêteur affecté" :
      requis <= obj ? "Atteignable" : requis <= p.seuilVolume ? "Tendu" : "Hors d'atteinte au rythme autorisé";
    return { z: z, nJ: nJ, cumul: cu, quota: quota, reste: reste, nEnq: nEnq, requis: requis, etat: etat };
  });

  // ---------- Cibles (Q1) ----------
  const codesC = Object.keys(p.quotas).map(Number), cellules = [];
  const cibles = codesC.map(function (c) {
    const nJ = J.filter(function (o) { return o.VOUSETES === c; }).length, cu = CU.filter(function (o) { return o.VOUSETES === c; }).length;
    const quota = p.quotas[c][1] + p.quotas[c][2] + p.quotas[c][3];
    ZONES.forEach(function (z, k) {
      const q = p.quotas[c][1 + k], r = CU.filter(function (o) { return o.VOUSETES === c && o.CODEZONE === z.code; }).length;
      cellules.push({ cible: p.quotas[c][0], ville: z.libelle, quota: q, fait: r, reste: Math.max(0, q - r), taux: q ? r / q : null });
    });
    return { lib: p.quotas[c][0], nJ: nJ, pJ: J.length ? nJ / J.length : null, cumul: cu, quota: quota, pQ: quota ? cu / quota : null, reste: Math.max(0, quota - cu) };
  });

  const sansQ1J = J.filter(function (o) { return o.VOUSETES === NR; }), sansQ1 = CU.filter(function (o) { return o.VOUSETES === NR; }).length;
  if (sansQ1) cibles.push({ lib: "Q1 non renseignée (code " + NR + ")", nJ: sansQ1J.length, pJ: J.length ? sansQ1J.length / J.length : null, cumul: sansQ1, quota: "", pQ: null, reste: "" });

  // ---------- Tendances : jour compare aux jours precedents ----------
  const cols = colonnesMasque_(), signaux = [];
  const tendances = RAPPORT_VARS.map(function (code) {
    const c = cols.filter(function (x) { return x.code === code; })[0];
    const mods = c.valeurs.filter(function (m) { return m[0] < 97; });
    const bJ = J.filter(function (o) { return typeof o[code] === "number" && o[code] < 97; }), bA = AV.filter(function (o) { return typeof o[code] === "number" && o[code] < 97; });
    const fiable = bJ.length >= SEUIL_BASE_TENDANCE && bA.length >= SEUIL_BASE_TENDANCE;
    const rows = mods.map(function (m) {
      const nJ = bJ.filter(function (o) { return o[code] === m[0]; }).length, nA = bA.filter(function (o) { return o[code] === m[0]; }).length;
      const pJ = bJ.length ? nJ / bJ.length : null, pA = bA.length ? nA / bA.length : null;
      const ec = pJ !== null && pA !== null ? 100 * (pJ - pA) : null;
      let sig = "";
      if (fiable && Math.abs(ec) >= SEUIL_ECART_POINTS) {
        sig = (ec > 0 ? "▲ +" : "▼ ") + arr(ec) + " pts";
        signaux.push(c.label.split(".")[0] + " « " + m[1] + " » : " + pc(pJ) + " aujourd'hui contre " + pc(pA) + " les jours précédents (" + (ec > 0 ? "+" : "") + arr(ec) + " points)");
      }
      return { lib: m[1], nJ: nJ, pJ: pJ, pA: pA, ec: ec, sig: sig };
    });
    const tete = rows.slice().sort(function (x, y) { return y.nJ - x.nJ; })[0];
    return { code: code, label: c.label, baseJ: bJ.length, baseA: bA.length, fiable: fiable, rows: rows, tete: tete && tete.nJ ? tete : null };
  });

  // ---------- Non-reponse par question, rythme horaire ----------
  const nonRep = qv.map(function (q) { return { q: q[1], n: J.filter(function (o) { return o[q[0]] === NR; }).length }; })
    .map(function (x) { x.tx = J.length ? x.n / J.length : null; return x; })
    .filter(function (x) { return x.n > 0; }).sort(function (x, y) { return y.n - x.n; }).slice(0, 10);
  const heures = [];
  const hs = J.map(function (o) { return o._heure; }).filter(function (h) { return h !== null && h !== undefined; });
  if (hs.length) for (let h = Math.min.apply(null, hs); h <= Math.max.apply(null, hs); h++) heures.push([h + " h", hs.filter(function (x) { return x === h; }).length]);

  // ---------- Synthese ----------
  const aVerif = J.filter(function (o) { return o.STATUTQC === "A_VERIFIER"; }).length;
  const actifs = classement.filter(function (c) { return c.n > 0; }).length;
  const objJour = p.enqueteurs.length * obj, quotaTot = villes.reduce(function (s, v) { return s + v.quota; }, 0);
  const cuTot = CU.length, nrJour = moy(J.map(txNR));
  const delais = J.map(function (o) { return o.DELAIPRE; }).filter(function (x) { return typeof x === "number"; }).sort(function (x, y) { return x - y; });
  const synthese = [
    ["Fiches valides du jour", J.length, objJour ? "objectif " + objJour + " (" + p.enqueteurs.length + " enquêteurs × " + obj + ") : " + pc(J.length / objJour) : ""],
    ["Cumul depuis le début du terrain", cuTot, quotaTot ? "quota total " + quotaTot + " : " + pc(cuTot / quotaTot) + " ; reste " + Math.max(0, quotaTot - cuTot) : ""],
    ["Enquêteurs ayant produit", actifs, "sur " + p.enqueteurs.length + " inscrits" + (actifs ? " ; " + (J.length / actifs).toFixed(1) + " fiches par enquêteur actif" : "")],
    ["Fiches à vérifier", aVerif, J.length ? pc(aVerif / J.length) + " des fiches du jour" : ""],
    ["Fiches rejetées par le superviseur", rejJ.length, ""],
    ["Taux moyen de questions sans réponse", nrJour === null ? "—" : pc(nrJour), "part des " + qv.length + " questions codées laissées vides (code 99)"],
    ["Minutes médianes entre deux fiches", delais.length ? delais[Math.floor(delais.length / 2)] : "—", "seuil d'alerte : " + p.seuilDelai + " min"],
    ["Jours de terrain restants", restants, declare ? "d'après les dates de l'onglet PARAMETRES" : "estimation : ce jour n'est pas déclaré dans PARAMETRES"]
  ];
  if (partiel) {
    const hh = Math.floor(p.maintenant.heure), mi = Math.round((p.maintenant.heure - hh) * 60);
    synthese.unshift(["RAPPORT PROVISOIRE", "à " + hh + " h " + ("0" + mi).slice(-2), "journée en cours : le classement juge la production sur " + pc(part) +
      " de l'objectif du jour (" + (Math.round(objScore * 10) / 10) + " fiches par enquêteur à cette heure). Rapport définitif à 19 h."]);
  }

  // ---------- Recommandations pour le jour suivant ----------
  const R = [], noms = function (t) { return t.map(function (c) { return c.id + (c.nom && c.nom !== "(hors liste)" ? " (" + c.nom + ")" : ""); }).join(", "); };
  if (!J.length) R.push(["Production", "Aucune fiche valide ce jour : vérifier que les enquêteurs utilisent bien leur lien personnel et que le formulaire accepte les réponses."]);
  if (!declare) R.push(["Paramétrage", "Ce jour n'est pas déclaré dans l'onglet PARAMETRES (DATE_J1 à J4) : les colonnes par jour des autres tableaux l'ignorent. Saisir les dates réelles du terrain."]);
  villes.forEach(function (v) {
    if (!v.reste) R.push(["Production", v.z.libelle + " : quota atteint (" + v.cumul + "/" + v.quota + "). Arrêter la collecte ou réaffecter les enquêteurs vers une ville en retard."]);
    else if (!restants) R.push(["Production", v.z.libelle + " : il manque " + v.reste + " fiches (" + v.cumul + "/" + v.quota + ") et aucun jour de terrain ne reste. Prévoir une journée de rattrapage : environ " +
      Math.ceil(v.reste / Math.max(1, v.nEnq * obj)) + " jour(s) avec " + v.nEnq + " enquêteur(s)."]);
    else if (v.requis !== null) R.push(["Production", v.z.libelle + " : reste " + v.reste + " fiches, soit " + v.requis.toFixed(1) + " par enquêteur et par jour sur " + restants + " jour(s) (" + v.etat.toLowerCase() + ")." +
      (v.requis > obj ? " Renforcer l'équipe ou ajouter un jour : au-delà de " + obj + " fiches/jour, la qualité des entretiens baisse." : "")]);
    else R.push(["Production", v.z.libelle + " : " + v.etat.toLowerCase() + " (reste " + v.reste + " fiches)."]);
  });
  const retard = cellules.filter(function (c) { return c.reste > 0 && c.quota; }).sort(function (x, y) { return x.taux - y.taux || y.reste - x.reste; }).slice(0, 5);
  if (retard.length) R.push(["Cibles", "À rechercher en priorité demain : " + retard.map(function (c) { return c.cible + " à " + c.ville + " (" + c.fait + "/" + c.quota + ")"; }).join(" ; ") + "."]);
  const pleines = cellules.filter(function (c) { return c.quota && c.fait >= c.quota; });
  if (pleines.length) R.push(["Cibles", "Quota atteint, ne plus interroger : " + pleines.map(function (c) { return c.cible + " à " + c.ville + " (" + c.fait + "/" + c.quota + ")"; }).join(" ; ") + "."]);
  const grp = function (av) { return classement.filter(function (c) { return c.avis === av; }); };
  if (grp("Très bon").length) R.push(["Enquêteurs", "Très bon travail : " + noms(grp("Très bon")) + ". À citer en exemple au briefing ; leur confier les cibles difficiles."]);
  if (grp("À suivre").length) R.push(["Enquêteurs", "À suivre de près : " + noms(grp("À suivre")) + ". Faire le point avec chacun avant le départ sur le terrain."]);
  if (grp("Insuffisant").length) R.push(["Enquêteurs", "Travail insuffisant : " + noms(grp("Insuffisant")) + ". Entretien individuel, puis accompagnement en binôme sur les premières fiches."]);
  if (grp("Aucune fiche").length) R.push(["Enquêteurs", "Aucune fiche ce jour : " + noms(grp("Aucune fiche")) + ". Vérifier la présence, le lien utilisé et la connexion."]);
  if (grp("À contrôler (volume suspect)").length) R.push(["Enquêteurs", "Volume anormalement élevé (plus de " + p.seuilVolume + " fiches) : " + noms(grp("À contrôler (volume suspect)")) + ". Rappeler 5 enquêtés par téléphone avant de valider leurs fiches."]);
  classement.filter(function (c) { return c.dc >= 3 || (c.n >= 5 && c.dc / c.n >= 0.2); }).forEach(function (c) {
    R.push(["Contrôle", c.id + " : " + c.dc + " fiche(s) à moins de " + p.seuilDelai + " minutes de la précédente. Rappeler au moins 3 de ces enquêtés par téléphone pour confirmer l'entretien."]); });
  classement.filter(function (c) { return c.n >= 5 && c.nr !== null && c.nr >= SEUIL_NR_QUESTION; }).forEach(function (c) {
    R.push(["Qualité", c.id + " laisse " + pc(c.nr) + " des questions sans réponse. Lui rappeler de poser toutes les questions jusqu'à Q41."]); });
  const sautees = nonRep.filter(function (x) { return x.tx >= SEUIL_NR_QUESTION; }).slice(0, 5);
  if (sautees.length) R.push(["Qualité", "Questions les plus sautées : " + sautees.map(function (x) { return x.q.split(".")[0] + " (" + pc(x.tx) + ")"; }).join(", ") + ". Les reformuler au briefing ; envisager de les rendre obligatoires dans le formulaire."]);
  if (sansQ1J.length) R.push(["Contrôle", sansQ1J.length + " fiche(s) du jour sans réponse à Q1 « Vous êtes » (" + sansQ1J.map(function (o) { return o.NUMFICHE; }).join(", ") +
    ") : inutilisables pour les quotas. Les passer en REJETE dans MASQUE_DEPOUILLEMENT, puis rappeler aux enquêteurs concernés de recharger le formulaire avant chaque fiche."]);
  if (aVerif) R.push(["Contrôle", aVerif + " fiche(s) à vérifier : le superviseur les traite ce soir dans MASQUE_DEPOUILLEMENT (colonne STATUTQC : OK ou REJETE)."]);
  const tel = J.filter(function (o) { return a(o, "TEL_DOUBLON"); }).length;
  if (tel) R.push(["Contrôle", tel + " fiche(s) avec un téléphone déjà enregistré : la même personne a peut-être été interrogée deux fois."]);
  const sansZone = classement.filter(function (c) { return !c.zone && c.nom !== "(hors liste)"; });
  if (sansZone.length) R.push(["Paramétrage", "Zone non saisie dans l'onglet ENQUETEURS pour " + noms(sansZone) + " : la saisir puis exécuter actualiser()."]);
  if (classement.some(function (c) { return c.nom === "(hors liste)"; })) R.push(["Paramétrage", "Des fiches portent un identifiant absent de l'onglet ENQUETEURS : " + noms(classement.filter(function (c) { return c.nom === "(hors liste)"; })) + "."]);
  signaux.slice(0, 6).forEach(function (s) { R.push(["Tendance", s + ". Vérifier s'il s'agit d'un effet de cible ou de quartier avant de conclure."]); });
  if (J.length && J.length < SEUIL_BASE_TENDANCE) R.push(["Lecture", "Moins de " + SEUIL_BASE_TENDANCE + " fiches ce jour : les pourcentages du jour sont indicatifs, ne pas en tirer de conclusion."]);

  return { partiel: partiel, part: part, jour: jour, rang: rang, declare: declare, restants: restants, nJ: J.length, synthese: synthese, recos: R, villes: villes, classement: classement,
           cibles: cibles, tendances: tendances, nonRep: nonRep, heures: heures, objectif: obj };
}

// ---------- Ecriture du rapport dans un onglet ----------
function Rap_() {
  this.L = []; this.ch = [];
  this.st = { titre: [], section: [], tete: [], pct: [], gras: [], note: [], vert: [], jaune: [], rouge: [], bleu: [] };
}
Rap_.prototype.ligne = function (a, style) { this.L.push(a); if (style) this.st[style].push([this.L.length, 1, 1, style === "section" ? 13 : Math.max(a.length, 1)]); return this.L.length; };
Rap_.prototype.marque = function (style, r, c, nr, nc) { this.st[style].push([r, c, nr || 1, nc || 1]); };
Rap_.prototype.table = function (entete, lignes, pcts) {
  const rh = this.ligne(entete, "tete"), self = this;
  lignes.forEach(function (l) { self.L.push(l); });
  if (lignes.length) (pcts || []).forEach(function (c) { self.st.pct.push([rh + 1, c, lignes.length, 1]); });
  return rh;
};
Rap_.prototype.jusqua = function (r) { while (this.L.length < r) this.L.push([""]); };
Rap_.prototype.vide = function () { this.L.push([""]); };

function ecrireRapport_(ss, nom, R, etiquette) {
  const S = new Rap_(), JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const d = R.jour.split("-"), jsem = JOURS[new Date(Date.UTC(+d[0], +d[1] - 1, +d[2])).getUTCDay()];
  const HG = 15;                                            // lignes reservees a un bloc accompagne d'un graphique
  S.ligne(["RAPPORT JOURNALIER — " + etiquette + " — " + jsem + " " + d[2] + "/" + d[1] + "/" + d[0] + (R.partiel ? " — PROVISOIRE (journée en cours)" : "")], "titre");
  S.ligne(["Généré le " + fmtDouala_(new Date(), "dd/MM/yyyy à HH:mm") + ". Fiches REJETE exclues. Le rapport du jour en cours se régénère seul toutes les heures (provisoire), puis à 19 h (définitif)."], "note");
  S.vide();

  S.ligne(["1. SYNTHÈSE DU JOUR"], "section");
  S.table(["Indicateur", "Valeur", "Lecture"], R.synthese);
  S.vide();

  S.ligne(["2. RECOMMANDATIONS POUR LE JOUR SUIVANT"], "section");
  if (R.recos.length) { const r0 = S.table(["Thème", "Action recommandée"], R.recos); S.marque("gras", r0 + 1, 1, R.recos.length, 1); }
  else S.ligne(["Aucune action particulière : production et qualité conformes."]);
  S.vide();

  S.ligne(["3. PRODUCTION PAR VILLE"], "section");
  S.table(["Ville", "Fiches du jour", "Cumul", "Quota", "% du quota", "Reste", "Enquêteurs", "Requis / enquêteur / jour", "Situation"],
    R.villes.map(function (v) { return [v.z.libelle, v.nJ, v.cumul, v.quota, v.quota ? v.cumul / v.quota : "", v.reste, v.nEnq, v.requis === null ? "—" : Math.round(v.requis * 10) / 10, v.etat]; }), [5]);
  S.vide();

  S.ligne(["4. CLASSEMENT DES ENQUÊTEURS (du meilleur au moins bon, sur le jour)"], "section");
  const rc = S.table(["Rang", "Enquêteur", "Fiches du jour", "Nom", "Zone", "% objectif", "Cumul", "À vérifier", "Rejetées", "Délais courts", "Tél. en double", "% sans réponse", "Score /100", "Appréciation"],
    R.classement.map(function (c) { return [c.rang, c.id, c.n, c.nom, c.zone || "(à saisir)", c.pObj === null ? "" : c.pObj, c.cumul, c.pb, c.rej, c.dc, c.tel, c.nr === null ? "" : c.nr, c.score, c.avis]; }), [6, 12]);
  R.classement.forEach(function (c, i) {
    S.marque(c.avis === "Très bon" || c.avis === "Bon" ? "vert" : c.avis === "À suivre" ? "jaune" : "rouge", rc + 1 + i, 14);
  });
  if (R.classement.length) S.ch.push({ type: "BAR", titre: "Fiches du jour par enquêteur (objectif : " + R.objectif + ")", r: rc, c: 2, nr: R.classement.length + 1, nc: 2, pos: rc, h: Math.max(260, 26 * R.classement.length + 80) });
  if (R.partiel) S.ligne(["Journée en cours : les 50 points de production sont calculés sur " + Math.round(100 * R.part) + " % de l'objectif (prorata 8 h – 18 h). La colonne « % objectif » reste calculée sur l'objectif de la journée entière."], "note");
  S.ligne(["Score = 50 points de production (fiches ÷ objectif, plafonné) + 30 points de fiabilité (part des fiches sans anomalie imputable ni rejet) + 20 points de complétude (0 point à partir de 20 % de questions sans réponse)."], "note");
  S.ligne(["Très bon ≥ 80 · Bon ≥ 65 · À suivre ≥ 50 · Insuffisant < 50. L'anomalie « zone non paramétrée » n'est pas imputée à l'enquêteur. Le score classe, il ne prouve rien : un bon score n'exclut pas une fiche inventée, d'où les rappels téléphoniques."], "note");
  S.jusqua(rc + Math.max(HG, Math.ceil((26 * R.classement.length + 80) / 21) + 1));
  S.vide();

  S.ligne(["5. CIBLES INTERROGÉES (Q1)"], "section");
  const rq = S.table(["Cible", "Fiches du jour", "% du jour", "Cumul", "Quota", "% du quota", "Reste"],
    R.cibles.map(function (c) { return [c.lib, c.nJ, c.pJ === null ? "" : c.pJ, c.cumul, c.quota, c.pQ === null ? "" : c.pQ, c.reste]; }), [3, 6]);
  if (R.nJ) S.ch.push({ type: "PIE", titre: "Répartition des fiches du jour par cible", r: rq, c: 1, nr: R.cibles.length + 1, nc: 2, pos: rq });
  S.jusqua(rq + HG); S.vide();

  S.ligne(["6. TENDANCES DU JOUR, COMPARÉES AUX JOURS PRÉCÉDENTS"], "section");
  S.ligne(["▲ ▼ = écart d'au moins " + SEUIL_ECART_POINTS + " points avec les jours précédents, signalé seulement si chaque base compte au moins " + SEUIL_BASE_TENDANCE + " fiches. Suivi J1 | J2 | J3 côte à côte : onglet RECAP_JOURS."], "note");
  R.tendances.forEach(function (t) {
    S.ligne([t.label + " — base du jour : " + t.baseJ + (t.baseA ? " ; jours précédents : " + t.baseA : " ; pas de jour précédent") +
      (t.tete ? " — en tête : " + t.tete.lib + " (" + Math.round(100 * t.tete.pJ) + " %)" : "")], "bleu");
    const rt = S.table(["Modalité", "Fiches du jour", "% du jour", "% jours précédents", "Écart (points)", "Signal"],
      t.rows.map(function (x) { return [x.lib, x.nJ, x.pJ === null ? "" : x.pJ, x.pA === null ? "" : x.pA, x.ec === null ? "" : Math.round(x.ec), x.sig]; }), [3, 4]);
    t.rows.forEach(function (x, i) { if (x.sig) S.marque(x.ec > 0 ? "vert" : "rouge", rt + 1 + i, 6); });
    if (t.baseJ) S.ch.push({ type: t.rows.length <= 6 ? "PIE" : "BAR", titre: t.label.replace(/^Q\d+\.\s*/, "") + " — jour", r: rt, c: 1, nr: t.rows.length + 1, nc: 2, pos: rt - 1 });
    S.jusqua(rt - 1 + HG); S.vide();
  });

  S.ligne(["7. QUESTIONS LAISSÉES SANS RÉPONSE (10 premières)"], "section");
  if (R.nonRep.length) {
    const rn = S.table(["Question", "Fiches sans réponse", "% des fiches du jour"], R.nonRep.map(function (x) { return [x.q, x.n, x.tx === null ? "" : x.tx]; }), [3]);
    R.nonRep.forEach(function (x, i) { if (x.tx >= SEUIL_NR_QUESTION) S.marque("rouge", rn + 1 + i, 3); });
  } else S.ligne(["Aucune question sautée ce jour."]);
  S.vide();

  S.ligne(["8. RYTHME DE COLLECTE PAR HEURE"], "section");
  if (R.heures.length) {
    const rh = S.table(["Heure", "Fiches"], R.heures);
    S.ch.push({ type: "COLUMN", titre: "Fiches soumises par heure", r: rh, c: 1, nr: R.heures.length + 1, nc: 2, pos: rh });
    S.jusqua(rh + HG);
  } else S.ligne(["Aucune fiche ce jour."]);

  // ----- ecriture -----
  // Onglet neuf a chaque generation (au meme emplacement) : aucun format de l'ancien rapport ne subsiste
  let sh = null;
  try {
    const ancien = ss.getSheetByName(nom);
    let place = ss.getSheets().length;
    if (ancien) { place = ancien.getIndex() - 1; supprimerOnglet_(ss, ancien); }
    sh = ss.insertSheet(nom, Math.min(place, ss.getSheets().length));
  } catch (e) {                                              // suppression impossible : on vide l'onglet existant, formats compris
    sh = ss.getSheetByName(nom) || ss.insertSheet(nom, ss.getSheets().length);
    sh.getCharts().forEach(function (c) { sh.removeChart(c); });
    sh.clear();
    try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearFormat(); } catch (e2) { /* rien */ }
  }
  let W = 1;
  S.L.forEach(function (l) { if (l.length > W) W = l.length; });
  const data = S.L.map(function (l) { const x = l.slice(); while (x.length < W) x.push(""); return x; });
  if (sh.getMaxColumns() < W + 9) sh.insertColumnsAfter(sh.getMaxColumns(), W + 9 - sh.getMaxColumns());
  if (sh.getMaxRows() < data.length + 20) sh.insertRowsAfter(sh.getMaxRows(), data.length + 20 - sh.getMaxRows());
  sh.getRange(1, 1, data.length, W).setValues(data).setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
  const a1 = function (t) { return lettreColonne_(t[1]) + t[0] + ":" + lettreColonne_(t[1] + t[3] - 1) + (t[0] + t[2] - 1); };
  const st = S.st, appl = function (k, f) { if (st[k].length) f(sh.getRangeList(st[k].map(a1))); };
  appl("titre", function (r) { r.setFontSize(15).setFontWeight("bold").setFontColor("#1F4E78"); });
  appl("section", function (r) { r.setFontSize(11).setFontWeight("bold").setBackground("#1F4E78").setFontColor("#FFFFFF"); });
  appl("tete", function (r) { r.setFontWeight("bold").setBackground("#D9E1F2").setWrap(true); });
  appl("bleu", function (r) { r.setFontWeight("bold").setFontColor("#1F4E78"); });
  appl("gras", function (r) { r.setFontWeight("bold"); });
  appl("note", function (r) { r.setFontStyle("italic").setFontColor("#595959").setFontSize(9); });
  appl("pct", function (r) { r.setNumberFormat("0%"); });
  appl("vert", function (r) { r.setBackground("#D9EAD3").setFontWeight("bold"); });
  appl("jaune", function (r) { r.setBackground("#FFF2CC").setFontWeight("bold"); });
  appl("rouge", function (r) { r.setBackground("#F4CCCC").setFontWeight("bold"); });
  sh.setColumnWidth(1, 300);
  for (let c = 2; c <= W; c++) sh.setColumnWidth(c, c === 4 ? 150 : c === W ? 190 : 105);
  S.ch.forEach(function (g) {
    let b = sh.newChart().setChartType(Charts.ChartType[g.type]).addRange(sh.getRange(g.r, g.c, g.nr, g.nc)).setNumHeaders(1)
      .setOption("title", g.titre).setOption("width", 460).setOption("height", g.h || 290).setOption("colors", g.type === "PIE" ? PALETTE : [PALETTE[0]])
      .setPosition(g.pos, W + 2, 0, 0);
    if (g.type === "PIE") b = b.setOption("pieHole", 0.45).setOption("pieSliceText", "percentage").setOption("legend", { position: "right" });
    else b = b.setOption("legend", { position: "none" });
    sh.insertChart(b.build());
  });
  sh.setFrozenRows(1);
  return sh;
}

/**
 * RAPPORT JOURNALIER : un onglet par jour de terrain (RAPPORT_J1, RAPPORT_J2, RAPPORT_J3).
 * A lancer a tout moment ; se lance aussi tout seul chaque soir a 19 h.
 * Si les dates J1 a J3 ne sont pas saisies dans PARAMETRES, le rapport porte sur les
 * derniers jours reellement observes (onglets RAPPORT_jj-mm).
 */
function rapportJournalier() { return rapports_(false); }

/** @param {boolean} seulAujourdhui  true = ne regenerer que le rapport du jour en cours (passage automatique horaire) */
function rapports_(seulAujourdhui) {
  if (!seulAujourdhui) { try { synchroniser_("RAPPORT", null, true, false); } catch (e) { Logger.log("Synchronisation préalable impossible : " + e.message); } }
  const ss = classeur_(), base = lireBase_(ss);
  try { const cal = calerJours_(ss, base); if (cal) Logger.log(cal); } catch (e) { Logger.log("Calage des jours impossible : " + e.message); }
  const val = function (nom, defaut) { try { const v = Number(ss.getRangeByName(nom).getValue()); return v > 0 ? v : defaut; } catch (e) { return defaut; } };
  const aujourdhui = fmtDouala_(new Date(), "yyyy-MM-dd"), declares = [];
  JK.forEach(function (k) {
    try { const j = jourDe_(ss.getRangeByName("P_J" + k).getValue()); if (j) declares.push({ etiquette: "JOUR " + k, nom: "RAPPORT_J" + k, jour: j }); } catch (e) { /* date absente */ }
  });
  const jours = declares.map(function (x) { return x.jour; }).sort();
  const observes = [];
  base.forEach(function (o) { if (!o._rej && observes.indexOf(o._jour) < 0) observes.push(o._jour); });
  observes.sort();
  const hors = function (j) { const p = j.split("-"); return { etiquette: "jour hors calendrier", nom: "RAPPORT_" + p[2] + "-" + p[1], jour: j }; };
  let aFaire = declares.filter(function (x) { return x.jour <= aujourdhui; });
  if (!declares.length) aFaire = observes.slice(-3).map(hors);
  else if (observes.indexOf(aujourdhui) >= 0 && jours.indexOf(aujourdhui) < 0) aFaire.push(hors(aujourdhui));
  // Menage : un jour desormais declare n'a plus besoin de son ancien onglet « hors calendrier » ;
  // un RAPPORT_Jk dont le jour n'est pas encore arrive (ou n'est plus declare) est retire.
  declares.forEach(function (x) { const o = ss.getSheetByName(hors(x.jour).nom); if (o) supprimerOnglet_(ss, o); });
  JK.forEach(function (k) {
    if (!aFaire.some(function (x) { return x.nom === "RAPPORT_J" + k; })) { const o = ss.getSheetByName("RAPPORT_J" + k); if (o) supprimerOnglet_(ss, o); }
  });
  const mnt = new Date();
  const p = { maintenant: { jour: aujourdhui, heure: Number(fmtDouala_(mnt, "HH")) + Number(fmtDouala_(mnt, "mm")) / 60 },
              jours: jours, nbJours: val("P_NB_JOURS", CONFIG.NB_JOURS), enqueteurs: listeEnqueteurs_(ss), objectifJour: val("P_OBJ_JOUR", CONFIG.OBJECTIF_JOUR),
              seuilDelai: seuilDelai_(ss), seuilVolume: val("P_SEUIL_VOLUME", CONFIG.SEUIL_VOLUME_JOUR), quotas: lireQuotas_(ss) };
  if (seulAujourdhui) aFaire = aFaire.filter(function (x) { return x.jour === aujourdhui; });
  const faits = aFaire.map(function (x) {
    const R = calculerRapport_(base, Object.assign({ jour: x.jour }, p));
    ecrireRapport_(ss, x.nom, R, x.etiquette);
    return x.nom + " (" + R.nJ + " fiches, " + R.recos.length + " recommandations" + (R.partiel ? ", provisoire" : "") + ")";
  });
  try {
    PropertiesService.getScriptProperties().setProperty("RAPPORT_AUTO", new Date().getTime() + "|" +
      base.filter(function (o) { return o._jour === aujourdhui; }).length);
  } catch (e) { /* rien */ }
  Logger.log(faits.length ? "Rapports générés : " + faits.join(" ; ") : "Aucun jour de terrain à rapporter : saisir DATE_J1 à J4 dans PARAMETRES.");
  return faits;
}

/**
 * >>> A LANCER UNE FOIS APRES AVOIR COLLE CETTE VERSION <<<  (sans danger si relance)
 * Remet les declencheurs, rattrape les fiches manquantes, cale DATE_J1 a J3 sur les jours
 * reels de collecte, regenere les liens personnels, reconstruit les tableaux par jour et
 * genere les rapports. Ne touche ni aux questions du formulaire, ni aux fiches du masque,
 * ni aux statuts du superviseur, ni aux quotas modifies.
 */
function mettreAJour() {
  const form = formulaire_(), ss = classeur_();
  installerDeclencheurs_(form);
  let j4 = "";
  try { j4 = assurerJours_(ss); } catch (e) { j4 = "Jour 4 non paramétré : " + e.message; journal_(ss, "ERREUR", j4); }
  // Recodage complet : les fiches vides ou sans Q1 deja recues recoivent leur anomalie (REJETE et N° de fiche conserves)
  synchroniser_("MAJ_V11", null, true, true);
  let cal = "";
  try { cal = calerJours_(ss, lireBase_(ss)); } catch (e) { cal = "Calage des jours impossible : " + e.message; journal_(ss, "ERREUR", cal); }
  let liens = "Liens personnels régénérés (onglet ENQUETEURS) : les anciens restent valables.";
  try { creerEnqueteurs_(ss, form); }
  catch (e) { liens = "Liens personnels NON régénérés (les liens actuels restent valables) : " + e.message; journal_(ss, "ERREUR", liens); }
  creerTableauDeBord_(ss);
  creerTriAPlat_(ss);
  creerSuiviCibles_(ss);
  creerRecapJours_(ss);
  const faits = rapportJournalier();
  let verif = "";
  try { verif = verifierFormulaire(); } catch (e) { verif = "Vérification du formulaire impossible : " + e.message; }
  Logger.log(j4 || "Jour 4 : déjà paramétré.");
  Logger.log(cal || "Dates J1 à J3 : déjà cohérentes avec les jours de collecte, non modifiées.");
  Logger.log(liens);
  Logger.log("Tableaux par jour reconstruits (J1 à J" + NJ + ") : TABLEAU_DE_BORD, TRI_A_PLAT, SUIVI_CIBLES, RECAP_JOURS.");
  Logger.log("Rapports : " + (faits.join(" ; ") || "aucun"));
  Logger.log("Formulaire : " + verif);
  Logger.log("Synchronisation : " + sante());
  Logger.log("Classeur : " + ss.getUrl());
}
/**
 * Jour 4 (prolongation) : cree la ligne DATE_J4 dans PARAMETRES si elle manque (en bas de l'onglet,
 * sans deplacer les lignes existantes) et la remplit avec le lendemain de DATE_J3 si elle est vide.
 * Une date deja saisie n'est jamais modifiee.
 */
function assurerJours_(ss) {
  const sh = ss.getSheetByName("PARAMETRES"), msgs = [];
  if (!sh) return "Onglet PARAMETRES introuvable : exécuter installer().";
  for (let k = 4; k <= NJ; k++) {
    let r = null;
    try { r = ss.getRangeByName("P_J" + k); } catch (e) { r = null; }
    if (!r) {
      const n = sh.getLastRow();
      let ligne = 0;
      if (n > 0) sh.getRange(1, 1, n, 1).getValues().forEach(function (l, i) { if (norm_(l[0]) === "DATE_J" + k) ligne = i + 1; });
      if (!ligne) {
        ligne = n + 1;
        sh.getRange(ligne, 1, 1, 3).setValues([["DATE_J" + k, "", "Date du " + k + "e jour de terrain (prolongation). Vider la case si ce jour n'est pas utilisé."]]);
      }
      r = sh.getRange(ligne, 2);
      r.setNumberFormat("dd/MM/yyyy").setBackground("#FFF2CC");
      ss.setNamedRange("P_J" + k, r);
      msgs.push("Ligne DATE_J" + k + " ajoutée dans PARAMETRES");
    }
    if (r.getValue() === "" || r.getValue() === null) {
      let prec = null;
      try { prec = jourDe_(ss.getRangeByName("P_J" + (k - 1)).getValue()); } catch (e) { prec = null; }
      if (prec) {
        let j = lendemain_(prec);
        if (estDimanche_(j)) j = lendemain_(j);
        r.setValue(Utilities.parseDate(j + " 00:00:00", CONFIG.FUSEAU, "yyyy-MM-dd HH:mm:ss")).setNumberFormat("dd/MM/yyyy");
        const p = j.split("-");
        msgs.push("DATE_J" + k + " = " + p[2] + "/" + p[1] + "/" + p[0] + " (lendemain de J" + (k - 1) + " ; modifiable dans PARAMETRES)");
      }
    }
  }
  SpreadsheetApp.flush();
  if (msgs.length) journal_(ss, "JOURS", msgs.join(" ; "));
  return msgs.join(" ; ");
}

/**
 * >>> CONTROLE DU FORMULAIRE : peut-on envoyer une fiche sans repondre a Q1 « Vous etes » ? <<<
 * Rend Q1 obligatoire (francais et anglais) si elle ne l'est pas, puis parcourt les pages du
 * formulaire et leurs aiguillages pour chercher un chemin qui mene a l'envoi sans passer par Q1.
 * Ne modifie rien d'autre. Le resultat est ecrit dans le journal d'execution et dans JOURNAL_SYNC.
 */
function verifierFormulaire() {
  const form = formulaire_(), T = FormApp.ItemType, N = FormApp.PageNavigationType, notes = [];
  const pages = [{ brk: null, titre: "page 1 (identification)", items: [], q1: false }];
  form.getItems().forEach(function (x) {
    if (x.getType() === T.PAGE_BREAK) pages.push({ brk: x.asPageBreakItem(), titre: "page " + (pages.length + 1) + " (" + x.getTitle() + ")", items: [], q1: false });
    else pages[pages.length - 1].items.push(x);
  });
  const typ = function (x) { const t = x.getType(); return t === T.MULTIPLE_CHOICE ? x.asMultipleChoiceItem() : t === T.LIST ? x.asListItem() : null; };
  let nQ1 = 0, rendues = 0;
  pages.forEach(function (p) {
    p.items.forEach(function (x) {
      if (numeroQuestion_(x.getTitle()) !== 1) return;
      const q = typ(x);
      if (!q) { notes.push("Q1 n'est pas une question à choix unique (" + x.getTitle() + ")"); return; }
      nQ1++;
      if (!q.isRequired()) { q.setRequired(true); rendues++; }
      p.q1 = true;
    });
  });
  if (!nQ1) notes.push("aucune question « Q1. » trouvée");
  if (rendues) notes.push(rendues + " question(s) Q1 n'étai(en)t PAS obligatoire(s) : rendue(s) obligatoire(s)");
  const indice = function (b) { if (!b) return -1; for (let i = 1; i < pages.length; i++) if (pages[i].brk.getId() === b.getId()) return i; return -1; };
  const FIN = -1;
  const suite = function (i) {                                   // ou mene le bouton Suivant en fin de page i
    if (i + 1 >= pages.length) return FIN;
    const b = pages[i + 1].brk;
    let nav = null;
    try { nav = b.getPageNavigationType(); } catch (e) { nav = null; }
    if (nav === N.SUBMIT) return FIN;
    if (nav === N.GO_TO_PAGE) { const g = indice(b.getGoToPage()); return g > 0 ? g : i + 1; }
    return i + 1;
  };
  const sorties = function (i) {
    const out = [];
    let impose = false;
    pages[i].items.forEach(function (x) {
      const q = typ(x);
      if (!q) return;
      let aiguille = false;
      q.getChoices().forEach(function (c) {
        let nav = null;
        try { nav = c.getPageNavigationType(); } catch (e) { nav = null; }
        if (nav === null || nav === undefined) return;
        aiguille = true;
        if (nav === N.SUBMIT) out.push(FIN);
        else if (nav === N.GO_TO_PAGE) { const g = indice(c.getGotoPage()); if (g > 0) out.push(g); }
        else if (nav === N.CONTINUE) out.push(i + 1 < pages.length ? i + 1 : FIN);
      });
      if (aiguille && q.isRequired()) impose = true;
    });
    if (!impose) out.push(suite(i));
    return out;
  };
  let fuite = null;
  const vus = {};
  const explorer = function (i, chemin) {
    if (fuite || i === FIN) { if (!fuite) fuite = chemin.concat(["ENVOI"]); return; }
    if (vus[i] || pages[i].q1) return;                           // une page qui contient Q1 obligatoire bloque l'envoi
    vus[i] = true;
    sorties(i).forEach(function (d) { explorer(d, chemin.concat([pages[i].titre])); });
  };
  explorer(0, []);
  const verdict = fuite ? "✘ Une fiche peut être envoyée SANS Q1 par ce chemin : " + fuite.join(" → ") + ". Corriger l'aiguillage des sections dans le formulaire."
                        : "✔ Aucun chemin ne permet d'envoyer une fiche sans répondre à Q1 (" + pages.length + " pages, " + nQ1 + " question(s) Q1 obligatoire(s))";
  const msg = verdict + (notes.length ? " — " + notes.join(" ; ") : "");
  try { journal_(classeur_(), "FORMULAIRE", msg); } catch (e) { /* rien */ }
  Logger.log(msg);
  return msg;
}
/** Ancien nom, conserve pour compatibilite. */
function mettreAJourV6() { mettreAJour(); }

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

// =====================================================================
// 11. FORMULAIRE EN ANGLAIS (V7)
//     creerFormulaireAnglais() cree un SECOND formulaire, traduction fidele du
//     formulaire francais en ligne (memes questions, meme ordre, memes options,
//     memes questions obligatoires). Le formulaire francais n'est pas modifie.
//     Les deux formulaires alimentent le MEME masque, avec les MEMES codes :
//     « Particulier » et « Individual » donnent tous deux VOUSETES = 1.
//     Rien ne change pour SPSS.
// =====================================================================
const EN = {
  titre: "Survey - Distribution of electrical equipment and supplies in Cameroon",
  langue: "Langue du questionnaire / Questionnaire language",
  aideLangue: "English-speaking respondent: select “English”, then tap Next. — Répondant francophone : ne rien cocher, toucher Suivant.",
  pageFr: "Questionnaire en français", pageEn: "Questionnaire in English",
  description: "FILLING INSTRUCTIONS: tick the matching box. One answer only unless marked “several answers”.",
  confirmation: "Form saved. Tap “Submit another response” for the next respondent.",
  ident: { enq: "Enumerator ID", quartier: "Neighbourhood / area (e.g. Makepe)", site: "Exact site / landmark (e.g. Makepe Saint-Tropez)",
           nom: "Respondent's name or company name", tel: "Respondent's phone number", mail: "Respondent's e-mail (optional)",
           accord: "The respondent agrees to be contacted again for commercial purposes" },
  sections: { "1. Profil du répondant": "1. Respondent profile", "2. Habitudes d'achat": "2. Buying habits", "3. Marques": "3. Brands",
              "4. Origine des produits": "4. Product origin", "5. Gammes": "5. Product ranges", "6. Freins à l'achat": "6. Barriers to purchase",
              "7. Service client & SAV": "7. Customer service & after-sales", "8. Canaux & achat en ligne": "8. Channels & online purchasing",
              "9. Fidélisation": "9. Loyalty" },
  aides: { "Une seule réponse.": "One answer only.", "Cochez une case par ligne.": "Tick one box per row.",
           "9 chiffres, ex. 6XXXXXXXX (indicatif +237 facultatif)": "9 digits, e.g. 6XXXXXXXX (+237 prefix optional)",
           "À lire à l'enquêté : « Acceptez-vous que vos coordonnées soient utilisées pour vous recontacter avec des offres commerciales ? Vos réponses au questionnaire restent anonymes dans l'analyse. »":
             "Read to the respondent: “Do you agree that your contact details may be used to contact you again with commercial offers? Your answers to the questionnaire remain anonymous in the analysis.”" },
  divers: { "Oui": "Yes", "Non": "No" },
  // n : { q: titre, c: options dans l'ordre du dictionnaire, l: lignes de grille }
  q: {
    1: { q: "Q1. You are", c: ["Individual", "Company (SME, industry…)", "Electrician/tradesperson", "Construction company", "Reseller/Wholesaler/Distributor"] },
    2: { q: "Q2. Gender", c: ["Male", "Female"] },
    3: { q: "Q3. Age", c: ["<25", "25–34", "35–44", "45–54", "55+"] },
    4: { q: "Q4. City / region", c: ["Douala", "Yaoundé", "Bafoussam"] },
    5: { q: "Q5. Monthly household income (FCFA)", c: ["<100k", "100k–250k", "250k–500k", "500k–1M", ">1M", "Don't know"] },
    6: { q: "Q6. Purchase frequency", c: ["Every week", "1–3 times a month", "A few times a year", "Rarely"] },
    7: { q: "Q7. Main place of purchase", c: ["Hardware store", "Specialised wholesaler", "Specialised shop", "Market", "Importer", "Online"] },
    8: { q: "Q8. Average amount per purchase (FCFA)", c: ["<25k", "25k–100k", "100k–500k", "500k–2M", ">2M"] },
    9: { q: "Q9. Products purchased (several answers)", c: ["Cables/wires", "Switchgear/circuit breakers", "Sockets/switches", "Light fittings", "Solar/inverters", "Generators"] },
    10: { q: "Q10. Preferred payment method", c: ["Cash", "Mobile Money", "Bank transfer", "Supplier credit"] },
    11: { q: "Q11. Importance of the brand", c: ["Very important", "Important", "Not very important", "Not important"] },
    12: { q: "Q12. Brand purchased most often", c: ["Schneider", "Legrand", "Vectron", "Hager", "ABB", "Siemens", "Chint/Chinese brand", "Philips", "JA Solar", "Longi", "Growatt"] },
    13: { q: "Q13. Main selection criterion", c: ["Price", "Quality/durability", "Availability", "Reputation", "Warranty/after-sales service", "Compliance with standards"] },
    14: { q: "Q14. Preferred origin", c: ["Europe", "Asia", "America", "No preference"] },
    15: { q: "Q15. Best quality/reliability in your opinion", c: ["Europe", "Asia", "America", "No opinion"] },
    16: { q: "Q16. Best price in your opinion", c: ["Europe", "Asia", "America", "No opinion"] },
    17: { q: "Q17. Origin influences your purchase", c: ["Strongly", "Moderately", "Slightly", "Not at all"] },
    18: { q: "Q18. Range purchased most often", c: ["High-end", "Mid-range", "Low-end", "Depends on the project"] },
    19: { q: "Q19. For you, what defines a HIGH-END product ABOVE ALL", c: ["A high price", "A recognised brand", "Durability / reliability", "Origin (Europe, Asia, etc.)",
          "Certifications / compliance with standards", "A long warranty"] },
    20: { q: "Q20. For you, what characterises a LOW-END product ABOVE ALL", c: ["A low price", "A generic Asian origin", "No well-known brand", "A short lifespan",
          "No warranty", "A risk of non-compliance"] },
    21: { q: "Q21. Which origin do you spontaneously associate with HIGH-END products?", c: ["Europe", "Asia", "America", "No opinion"] },
    22: { q: "Q22. Which origin do you spontaneously associate with LOW-END products?", c: ["Europe", "Asia", "America", "No opinion"] },
    23: { q: "Q23. For a common item (e.g. circuit breaker), which price bracket do you associate with each range?",
          c: ["< 5,000 FCFA", "5,000 – 15,000", "15,000 – 40,000", "> 40,000 FCFA"], l: ["High-end", "Mid-range", "Low-end"] },
    24: { q: "Q24. In your opinion, the quality gap between high-end and low-end products is", c: ["Very large", "Large", "Moderate", "Small", "Non-existent"] },
    25: { q: "Q25. Main priority", c: ["The cheapest", "Best value for money", "Best quality whatever the price"] },
    26: { q: "Q26. Extra cost accepted to move up a range", c: ["None", "Up to +10%", "+10–25%", "+25–50%", ">+50%"] },
    27: { q: "Q27. Main barrier", c: ["High price", "Doubt about quality/counterfeit", "Unavailability", "Lack of advice", "No warranty", "Delivery times"] },
    28: { q: "Q28. Fear of buying a counterfeit/non-compliant product", c: ["Often", "Sometimes", "Rarely", "Never"] },
    29: { q: "Q29. Already disappointed by a purchase", c: ["Yes, several times", "Yes, once", "No"] },
    30: { q: "Q30. Importance of customer service and after-sales service", c: ["Very important", "Important", "Not very important", "Not important"] },
    31: { q: "Q31. Service expected first", c: ["Warranty/replacement", "Technical advice", "Repair/spare parts", "Responsiveness", "Delivery/installation"] },
    32: { q: "Q32. Warranty period considered acceptable", c: ["<6 months", "6 months–1 year", "1–2 years", ">2 years"] },
    33: { q: "Q33. Preferred contact channel", c: ["In person", "Phone", "WhatsApp", "E-mail", "Social media"] },
    34: { q: "Q34. Good after-sales service would make you pay more", c: ["Yes", "Maybe", "No"] },
    35: { q: "Q35. Preferred channel", c: ["Hardware store", "Specialised wholesaler", "Specialised shop", "Market", "Importer", "Online"] },
    36: { q: "Q36. Criterion for choosing the channel", c: ["Proximity", "Price", "Breadth of choice", "Availability", "Advice", "Trust"] },
    37: { q: "Q37. Already bought online", c: ["Yes", "No"] },
    38: { q: "Q38. Ready to buy online", c: ["Yes", "Maybe", "No"] },
    39: { q: "Q39. Main barrier to buying online", c: ["Quality/compliance", "Not seeing the product", "Payment security", "Delivery", "No after-sales service"] },
    40: { q: "Q40. Loyal to the same supplier", c: ["Always", "Often", "Sometimes", "Rarely", "Never"] },
    41: { q: "Q41. What would strengthen your loyalty (several answers)", c: ["Prices/promotions", "Consistent quality", "Stock availability", "Good advice",
          "Reliable after-sales service", "Loyalty programme", "Payment facilities"] },
    42: { q: "Q42. A suggestion / expectation (optional)" }
  }
};

/** Libelles francais d'une question, dans l'ordre du dictionnaire. */
function libellesFr_(it) {
  return it.type === "multi" ? it.sousItems.map(function (s) { return s[1]; }) : (it.choix || []).map(function (c) { return c[1]; });
}
/** Reponse anglaise -> libelle francais du dictionnaire (inchangee si elle n'est pas anglaise). */
function fr_(it, texte) {
  const e = EN.q[it.n];
  if (!e || !e.c) return texte;
  const k = cle_(texte), fr = libellesFr_(it);
  if (fr.some(function (x) { return cle_(x) === k; })) return texte;       // deja en francais
  for (let i = 0; i < e.c.length; i++) if (cle_(e.c[i]) === k) return fr[i];
  return texte;
}
function frLigne_(it, texte) {
  const e = EN.q[it.n];
  if (!e || !e.l || !it.lignes) return texte;
  for (let i = 0; i < e.l.length; i++) if (cle_(e.l[i]) === cle_(texte)) return it.lignes[i][1];
  return texte;
}
/** Option francaise du formulaire -> anglais (null si inconnue du dictionnaire). */
function en_(it, texte) {
  const e = EN.q[it.n], fr = libellesFr_(it), k = cle_(texte);
  if (!e || !e.c) return null;
  for (let i = 0; i < fr.length; i++) if (cle_(fr[i]) === k) return e.c[i];
  if (it.alias) { const a = Object.keys(it.alias).filter(function (x) { return cle_(x) === k; })[0]; if (a) return e.c[it.choix.map(function (c) { return c[0]; }).indexOf(it.alias[a])]; }
  return null;
}

/** Ajoute au formulaire « en » la traduction anglaise de l'element « x » (question, titre de section, saut de page). */
function ajouterItemAnglais_(en, x, journal) {
  const T = FormApp.ItemType, secs = {}, aides = {};
  Object.keys(EN.sections).forEach(function (k) { secs[cle_(k)] = EN.sections[k]; });
  Object.keys(EN.aides).forEach(function (k) { aides[cle_(k)] = EN.aides[k]; });
  const aide = function (y) { let h = ""; try { h = y.getHelpText() || ""; } catch (e) { h = ""; } return h ? (aides[cle_(h)] || h) : ""; };
    const t = x.getType(), titreFr = x.getTitle(), n = numeroQuestion_(titreFr), champ = n ? null : champIdent_(titreFr);
    const it = n ? ITEMS.filter(function (q) { return q.n === n; })[0] : null;
    let titre = it && EN.q[n] ? EN.q[n].q : (champ ? EN.ident[champ] : (secs[cle_(titreFr)] || titreFr));
    if (titre === titreFr && t !== T.SECTION_HEADER && t !== T.PAGE_BREAK) journal.push("⚠ titre non traduit (hors dictionnaire) : " + titreFr);
    const options = function (vals) {
      return vals.map(function (v) {
        if (champ === "enq") return v;
        let e = it ? en_(it, v) : (EN.divers[norm_(v)] || null);
        if (e === null) { journal.push("⚠ option non traduite (" + (titreFr.split(".")[0]) + ") : " + v); e = v; }
        return e;
      });
    };
    if (t === T.SECTION_HEADER) en.addSectionHeaderItem().setTitle(titre).setHelpText(aide(x));
    else if (t === T.PAGE_BREAK) en.addPageBreakItem().setTitle(titre).setHelpText(aide(x));
    else if (t === T.LIST) { const s = x.asListItem(); en.addListItem().setTitle(titre).setHelpText(aide(x)).setChoiceValues(options(s.getChoices().map(function (c) { return c.getValue(); }))).setRequired(s.isRequired()); }
    else if (t === T.MULTIPLE_CHOICE) {
      const s = x.asMultipleChoiceItem();
      en.addMultipleChoiceItem().setTitle(titre).setHelpText(aide(x)).setChoiceValues(options(s.getChoices().map(function (c) { return c.getValue(); })))
        .showOtherOption(s.hasOtherOption()).setRequired(s.isRequired());
    } else if (t === T.CHECKBOX) {
      const s = x.asCheckboxItem();
      en.addCheckboxItem().setTitle(titre).setHelpText(aide(x)).setChoiceValues(options(s.getChoices().map(function (c) { return c.getValue(); })))
        .showOtherOption(s.hasOtherOption()).setRequired(s.isRequired());
    } else if (t === T.GRID) {
      const s = x.asGridItem(), e = it && EN.q[n] ? EN.q[n] : {};
      const lig = s.getRows().map(function (r) { const i = it && it.lignes ? it.lignes.map(function (l) { return cle_(l[1]); }).indexOf(cle_(r)) : -1; return i >= 0 && e.l ? e.l[i] : r; });
      en.addGridItem().setTitle(titre).setHelpText(aide(x)).setRows(lig).setColumns(options(s.getColumns())).setRequired(s.isRequired());
    } else if (t === T.TEXT) en.addTextItem().setTitle(titre).setHelpText(aide(x)).setRequired(x.asTextItem().isRequired());
    else if (t === T.PARAGRAPH_TEXT) en.addParagraphTextItem().setTitle(titre).setHelpText(aide(x)).setRequired(x.asParagraphTextItem().isRequired());
    else journal.push("⚠ élément non copié (type " + t + ") : " + titreFr);
}

function formulaireAnglais_() {
  const id = PropertiesService.getScriptProperties().getProperty("FORM_EN_ID");
  if (!id) return null;
  try { return FormApp.openById(id); } catch (e) { return null; }
}

/** Reponses de TOUS les formulaires (francais, puis anglais avec identifiant prefixe « EN: »). */
function enveloppe_(r, prefixe) {
  return { getId: function () { return prefixe + r.getId(); }, getTimestamp: function () { return r.getTimestamp(); },
           getItemResponses: function () { return r.getItemResponses(); } };
}
function toutesReponses_(depuis) {
  const fr = formulaire_(), en = formulaireAnglais_();
  let reps = depuis ? fr.getResponses(depuis) : fr.getResponses();
  if (en) reps = reps.concat((depuis ? en.getResponses(depuis) : en.getResponses()).map(function (r) { return enveloppe_(r, "EN:"); }));
  return reps;
}

function lienPersonnel_(form, idEnq, zone) {
  const T = FormApp.ItemType, items = form.getItems();
  const iE = items.filter(function (x) { return !numeroQuestion_(x.getTitle()) && champIdent_(x.getTitle()) === "enq"; })[0];
  if (!iE) return "";
  const li = iE.getType() === T.LIST ? iE.asListItem() : iE.asMultipleChoiceItem();
  const v = li.getChoices().map(function (c) { return c.getValue(); }).filter(function (x) { return norm_(x).toUpperCase() === idEnq; })[0];
  if (!v) return "";
  let resp = form.createResponse().withItemResponse(li.createResponse(v));
  // Q4 (ville) pre-remplie dans chaque langue du formulaire
  if (zone) items.filter(function (x) { return numeroQuestion_(x.getTitle()) === 4 && x.getType() === T.MULTIPLE_CHOICE; }).forEach(function (iV) {
    const mc = iV.asMultipleChoiceItem();
    const c = mc.getChoices().map(function (x) { return x.getValue(); }).filter(function (x) { return cle_(x) === cle_(zone.libelle); })[0];
    if (c) resp = resp.withItemResponse(mc.createResponse(c));
  });
  return resp.toPrefilledUrl();
}

/**
 * >>> CREE LE FORMULAIRE EN ANGLAIS <<< (a lancer une seule fois)
 * Copie le formulaire francais tel qu'il est en ligne (ordre, options, questions
 * obligatoires, liste des enqueteurs), en anglais. Le formulaire francais n'est pas
 * touche. Les liens personnels anglais apparaissent dans l'onglet ENQUETEURS.
 */
function creerFormulaireAnglais() {
  const props = PropertiesService.getScriptProperties();
  const fr = formulaire_(), ss = classeur_(), T = FormApp.ItemType;
  const deja = formulaireAnglais_();
  if (deja) {
    Logger.log("Le formulaire anglais existe déjà : " + deja.getPublishedUrl() + " (édition : " + deja.getEditUrl() + ").");
    Logger.log("Pour le recréer : supprimer la propriété FORM_EN_ID (Paramètres du projet > Propriétés du script), puis relancer.");
    return;
  }
  const en = FormApp.create(EN.titre);
  en.setDescription(EN.description);
  en.setCollectEmail(false); en.setAllowResponseEdits(false); en.setShowLinkToRespondAgain(true); en.setProgressBar(false);
  en.setConfirmationMessage(EN.confirmation);
  const journal = [];
  fr.getItems().forEach(function (x) { ajouterItemAnglais_(en, x, journal); });
  try { en.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId()); } catch (e) { journal.push("Réponses brutes anglaises non reliées au classeur : " + e.message); }
  props.setProperty("FORM_EN_ID", en.getId());
  installerDeclencheurs_(fr);                 // ajoute le declencheur du formulaire anglais
  creerEnqueteurs_(ss, fr);                   // ajoute la colonne des liens personnels anglais
  journal_(ss, "ANGLAIS", "Formulaire anglais créé : " + en.getPublishedUrl() + (journal.length ? " — " + journal.join(" ; ") : " — traduction complète"));
  Logger.log("Formulaire anglais (public)  : " + en.getPublishedUrl());
  Logger.log("Formulaire anglais (édition) : " + en.getEditUrl());
  Logger.log(journal.length ? journal.join("\n") : "Toutes les questions et options ont été traduites.");
  Logger.log("Liens personnels en anglais : onglet ENQUETEURS, colonne LIEN_PERSONNEL_EN.");
}

/**
 * >>> ANGLAIS DANS LE MEME FORMULAIRE (recommande) <<<  A lancer une seule fois.
 * Ajoute au formulaire existant, juste apres les questions d'identification, le choix
 * « Langue du questionnaire / Questionnaire language » : Français | English.
 *   - Rien de coche ou « Français » : le questionnaire francais habituel.
 *   - « English » : les memes questions Q1 a Q42 en anglais.
 * UN seul formulaire, les MEMES liens des enqueteurs, le MEME masque, les MEMES codes.
 * Les questions francaises existantes et les reponses deja recues ne sont pas modifiees.
 */
function ajouterAnglaisAuFormulaire() {
  const props = PropertiesService.getScriptProperties();
  const form = formulaire_(), ss = classeur_(), T = FormApp.ItemType;
  let items = form.getItems();
  if (items.some(function (x) { return cle_(x.getTitle()) === cle_(EN.langue); })) {
    Logger.log("Le choix de langue est déjà dans le formulaire : rien à faire. Lien public : " + form.getPublishedUrl());
    return;
  }
  const iQ = items.map(function (x) { return numeroQuestion_(x.getTitle()) ? 1 : 0; }).indexOf(1);
  if (iQ < 0) throw new Error("Aucune question « Q1. … » trouvée dans le formulaire.");
  let debut = iQ;                                              // debut du questionnaire : titre de section inclus
  if (debut > 0 && items[debut - 1].getType() === T.SECTION_HEADER) debut--;
  const questionnaire = items.slice(debut).filter(function (x) { return x.getType() !== T.IMAGE && x.getType() !== T.VIDEO; });
  const journal = [];

  // 1. Page francaise : commence au debut du questionnaire existant
  let pageFr;
  if (debut > 0 && items[debut - 1].getType() === T.PAGE_BREAK) pageFr = items[debut - 1].asPageBreakItem();
  else { pageFr = form.addPageBreakItem().setTitle(EN.pageFr); form.moveItem(pageFr.getIndex(), debut); }

  // 2. Choix de la langue : dernier element de la page d'identification
  const langue = form.addMultipleChoiceItem().setTitle(EN.langue).setHelpText(EN.aideLangue).setRequired(false);
  form.moveItem(langue.getIndex(), pageFr.getIndex());

  // 3. Page anglaise, a la fin : traduction de chaque element du questionnaire
  const pageEn = form.addPageBreakItem().setTitle(EN.pageEn);
  questionnaire.forEach(function (x) { ajouterItemAnglais_(form, x, journal); });
  pageEn.setGoToPage(FormApp.PageNavigationType.SUBMIT);       // fin du questionnaire francais = envoi (sans passer par l'anglais)

  // 4. Aiguillage
  langue.setChoices([langue.createChoice("Français", pageFr), langue.createChoice("English", pageEn)]);

  props.setProperty("ANGLAIS_INTEGRE", "1");
  creerEnqueteurs_(ss, form);                                  // liens personnels : ville pre-remplie dans les deux langues
  journal_(ss, "ANGLAIS", "Anglais ajouté au formulaire (" + questionnaire.length + " éléments traduits)" + (journal.length ? " — " + journal.join(" ; ") : " — traduction complète"));
  Logger.log("Anglais ajouté au formulaire. Lien public inchangé : " + form.getPublishedUrl());
  Logger.log(journal.length ? journal.join("\n") : "Toutes les questions et options ont été traduites.");
  Logger.log("Liens personnels régénérés (onglet ENQUETEURS) : les anciens liens restent valables.");
}

/** Abandonne le formulaire anglais SEPARE (cree par creerFormulaireAnglais) : ses reponses sortent du masque. */
function retirerFormulaireAnglaisSepare() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("FORM_EN_ID")) { Logger.log("Aucun formulaire anglais séparé n'est relié."); return; }
  props.deleteProperty("FORM_EN_ID");
  installerDeclencheurs_(formulaire_());
  creerEnqueteurs_(classeur_(), formulaire_());
  synchroniser_("ANGLAIS", null, true, false);
  Logger.log("Formulaire anglais séparé détaché. Vous pouvez le supprimer dans Google Forms.");
}

// Export pour les tests hors Google (sans effet dans Apps Script)
if (typeof module !== "undefined") module.exports = { verifierFormulaire: verifierFormulaire, assurerJours_: assurerJours_, reconstruireMasque: reconstruireMasque, installer: installer, suiviAutomatique_: suiviAutomatique_, mettreAJour: mettreAJour, calerJours: calerJours, planJours_: planJours_, jourDe_: jourDe_, actualiser: actualiser, ajouterAnglaisAuFormulaire: ajouterAnglaisAuFormulaire, creerFormulaireAnglais: creerFormulaireAnglais, mettreAJourV6: mettreAJourV6,
  rapportJournalier: rapportJournalier, synchroniser_: synchroniser_, sante: sante, surSoumission: surSoumission, filetDeSecurite: filetDeSecurite, reparer: reparer,
  exporterPourSPSS: exporterPourSPSS, diagnostiquer: diagnostiquer, ITEMS: ITEMS, structurer_: structurer_, coderFiche_: coderFiche_,
  construireLigne_: construireLigne_, colonnesMasque_: colonnesMasque_, planSync_: planSync_, numSeq_: numSeq_, calculerRapport_: calculerRapport_, EN: EN, fr_: fr_, en_: en_, varsQuestions_: varsQuestions_, cle_: cle_, numeroQuestion_: numeroQuestion_, champIdent_: champIdent_ };
