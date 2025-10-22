# Sentinel Support — Multi-Agent Case Resolution

A full-stack demo for an automated case-resolution system that triages fraud/chargeback alerts using lightweight agents. It includes:

- API service (Express + Prisma + Postgres + Redis)
- Web UI (React + Vite + Tailwind)
- Local infra via Docker Compose


## Architecture

- **API** (`api/`)
  - Express server (`api/src/index.ts`) exposing REST routes under `/api/*`.
  - Prisma ORM with Postgres schema (`api/prisma/schema.prisma`).
  - Agent pipeline for triage in `api/src/lib/orchestrator.ts` calling agents in `api/src/agents/`.
  - Redis used for pub/sub style triage event hub.
- **Web** (`web/`)
  - React (Vite) single-page app with routes for dashboard, alerts, evals.
  - Talks to the API through `VITE_API_BASE`.
- **Infra**
  - `Docker-compose.yml` runs Postgres, Redis, API, and Web.


## Prerequisites

- Node.js 20+
- Docker and Docker Compose (for containerized setup)


## Quick Start (everything via Docker Compose)

```bash
# from repo root
docker compose up --build
```

- Web UI: http://localhost:5173
- API: http://localhost:3001
- Postgres: localhost:5432 (db/user/pass: `sentinel/sentinel/sentinel`)
- Redis: localhost:6379

Data is persisted in the `pgdata` volume.


## Local Development (run services natively)

You can also run DBs in Docker and the app locally for faster iteration.

1) Start Postgres and Redis only
```bash
docker compose up -d postgres redis
```

2) API setup
```bash
cd api
npm install
# generate Prisma client
npm run prisma:generate
# push schema to DB (creates tables)
DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel npm run db:push
# seed demo data (alerts, customers, txns, policies, kb, etc.)
npm run seed:all
# run API (PORT defaults to 3001)
DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel \
REDIS_URL=redis://localhost:6379 \
npm run dev
```

3) Web setup
```bash
cd web
npm install
# tell the web app where the API lives
VITE_API_BASE=http://localhost:3001 npm run dev
# Vite will serve at http://localhost:5173
```


## Environment Variables

- API
  - `DATABASE_URL` (required): e.g. `postgresql://sentinel:sentinel@localhost:5432/sentinel`
  - `REDIS_URL` (required): e.g. `redis://localhost:6379`
  - `PORT` (optional): defaults to `3001`
- Web
  - `VITE_API_BASE` (required for local dev): e.g. `http://localhost:3001`

`Docker-compose.yml` sets these appropriately for container runs.


## Data Model (Prisma)

Defined in `api/prisma/schema.prisma`:

- **Customer**: basic KYC data and relationships to cards, transactions, alerts, cases, accounts
- **Transaction**: card transactions with merchant, MCC, amount, ts, location
- **Alert**: generated alerts tied to a suspect transaction
- **Case** and **CaseEvent**: track case lifecycle and actions taken
- **KbDoc** and **Policy**: knowledge base and policy documents
- **TriageRun** and **AgentTrace**: audit trail for each triage execution

Run `npm run db:push` to apply schema and `npm run seed:all` to load demo data.


## Triage Orchestration (Agents)

Implemented in `api/src/lib/orchestrator.ts` with steps executed under timeouts and fallbacks:

- `getProfile` → `recentTx` → `riskSignals` → `kbLookup` → `decide` → `proposeAction`
- Each step records an `AgentTrace` row and emits events via a triage hub.
- Final decision persisted to `TriageRun`.

Agents live in `api/src/agents/` (e.g., `profile.ts`, `tx.ts`, `risk.ts`, `kb.ts`, `decider.ts`).


## Seeding Data

From `api/`:

```bash
# generate synthetic fixtures
npm run seed:generate
# load fixtures into DB
npm run db:seed
# all-in-one
npm run seed:all
# generate very large transaction set	npm run seed:large
```

Fixture scripts are under `fixtures/scripts/`, and JSON data under `fixtures/`.


## Useful Scripts

- **API** (`api/package.json`)
  - `dev`: run Express with tsx watcher
  - `prisma:generate`: generate Prisma client
  - `db:push`: apply schema to DB
  - `seed:generate`, `db:seed`, `seed:all`, `seed:large`
- **Web** (`web/package.json`)
  - `dev`: start Vite dev server (5173)
  - `build`: type-check and build
  - `preview`: preview the production build


## Project Structure

```
multi-agent-case-resolution/
├─ api/
│  ├─ src/
│  │  ├─ agents/
│  │  ├─ lib/
│  │  └─ router/
│  ├─ prisma/
│  ├─ fixtures/
│  ├─ Dockerfile
│  └─ package.json
├─ web/
│  ├─ src/
│  │  ├─ pages/
│  │  └─ components/
│  ├─ Dockerfile
│  └─ package.json
├─ Docker-compose.yml
└─ README.md
```


## Architecture Decisions (ADR)

- **Keyset pagination for alerts**: `GET /api/alerts` uses simple id-desc keyset pagination (`cursor=lastId`, `lt` filter) to keep queries fast and stable under inserts, avoiding OFFSET scalability issues. See `api/src/router/alerts.ts`.
- **SSE for triage streaming**: Live triage updates are delivered via Server-Sent Events at `GET /api/triage/:runId/stream`, which offers simple one-way streaming over HTTP with broad browser support and low server overhead. See `api/src/router/triage.ts`.
- **Event hub with replay**: `api/src/lib/triageHub.ts` keeps per-run history and an `EventEmitter` so new SSE clients receive prior events before subscribing, ensuring deterministic UI state after reconnects.
- **Prisma schema with practical indexes**: Composite and single-field indexes (e.g., `idx_tx_customer_ts`, `idx_tx_customer_merchant`) support common read patterns (customer timelines, merchant lookups). See `api/prisma/schema.prisma`.
- **Strict decision surface**: `api/src/agents/decider.ts` constrains decisions with literal unions for `recommended` and `risk`, reducing downstream branching errors and enabling exhaustiveness checks.
- **Time-bounded orchestration**: `executeTriagePlan()` caps step duration (`MAX_STEP_TIME_MS`) and records fallbacks to keep end-to-end latency predictable and observable via `AgentTrace`.
- **Redis optionality for rate limiting**: Triage start endpoint relies on Redis when available, but degrades gracefully (does not block) if Redis is down to favor operability during partial outages.
- **Vite dev server for DX**: The web app uses Vite for instant HMR and TypeScript build separation; the API origin is configured via `VITE_API_BASE` to keep environments decoupled.
- **Docker Compose as default dev infra**: Local stack (Postgres, Redis, API, Web) is standardized with Compose for consistent onboarding and reproducible environments.
- **PII redaction at trace boundaries**: Traces pass through `redactPII` before persistence to reduce sensitive data retention in observability tables while maintaining useful debugging detail.

