"""Serveur PostgreSQL temporaire pour les tests d'intégration (binaires portables, aucune installation système).

Les binaires sont cherchés dans PLATEFORME_PG_BIN, sinon dans ~/.local/outils/pgsql/bin. Un « cluster »
jetable est créé dans un dossier temporaire, démarré sur un port libre de la boucle locale, puis arrêté.
En production, PostgreSQL tourne dans Docker Compose (décision D-006) : ce module ne sert qu'aux tests.
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


def dossier_binaires() -> Path | None:
    candidats = [os.environ.get("PLATEFORME_PG_BIN", ""), str(Path.home() / ".local" / "outils" / "pgsql" / "bin")]
    for c in candidats:
        if c and (Path(c) / ("pg_ctl.exe" if os.name == "nt" else "pg_ctl")).exists():
            return Path(c)
    trouve = shutil.which("pg_ctl")
    return Path(trouve).parent if trouve else None


def _port_libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port: int = s.getsockname()[1]
        return port


@contextmanager
def serveur(dossier: Path) -> Iterator[str]:
    """Démarre un serveur jetable et renvoie l'URL SQLAlchemy de la base `plateforme`."""
    binaires = dossier_binaires()
    if binaires is None:
        raise FileNotFoundError("binaires PostgreSQL introuvables (PLATEFORME_PG_BIN ou ~/.local/outils/pgsql/bin)")
    donnees, journal, port = dossier / "donnees", dossier / "serveur.log", _port_libre()

    def lancer(*args: str, capturer: bool = True) -> None:
        # « pg_ctl start » laisse tourner postgres, qui hérite des tuyaux de sortie : les capturer bloquerait
        # subprocess.run indéfiniment (constaté sous Windows). Sa sortie va donc dans le journal du serveur.
        sortie = subprocess.PIPE if capturer else subprocess.DEVNULL
        res = subprocess.run([str(binaires / args[0]), *args[1:]], stdout=sortie, stderr=sortie, stdin=subprocess.DEVNULL,
                             check=False, timeout=120)
        if res.returncode != 0:
            detail = res.stderr.decode("utf-8", "replace")[-800:] if capturer else journal.read_text("utf-8", "replace")[-800:]
            raise RuntimeError(f"{args[0]} : {detail}")

    lancer("initdb", "-D", str(donnees), "-U", "plateforme", "-A", "trust", "-E", "UTF8", "--no-locale")
    lancer("pg_ctl", "-D", str(donnees), "-l", str(journal), "-w", "-o", f"-p {port} -c listen_addresses=127.0.0.1", "start",
           capturer=False)
    try:
        lancer("createdb", "-h", "127.0.0.1", "-p", str(port), "-U", "plateforme", "plateforme")
        yield f"postgresql+psycopg://plateforme@127.0.0.1:{port}/plateforme"
    finally:
        lancer("pg_ctl", "-D", str(donnees), "-w", "-m", "fast", "stop")
