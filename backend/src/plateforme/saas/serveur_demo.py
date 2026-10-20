"""Serveur de démonstration autonome : PostgreSQL jetable, migrations, rôle applicatif soumis à la RLS, jeu fictif, API et
front-end construit. Sert aux tests de bout en bout (Playwright) et à la présentation au fondateur.

    uv run python -m plateforme.saas.serveur_demo --port 8765 --web ../web/dist
"""

from __future__ import annotations

import os

# Un serveur web n'a pas besoin du calcul matriciel multi-fils : OpenBLAS réserve des tampons par cœur et peut échouer
# sous contrainte mémoire (« Memory allocation still failed », constaté en test de bout en bout). Un fil par processus,
# fixé AVANT tout import de numpy. Même réglage à prévoir en production (variables d'environnement du conteneur).
for _variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_variable, "1")

import argparse  # noqa: E402
import tempfile  # noqa: E402
from pathlib import Path  # noqa: E402

# Respecte le répertoire temporaire fourni par Playwright (notamment sous
# Windows où le profil utilisateur peut être verrouillé par un autre processus).
_tmp_env = os.environ.get("DATAA_DEMO_TMP") or os.environ.get("TEMP") or os.environ.get("TMP")
if _tmp_env:
    Path(_tmp_env).mkdir(parents=True, exist_ok=True)
    tempfile.tempdir = _tmp_env

from sqlalchemy import text  # noqa: E402

from plateforme.outils.postgres_temporaire import PREFIXE_DEMO, arreter_orphelins, marquer_proprietaire, serveur  # noqa: E402
from plateforme.saas import demo  # noqa: E402
from plateforme.stockage.connexion import fabrique_sessions, migrer, moteur  # noqa: E402


def preparer(url_proprietaire: str, stockage: Path) -> str:
    """Migre, ouvre le rôle applicatif, sème la démo ; renvoie l'URL du rôle applicatif (soumis à la RLS)."""
    migrer(url_proprietaire)
    m = moteur(url_proprietaire)
    with m.begin() as c:
        c.execute(text("ALTER ROLE plateforme_app LOGIN"))
    with fabrique_sessions(m)() as s, s.begin():
        demo.semer(s, stockage)
    m.dispose()
    return url_proprietaire.replace("postgresql+psycopg://plateforme@", "postgresql+psycopg://plateforme_app@")


def main() -> None:
    ap = argparse.ArgumentParser(description="Serveur de démonstration DATA'A (données fictives)")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--web", default=None, help="front-end construit (web/dist)")
    ap.add_argument("--nettoyer", action="store_true", help="arrête seulement les serveurs de démonstration orphelins")
    args = ap.parse_args()
    orphelins = arreter_orphelins()                     # serveurs laissés par une exécution tuée brutalement
    if args.nettoyer:
        print(f"{orphelins} serveur(s) de démonstration orphelin(s) arrêté(s)")
        return
    with tempfile.TemporaryDirectory(prefix=PREFIXE_DEMO, ignore_cleanup_errors=True) as tmp:
        marquer_proprietaire(Path(tmp))
        lancer(args, Path(tmp))


def lancer(args: argparse.Namespace, tmp: Path) -> None:
    import uvicorn

    from plateforme.api.app import creer_app
    from plateforme.api.contexte import Config

    with serveur(tmp / "pg") as url:
        stockage = Path(tmp) / "stockage"
        url_app = preparer(url, stockage)
        cfg = Config(bd_url=url_app, stockage=stockage, web=Path(args.web).resolve() if args.web else None, cookie_securise=False,
                     tarifs_usine=demo.DEMO / "tarifs.yaml", referentiel=demo.RACINE / "reference" / "geo" / "CMR")
        print(f"DATA'A (démonstration) : http://127.0.0.1:{args.port}  — comptes : {demo.COMPTES} ; mot de passe : {demo.MDP_DEMO}",
              flush=True)
        uvicorn.run(creer_app(cfg), host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
