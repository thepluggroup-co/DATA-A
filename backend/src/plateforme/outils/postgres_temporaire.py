"""Serveur PostgreSQL temporaire pour les tests d'intégration (binaires portables, aucune installation système).

Les binaires sont cherchés dans PLATEFORME_PG_BIN, sinon dans ~/.local/outils/pgsql/bin. Un « cluster »
jetable est créé dans un dossier temporaire, démarré sur un port libre de la boucle locale, puis arrêté.
En production, PostgreSQL tourne dans Docker Compose (décision D-006) : ce module ne sert qu'aux tests et à la démonstration.
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import time
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
    dossier.mkdir(parents=True, exist_ok=True)
    donnees, journal, port = dossier / "donnees", dossier / "serveur.log", _port_libre()

    def lancer(*args: str, capturer: bool = True) -> None:
        # « pg_ctl start » laisse tourner postgres, qui hérite des tuyaux de sortie : les capturer bloquerait
        # subprocess.run indéfiniment (constaté sous Windows). Sa sortie va donc dans le journal du serveur.
        sortie = subprocess.PIPE if capturer else subprocess.DEVNULL
        res = subprocess.run([str(binaires / args[0]), *args[1:]], stdout=sortie, stderr=sortie, stdin=subprocess.DEVNULL,
                             check=False, timeout=120)
        if res.returncode != 0:
            if capturer and res.stderr is not None:
                detail = res.stderr.decode("utf-8", "replace")[-800:]
            else:
                try:
                    detail = journal.read_text("utf-8", "replace")[-800:]
                except OSError:
                    detail = "journal PostgreSQL indisponible; vérifiez les binaires et les droits du dossier temporaire"
            raise RuntimeError(f"{args[0]} : {detail}")

    lancer("initdb", "-D", str(donnees), "-U", "plateforme", "-A", "trust", "-E", "UTF8", "--no-locale")
    processus: subprocess.Popen[bytes] | None = None
    if os.name == "nt":
        # pg_ctl tente de créer un jeton Windows restreint, opération refusée
        # dans les environnements CI/sandbox. Le serveur postgres direct est
        # équivalent ici et permet un arrêt propre dans le finally.
        processus = subprocess.Popen(
            [str(binaires / "postgres.exe"), "-D", str(donnees), "-p", str(port), "-h", "127.0.0.1"],
            stdout=journal.open("wb"), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
        )
        for _ in range(120):
            if processus.poll() is not None:
                detail = journal.read_text("utf-8", "replace")[-800:]
                raise RuntimeError(f"postgres : {detail}")
            probe = subprocess.run([str(binaires / "pg_isready.exe"), "-h", "127.0.0.1", "-p", str(port)],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            if probe.returncode == 0:
                break
            time.sleep(0.1)
        else:
            raise RuntimeError("postgres : délai de démarrage dépassé")
    else:
        lancer("pg_ctl", "-D", str(donnees), "-l", str(journal), "-w", "-o", f"-p {port} -c listen_addresses=127.0.0.1", "start",
               capturer=False)
    try:
        lancer("createdb", "-h", "127.0.0.1", "-p", str(port), "-U", "plateforme", "plateforme")
        yield f"postgresql+psycopg://plateforme@127.0.0.1:{port}/plateforme"
    finally:
        if processus is not None:
            processus.terminate()
            try:
                processus.wait(timeout=30)
            except subprocess.TimeoutExpired:
                processus.kill()
        else:
            lancer("pg_ctl", "-D", str(donnees), "-w", "-m", "fast", "stop")


PREFIXE_DEMO = "dataa_demo_"
FICHIER_PROPRIETAIRE = "proprietaire.pid"


def processus_vivant(pid: int) -> bool:
    """Le processus existe-t-il ? Sous Windows, os.kill(pid, 0) TERMINERAIT le processus : on interroge l'API système."""
    if os.name == "nt":
        import ctypes

        noyau = ctypes.windll.kernel32
        h = noyau.OpenProcess(0x1000, False, pid)            # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        code = ctypes.c_ulong()
        try:
            return bool(noyau.GetExitCodeProcess(h, ctypes.byref(code))) and code.value == 259     # STILL_ACTIVE
        finally:
            noyau.CloseHandle(h)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def marquer_proprietaire(dossier: Path) -> None:
    """Inscrit le processus qui possède ce dossier de démonstration : tant qu'il vit, le dossier n'est pas un orphelin."""
    (dossier / FICHIER_PROPRIETAIRE).write_text(str(os.getpid()), encoding="ascii")


def arreter_orphelins(prefixe: str = PREFIXE_DEMO) -> int:
    """Arrête et supprime les serveurs jetables laissés par un processus tué brutalement (le « finally » de `serveur`
    n'a alors pas pu s'exécuter : cas d'un serveur de démonstration arrêté par Playwright). Renvoie le nombre de serveurs
    arrêtés. Ne touche qu'aux dossiers temporaires portant le préfixe donné, et JAMAIS à un dossier dont le processus
    propriétaire est encore en vie (défaut corrigé : le nettoyage de fin de tests arrêtait la démonstration en cours)."""
    import tempfile

    binaires = dossier_binaires()
    arretes = 0
    for dossier in Path(tempfile.gettempdir()).glob(f"{prefixe}*"):
        marque = dossier / FICHIER_PROPRIETAIRE
        try:
            if marque.exists() and processus_vivant(int(marque.read_text(encoding="ascii").strip())):
                continue                                      # serveur en service : surtout ne pas l'arrêter
        except (OSError, ValueError):
            pass
        donnees = dossier / "pg" / "donnees"
        if binaires is not None and (donnees / "postmaster.pid").exists():
            subprocess.run([str(binaires / "pg_ctl"), "-D", str(donnees), "-m", "immediate", "-w", "stop"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL, check=False, timeout=60)
            arretes += 1
        shutil.rmtree(dossier, ignore_errors=True)
    return arretes
