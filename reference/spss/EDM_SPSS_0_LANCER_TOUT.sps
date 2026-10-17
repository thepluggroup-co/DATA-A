* Encoding: UTF-8.
* ==========================================================================.
* EDM ÉLECTRIQUE CAMEROUN — THE PLUG.
* SCRIPT 0 : LANCEUR AUTOMATIQUE (le SEUL fichier à ouvrir et exécuter).
*
* CE QU'IL FAIT, SANS RIEN À MODIFIER :
*   1. Cherche le fichier « …EXPORT_SPSS….csv » le plus récent dans C:\ETUDE_EDM
*      ET dans votre dossier Téléchargements, et le copie en C:\ETUDE_EDM\EXPORT_SPSS.csv.
*   2. Vérifie qu'il a bien les 67 colonnes attendues, dans le bon ordre (sinon : arrêt,
*      avec le nom de la première colonne fautive).
*   3. Lance le script 1 (base .sav étiquetée) ; s'il échoue : arrêt.
*   4. Lance le script 2 (analyses + export Excel).
*   5. Enregistre toute la fenêtre de résultats dans C:\ETUDE_EDM\RESULTATS_EDM_ELECTRIQUE.spv.
*
* Les 3 scripts .sps doivent être dans C:\ETUDE_EDM.
* Lancement : menu Exécuter > Tout.
* ==========================================================================.

BEGIN PROGRAM PYTHON3.
import spss, os, glob, shutil, csv, time

DOSSIER = r"C:\ETUDE_EDM"
CIBLE = os.path.join(DOSSIER, "EXPORT_SPSS.csv")
ATTENDU = """
NUMFICHE CODEENQU CODEZONE QUARTIER SITEENQU DATEENQU HEUREENQ DELAIPRE
ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG REVMENME FREQACHA LIEACHPR
MONMOYAC PRACCABL PRACAPPA PRACPRIS PRACLUMI PRACSOLA PRACGROU PAIEPRIV
IMPOMARQ MAACPLSO MAACAUTR PRCRICHO ORIGPRIV MEQUAFIA MEILPRIX ORINFACH
GAACPLSO DEAVHAGA CAAVBAGA ORASHAGA ORASBAGA PXHAUTGA PXMOYEGA PXBASGAM
ECQUHABA PRIOPRIN SUACMOGA PRINFREI CRACPRCO DEJDECAC IMSECSAV SEATPRIO
DUGAJUAC CACOPREF BOSAPACH CANAPREF CRCHCANA DEJACHLI PRETACLI PRFRACLI
FIMEFOUR RFIDPRIX RFIDQUAL RFIDSTOC RFIDCONS RFIDSAVF RFIDPROG RFIDPAIE
SUGGATTE ANOMALIE STATUTQC
""".split()

def stop(msg):
    print("")
    print("########## ARRÊT ##########")
    print(msg)
    print("###########################")
    raise RuntimeError("Lanceur arrêté : voir le message ARRÊT ci-dessus.")

# ---- 1. Trouver le CSV le plus récent ----
lieux = [DOSSIER, os.path.join(os.environ.get("USERPROFILE", ""), "Downloads"),
         os.path.join(os.environ.get("USERPROFILE", ""), "Téléchargements")]
candidats = []
for d in lieux:
    if os.path.isdir(d):
        candidats += glob.glob(os.path.join(d, "*EXPORT_SPSS*.csv"))
if not candidats:
    stop("Aucun fichier « …EXPORT_SPSS….csv » trouvé dans C:\\ETUDE_EDM ni dans Téléchargements.\n"
         "Google Sheet : onglet EXPORT_SPSS > Fichier > Télécharger > Valeurs séparées par des virgules (.csv).")
source = max(candidats, key=os.path.getmtime)
age_h = (time.time() - os.path.getmtime(source)) / 3600.0
if os.path.abspath(source).lower() != os.path.abspath(CIBLE).lower():
    shutil.copyfile(source, CIBLE)
print("Fichier utilisé : " + source)
print("Téléchargé il y a %.1f heure(s)." % age_h)
if age_h > 24:
    print("ATTENTION : fichier de plus de 24 h. Si le terrain continue, relancez exporterPourSPSS() et retéléchargez.")

# ---- 2. Vérifier les colonnes ----
with open(CIBLE, encoding="utf-8-sig", newline="") as f:
    lignes = list(csv.reader(f))
if not lignes:
    stop("Le fichier CSV est vide.")
entete = [x.strip() for x in lignes[0]]
if len(lignes[0]) == 1 and ";" in lignes[0][0]:
    stop("Le CSV utilise des points-virgules : il a été ouvert puis ré-enregistré dans Excel.\n"
         "Retéléchargez-le depuis Google Sheets et ne l'ouvrez PAS dans Excel.")
if entete != ATTENDU:
    k = next((i for i in range(max(len(entete), len(ATTENDU)))
              if i >= len(entete) or i >= len(ATTENDU) or entete[i] != ATTENDU[i]), None)
    trouve = entete[k] if k is not None and k < len(entete) else "(absente)"
    prevu = ATTENDU[k] if k is not None and k < len(ATTENDU) else "(aucune)"
    stop("Colonnes non conformes : %d trouvées / %d attendues.\n"
         "Première différence en colonne %d : trouvé « %s », attendu « %s ».\n"
         "Vérifiez que migrerV3_etape1 a bien été exécutée, puis relancez exporterPourSPSS()."
         % (len(entete), len(ATTENDU), (k or 0) + 1, trouve, prevu))
n = sum(1 for l in lignes[1:] if l and l[0].strip())
print("Colonnes : conformes (%d). Fiches dans le fichier : %d." % (len(ATTENDU), n))
if n < 30:
    print("ATTENTION : moins de 30 fiches, les tests statistiques ne seront pas interprétables.")

# ---- 3 et 4. Scripts 1 puis 2 ----
def lancer(nom, bloquant):
    chemin = os.path.join(DOSSIER, nom)
    if not os.path.isfile(chemin):
        stop("Script introuvable : " + chemin)
    try:
        spss.Submit("INSERT FILE='%s' SYNTAX=INTERACTIVE ERROR=CONTINUE CD=NO ENCODING='UTF8'." % chemin)
        print(nom + " : terminé.")
    except Exception as e:
        if bloquant:
            stop(nom + " a rencontré une erreur (voir le message rouge ci-dessus). Analyses non lancées.")
        print(nom + " : terminé avec des avertissements (souvent : option Categories ou Custom Tables absente de la licence).")

lancer("EDM_SPSS_1_PARAMETRAGE_V3.sps", True)
lancer("EDM_SPSS_2_ANALYSES_V3.sps", False)

# ---- 5. Sauvegarde de la sortie ----
spss.Submit("OUTPUT SAVE OUTFILE='%s'." % os.path.join(DOSSIER, "RESULTATS_EDM_ELECTRIQUE.spv"))
print("")
print("TERMINÉ : C:\\ETUDE_EDM\\EDM_ELECTRIQUE_CAMEROUN.sav, RESULTATS_EDM_ELECTRIQUE.xlsx et .spv")
END PROGRAM.
