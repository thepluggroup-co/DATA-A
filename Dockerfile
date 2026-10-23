# syntax=docker/dockerfile:1
#
# DATA'A : image unique (API FastAPI + site React servi par l'API).
# À placer à la RACINE du dépôt (le contexte de build doit contenir backend/, web/ et reference/).

# ---------------------------------------------------------------- étape 1 : construire le site
FROM node:22-slim AS web
WORKDIR /web
# pnpm 9 refuse le pnpm-workspace.yaml du projet ; version testée : 12.15.0
RUN npm install -g pnpm@12.15.0
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm run build

# ---------------------------------------------------------------- étape 2 : image finale
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

# LibreOffice : conversion Word -> PDF des rapports (rendus.py). Polices : rendu correct des PDF.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-writer fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

# Disposition à conserver : le code retrouve reference/ à 5 niveaux au-dessus de rendus.py
# (/app/backend/src/plateforme/analyse/rapport/rendus.py -> /app/reference).
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
RUN uv sync --frozen --no-dev

COPY reference/ /app/reference/
COPY projets/demo_3_villes/tarifs.yaml /app/projets/demo_3_villes/tarifs.yaml
COPY --from=web /web/dist /app/web/dist

RUN mkdir -p /data

ENV PATH="/app/backend/.venv/bin:$PATH" \
    OPENBLAS_NUM_THREADS=1 \
    DATAA_WEB=/app/web/dist \
    DATAA_STOCKAGE=/data \
    DATAA_REFERENTIEL=/app/reference/geo/CMR \
    DATAA_TARIFS=/app/projets/demo_3_villes/tarifs.yaml
# DATAA_BD_URL est OBLIGATOIRE : à définir dans Railway (jamais ici).
# DATAA_TARIFS ci-dessus = tarifs de DÉMONSTRATION : à remplacer avant tout usage réel.

EXPOSE 8000

# Railway fournit $PORT. Pas de VOLUME ici (non pris en charge par Railway) : monter le volume sur /data dans Railway.
CMD ["sh", "-c", "uvicorn plateforme.api.app:application --factory --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
