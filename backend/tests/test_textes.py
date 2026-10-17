"""La normalisation des libellés doit être identique à celle de V11 (sinon la codification diverge)."""

from conftest import appeler_v11

from plateforme.noyau.textes import cle, normaliser, numero_question, retirer_numero

ECHANTILLON = [
    "Électricien/artisan", "  Entreprises (PME,   Industries…) ", "1–3×/mois", "< 5 000 FCFA", "> 40 000 FCFA", "+10–25 %",
    "Jusqu'à +10 %", "L’origine (Europe, Asie, etc.)", "NSP", "Yaoundé", "Q12. Marque achetée", "élève", "",
    "Revendeur/grossiste", "55+", "Don't know", "Ça coûte ½", "ŒUVRE Æ", " espace insécable ",
]


def test_cle_identique_a_v11() -> None:
    assert [cle(x) for x in ECHANTILLON] == appeler_v11("cle_", ECHANTILLON)


def test_numero_question_identique_a_v11() -> None:
    titres = ["Q1. Vous êtes", "Q12: Marque", "Q 7) Lieu", "q42. x", "Identifiant enquêteur", "Q123. trop long", "Q5 Revenu"]
    assert [numero_question(t) for t in titres] == appeler_v11("numeroQuestion_", titres)


def test_normaliser_et_retirer_numero() -> None:
    assert normaliser("  a \n  b ") == "a b"
    assert normaliser(None) == ""
    assert retirer_numero("Q12. Marque achetée le plus souvent") == "Marque achetée le plus souvent"
    assert retirer_numero("Sans numéro") == "Sans numéro"
