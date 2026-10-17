* ============================================================.
* Syntaxe SPSS generee automatiquement depuis le dictionnaire des variables.
* Etude : Distribution Matériel & Equipements Electriques - Cameroun.
* Generer cette syntaxe = pas de ressaisie manuelle des libelles/codes dans SPSS.
* Utilisation : File > Open > Data (choisir le fichier importe depuis le masque),
* puis File > New > Syntax, coller ce contenu, Run > All.
* ============================================================.

VARIABLE LABELS
  NUMFICHE "N° fiche (auto)"
  ENQUETID "Identifiant enquêteur"
  DATENQUE "Date d'enquête (auto, horodatage)"
  ZONEETUD "Zone d'étude (fixe par formulaire)"
  SITEENQU "Site"
  GPSLIENQ "Position GPS (lien, contrôle qualité)"
  HDEBUTEN "Heure de début d'entretien"
  DUREEMIN "Durée de remplissage (minutes, contrôle qualité)"
  TYPEREPO "Q1 Vous êtes"
  GENRESEX "Q2 Genre"
  AGEREPON "Q3 Âge"
  VILLEREG "Q4 Ville / région"
  REVENUME "Q5 Revenu mensuel du ménage (FCFA)"
  FREQACHA "Q6 Fréquence d'achat"
  LIEUACHA "Q7 Lieu d'achat principal"
  MONTACHA "Q8 Montant moyen par achat (FCFA)"
  PRODCABL "Q9 Produits achetés (plusieurs réponses) - Câbles/fils"
  PRODAPPA "Q9 Produits achetés (plusieurs réponses) - Appareillage/disjoncteurs"
  PRODPRIS "Q9 Produits achetés (plusieurs réponses) - Prises/interrupteurs"
  PRODLUMI "Q9 Produits achetés (plusieurs réponses) - Luminaires"
  PRODSOLA "Q9 Produits achetés (plusieurs réponses) - Solaire/onduleurs"
  PRODGROU "Q9 Produits achetés (plusieurs réponses) - Groupes électrogènes"
  PAIEMENT "Q10 Paiement privilégié"
  IMPOMARQ "Q11 Importance de la marque"
  MARQACHA "Q12 Marque achetée le plus souvent"
  CRITMARQ "Q13 Principal critère de choix"
  ORIGPREF "Q14 Origine privilégiée"
  ORIGQUAL "Q15 Meilleure qualité/fiabilité selon vous"
  ORIGPRIX "Q16 Meilleur prix selon vous"
  ORIGINFL "Q17 L'origine influence votre achat"
  GAMMACHA "Q18 Gamme achetée le plus souvent"
  PRIORACH "Q19 Priorité principale"
  SURCOUAC "Q20 Surcoût accepté pour monter en gamme"
  FREINACH "Q21 Principal frein"
  CRAICONT "Q22 Crainte d'acheter un produit contrefait/non conforme"
  DECEPTIO "Q23 Déjà déçu par un achat"
  IMPORSAV "Q24 Importance du service client et du SAV"
  SERVATTE "Q25 Service attendu en priorité"
  DUREGARA "Q26 Durée de garantie jugée acceptable"
  CANACONT "Q27 Canal de contact préféré"
  SAVPAYPL "Q28 Un bon SAV/service vous ferait payer plus cher"
  CANAPREF "Q29 Canal préféré"
  CRITCANA "Q30 Critère de choix du canal"
  ACHELIGN "Q31 Déjà acheté en ligne"
  PRETLIGN "Q32 Prêt à acheter en ligne"
  FREINLIG "Q33 Principal frein à l'achat en ligne"
  FIDELITE "Q34 Fidèle à un même fournisseur"
  FIDEPRIX "Q35 Ce qui renforcerait votre fidélité (plusieurs réponses) - Prix/promotions"
  FIDEQUAL "Q35 Ce qui renforcerait votre fidélité (plusieurs réponses) - Qualité constante"
  FIDESTOC "Q35 Ce qui renforcerait votre fidélité (plusieurs réponses) - Disponibilité du stock"
  FIDECONS "Q35 Ce qui renforcerait votre fidélité (plusieurs réponses) - Bon conseil"
  FIDESAVF "Q35 Ce qui renforcerait votre fidélité (plusieurs réponses) - SAV fiable"
  FIDEPROG "Q35 Ce qui renforcerait votre fidélité (plusieurs réponses) - Programme de fidélité"
  FIDEPAIE "Q35 Ce qui renforcerait votre fidélité (plusieurs réponses) - Facilités de paiement"
  SUGGESTI "Q36 Suggestion / attente (facultatif)"
.

