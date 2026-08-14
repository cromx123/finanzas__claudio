# finanzas__claudio

Implementación de Investment App 3.0 (ver el handoff de diseño en `Investment App 3.0 Design/design_handoff_fase1/README.md`).

## Estructura

```
finanzas__claudio/
├─ apps/web/         Next.js 16 (App Router) — las 5 pantallas de Fase 1
├─ services/api/     FastAPI (auth, modelo de datos, ingesta yfinance)
└─ infra/            docker-compose.yml, .env.example
```

## Frontend (`apps/web`)

Next.js 16 + TypeScript + Tailwind v4, con los tokens de diseño exactos del handoff ("Modernist": plano, radio 0, acento rojo). Implementa los 5 módulos de Fase 1 — Panel, Screener, Comparador, Dividendos, Objetivos — sobre datos mock (`lib/mock/`) servidos detrás de una capa `lib/api/` con la misma forma que tendrá el cliente REST real, así que conectar el backend más adelante no debería requerir tocar componentes. Detalle de la arquitectura del front en `apps/web/AGENTS.md` (generado por Next) y en los comentarios de `lib/api/client.ts`.

```bash
cd apps/web
pnpm install
pnpm dev       # http://localhost:3000
pnpm build && pnpm lint
```

## Backend (`services/api`)

Arrancó en el **Paso 1** del orden de implementación sugerido: infraestructura + schema + auth + ingesta yfinance con `is_stale`. Los endpoints de portfolios/holdings/screener/dividends/goals del contrato REST (ver `Architecture Blueprint.dc.html`) todavía no existen — el frontend los mockea mientras tanto.

## Correr los tests (sin Docker)

```bash
cd services/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

Los tests validan lógica pura (hash/JWT, mapa de sufijos de ticker, la regla `is_stale`, retry/backoff) y el flujo de auth completo contra una base SQLite en memoria. No requieren Postgres/Redis.

## Levantar el stack completo (requiere Docker)

```bash
cd infra
cp .env.example .env   # y ajusta los secretos
docker compose up -d postgres redis
cd ../services/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

En otra terminal, para el worker de ingesta EOD:

```bash
cd services/api
python -m app.worker
```

### Probar la regla crítica `.SN`

Con el API corriendo y al menos un activo `.SN` insertado en `assets`:

```bash
curl -X POST "http://localhost:8000/internal/refresh?symbol=SQM-B.SN" \
  -H "X-Internal-Secret: <INTERNAL_API_SECRET del .env>"
```

La respuesta trae `is_stale: true` cuando Yahoo no tiene un precio nuevo del día para ese papel y se reutilizó el último cierre conocido — el criterio de aceptación clave del Paso 1.
