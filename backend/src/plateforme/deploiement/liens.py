"""Liens personnels pré-remplis (identifiant de l'enquêteur + ville) et QR codes.

Principe : l'API REST Google Forms n'expose pas d'équivalent de `toPrefilledUrl()` (D-014, RESTE_A_FAIRE). On part
donc d'UN lien pré-rempli MODÈLE, obtenu dans Google Forms par « Obtenir le lien prérempli » en choisissant un
enquêteur et sa ville. Les paramètres `entry.N` qui portent l'identifiant et la ville (une fois par langue) sont
repérés par leur valeur, puis remplacés pour chaque enquêteur. Les autres paramètres sont conservés tels quels.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlsplit, urlunsplit

from plateforme.noyau.textes import cle


class ModeleInvalide(ValueError):
    """Le lien modèle ne contient pas l'identifiant ou la ville annoncés."""


@dataclass(frozen=True)
class ModeleLien:
    base: str                                   # URL sans la requête
    parametres: list[tuple[str, str]]
    champs_enqueteur: list[str]
    champs_ville: list[str]


def analyser_modele(url: str, enqueteur_modele: str, villes_modele: list[str]) -> ModeleLien:
    """`villes_modele` : libellés acceptés pour la ville du modèle (une langue ou plusieurs)."""
    morceaux = urlsplit(url)
    params = parse_qsl(morceaux.query, keep_blank_values=True)
    enq = [k for k, v in params if k.startswith("entry.") and v.strip().upper() == enqueteur_modele.upper()]
    cles_villes = {cle(v) for v in villes_modele}
    villes = [k for k, v in params if k.startswith("entry.") and cle(v) in cles_villes]
    if not enq:
        raise ModeleInvalide(f"aucun paramètre ne porte l'identifiant {enqueteur_modele}")
    if not villes:
        raise ModeleInvalide(f"aucun paramètre ne porte la ville ({', '.join(villes_modele)})")
    base = urlunsplit((morceaux.scheme, morceaux.netloc, morceaux.path, "", ""))
    return ModeleLien(base, params, enq, villes)


def lien(modele: ModeleLien, enqueteur: str, ville: str | None) -> str:
    """Lien de l'enquêteur ; sans ville paramétrée, les champs de ville sont retirés (l'enquêteur la choisit)."""
    parties = []
    for k, v in modele.parametres:
        if k in modele.champs_enqueteur:
            v = enqueteur
        elif k in modele.champs_ville:
            if not ville:
                continue
            v = ville
        parties.append(f"{k}={quote(v, safe='')}")
    return f"{modele.base}?{'&'.join(parties)}"


def qr_code(texte: str, chemin: str | Path) -> Path:
    import qrcode

    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    qrcode.make(texte).save(str(chemin))
    return chemin