VALUE LABELS
  TYPEREPO
    1 "Particulier"
    2 "Électricien/artisan"
    3 "Entreprise BTP"
    4 "Revendeur/grossiste"
    5 "Autre"
  /
  GENRESEX
    1 "Homme"
    2 "Femme"
  /
  AGEREPON
    1 "<25"
    2 "25–34"
    3 "35–44"
    4 "45–54"
    5 "55+"
  /
  VILLEREG
    1 "Douala"
    2 "Yaoundé"
    3 "Bafoussam"
  /
  REVENUME
    1 "<100k"
    2 "100k–250k"
    3 "250k–500k"
    4 "500k–1M"
    5 ">1M"
    6 "NSP"
  /
  FREQACHA
    1 "Chaque semaine"
    2 "1–3×/mois"
    3 "Quelques fois/an"
    4 "Rarement"
  /
  LIEUACHA
    1 "Quincaillerie"
    2 "Grossiste spécialisé"
    3 "Magasin spécialisé"
    4 "Marché"
    5 "Importateur"
    6 "En ligne"
  /
  MONTACHA
    1 "<25k"
    2 "25k–100k"
    3 "100k–500k"
    4 "500k–2M"
    5 ">2M"
  /
  PAIEMENT
    1 "Espèces"
    2 "Mobile Money"
    3 "Virement"
    4 "Crédit fournisseur"
  /
  IMPOMARQ
    1 "Très importante"
    2 "Importante"
    3 "Peu importante"
    4 "Pas importante"
  /
  MARQACHA
    1 "Schneider"
    2 "Legrand"
    3 "Hager"
    4 "ABB"
    5 "Siemens"
    6 "Chint/chinoise"
    7 "Philips"
    8 "JA Solar"
    9 "Longi"
    10 "Growatt"
    11 "Autre"
  /
  CRITMARQ
    1 "Prix"
    2 "Qualité/durabilité"
    3 "Disponibilité"
    4 "Notoriété"
    5 "Garantie/SAV"
    6 "Conformité normes"
  /
  ORIGPREF
    1 "Europe"
    2 "Asie"
    3 "Amérique"
    4 "Aucune préférence"
  /
  ORIGQUAL
    1 "Europe"
    2 "Asie"
    3 "Amérique"
    4 "Sans avis"
  /
  ORIGPRIX
    1 "Europe"
    2 "Asie"
    3 "Amérique"
    4 "Sans avis"
  /
  ORIGINFL
    1 "Fortement"
    2 "Modérément"
    3 "Faiblement"
    4 "Pas du tout"
  /
  GAMMACHA
    1 "Haut de gamme"
    2 "Moyenne gamme"
    3 "Bas de gamme"
    4 "Selon le projet"
  /
  PRIORACH
    1 "Le moins cher"
    2 "Meilleur rapport qualité/prix"
    3 "Meilleure qualité quel que soit le prix"
  /
  SURCOUAC
    1 "Aucun"
    2 "Jusqu'à +10%"
    3 "+10–25%"
    4 "+25–50%"
    5 ">+50%"
  /
  FREINACH
    1 "Prix élevé"
    2 "Doute qualité/contrefaçon"
    3 "Indisponibilité"
    4 "Manque de conseil"
    5 "Absence de garantie"
    6 "Délais de livraison"
  /
  CRAICONT
    1 "Souvent"
    2 "Parfois"
    3 "Rarement"
    4 "Jamais"
  /
  DECEPTIO
    1 "Oui, plusieurs fois"
    2 "Oui, une fois"
    3 "Non"
  /
  IMPORSAV
    1 "Très importante"
    2 "Importante"
    3 "Peu importante"
    4 "Pas importante"
  /
  SERVATTE
    1 "Garantie/remplacement"
    2 "Conseil technique"
    3 "Réparation/pièces"
    4 "Réactivité du contact"
    5 "Livraison/installation"
  /
  DUREGARA
    1 "<6 mois"
    2 "6 mois–1 an"
    3 "1–2 ans"
    4 ">2 ans"
  /
  CANACONT
    1 "En personne"
    2 "Téléphone"
    3 "WhatsApp"
    4 "E-mail"
    5 "Réseaux sociaux"
  /
  SAVPAYPL
    1 "Oui"
    2 "Peut-être"
    3 "Non"
  /
  CANAPREF
    1 "Quincaillerie"
    2 "Grossiste spécialisé"
    3 "Magasin spécialisé"
    4 "Marché"
    5 "Importateur"
    6 "En ligne"
  /
  CRITCANA
    1 "Proximité"
    2 "Prix"
    3 "Largeur du choix"
    4 "Disponibilité"
    5 "Conseil"
    6 "Confiance"
  /
  ACHELIGN
    1 "Oui"
    2 "Non"
  /
  PRETLIGN
    1 "Oui"
    2 "Peut-être"
    3 "Non"
  /
  FREINLIG
    1 "Qualité/conformité"
    2 "Ne pas voir le produit"
    3 "Confiance paiement"
    4 "Livraison"
    5 "Absence de SAV"
  /
  FIDELITE
    1 "Toujours"
    2 "Souvent"
    3 "Parfois"
    4 "Rarement"
    5 "Jamais"
.

VALUE LABELS
  PRODCABL PRODAPPA PRODPRIS PRODLUMI PRODSOLA PRODGROU FIDEPRIX FIDEQUAL FIDESTOC FIDECONS FIDESAVF FIDEPROG FIDEPAIE
    0 "Non"
    1 "Oui"
.

* Valeurs manquantes déclarées (ex : Ne Sait Pas).
MISSING VALUES REVENUME (6).

EXECUTE.