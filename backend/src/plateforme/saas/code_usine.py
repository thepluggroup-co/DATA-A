"""Affiche le code de double authentification du compte usine de DÉMONSTRATION (secret public, fictif), renouvelé
toutes les 30 secondes, pour se connecter sans application d'authentification. Démonstration uniquement : un vrai compte
usine utilise son propre secret, sur le téléphone de l'opérateur.

    python -m plateforme.saas.code_usine
"""

from __future__ import annotations

import time

import pyotp

from plateforme.saas import demo


def main() -> None:
    totp = pyotp.TOTP(demo.TOTP_DEMO)
    print(f"Compte usine de démonstration : {demo.COMPTES['usine']}  —  mot de passe : {demo.MDP_DEMO}")
    print("Code de double authentification (Ctrl + C pour quitter) :")
    try:
        while True:
            reste = 30 - int(time.time()) % 30
            print(f"\r   {totp.now()}   (valable encore {reste:2d} s)   ", end="", flush=True)
            time.sleep(1)
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
