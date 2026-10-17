"""Normalisation des libellés.

Reprend à l'identique les fonctions `norm_` et `cle_` du script V11 : deux libellés
« égaux » pour V11 doivent l'être ici, sinon la codification divergerait.
"""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache

_ESPACES = re.compile(r"\s+")
_HORS_CLE = re.compile(r"[^a-z0-9<>+%]")


def normaliser(texte: object) -> str:
    """Forme NFC, espaces multiples réduits, bords retirés (`norm_` de V11)."""
    if texte is None:
        return ""
    return _ESPACES.sub(" ", unicodedata.normalize("NFC", str(texte))).strip()


def cle(texte: object) -> str:
    """Clé de comparaison : sans accents, minuscules, uniquement lettres, chiffres et < > + % (`cle_` de V11).

    V11 retire les diacritiques U+0300 à U+036F après décomposition NFD, puis remplace « × » par « x ».
    """
    return _cle(texte if isinstance(texte, str) else "" if texte is None else str(texte))


@lru_cache(maxsize=65536)
def _cle(texte: str) -> str:
    decompose = unicodedata.normalize("NFD", normaliser(texte))
    sans_accents = "".join(c for c in decompose if not 0x300 <= ord(c) <= 0x36F)
    return _HORS_CLE.sub("", sans_accents.lower().replace("×", "x"))


def sans_accents(texte: object) -> str:
    """Texte normalisé, minuscules, sans diacritiques, espaces conservés."""
    decompose = unicodedata.normalize("NFD", normaliser(texte))
    return "".join(c for c in decompose if not 0x300 <= ord(c) <= 0x36F).lower()


_NUMERO = re.compile(r"^Q\s*(\d{1,2})\s*[.:)\-–]", re.IGNORECASE)


def numero_question(titre: object) -> int | None:
    """Numéro d'un titre « Q12. … » (`numeroQuestion_` de V11), sinon None."""
    m = _NUMERO.match(normaliser(titre))
    return int(m.group(1)) if m else None


def retirer_numero(titre: str) -> str:
    """« Q12. Marque achetée » -> « Marque achetée »."""
    return re.sub(r"^Q\s*\d{1,2}\s*[.:)\-–]\s*", "", normaliser(titre), flags=re.IGNORECASE)
