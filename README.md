# FlyRank Metering & Billing — Quick Start

A small backend service for tracking usage, metering, and testing Stripe-based billing flows in development.

## Quick start

Prerequisites:
- `docker` and `docker compose`
- Stripe CLI (for local webhook testing) — [install guide](https://docs.stripe.com/cli)

1. Copy the example env and fill in your Stripe test keys:

```bash
cp .env.example .env
# Edit .env: set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
```

2. Boot the full stack (Postgres + app):

```bash
docker compose up -d
```

The app starts at **http://localhost:3000**. The database schema and seed data (including a Demo Tenant at 97% quota) are loaded automatically.

> **That's it.** No `npm install`, no local Node.js required.

## Tests

Run the test suite against the running database:

```bash
docker compose exec app npm test
```

## Environment variables

All variables are read by `docker-compose.yml` from your `.env` file and injected into the containers. See `.env.example` for the full list with descriptions.

Required:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — database credentials
- `STRIPE_SECRET_KEY` — Stripe test key (`sk_test_...`)

Required for webhook testing:
- `STRIPE_WEBHOOK_SECRET` — from `stripe listen` output (`whsec_...`)
- `STRIPE_PRICE_ID` — a recurring price ID from your Stripe test dashboard

> `DATABASE_URL` is set automatically by docker-compose (`postgres://user:pass@postgres:5432/db`). You do not need to set it manually.

## Common commands

| Command | What it does |
|---|---|
| `docker compose up -d` | Start the full stack (build if needed) |
| `docker compose down` | Stop containers (keeps data volume) |
| `docker compose down -v` | Stop + delete database (fresh start) |
| `docker compose build --no-cache` | Rebuild the app image after code changes |
| `docker compose exec app npm test` | Run the test suite inside the container |
| `docker compose logs -f app` | Tail the app logs |

## Stripe (local testing)

Use Stripe test keys only. The easiest way to test webhooks is with the Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

Copy the `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET` in `.env`.

To simulate events locally:

```bash
stripe trigger checkout.session.completed
```

## Where to look

- Server entry: `index.js`
- App setup and routes: `src/app.js`
- Database pool: `src/db.js`
- Stripe client wrapper: `src/stripe.js`
- SQL migrations / seeds: `db/`

## Next steps

- Want a one-line script to create a `.env` for local dev? I can add it.
- Want me to run the test suite and report results?

---
Small, focused README to get contributors running quickly. Open an issue or ask for more details if you'd like expanded docs.

## Demo

See [`demo/demo-runbook.md`](demo/demo-runbook.md) for a step-by-step curl walkthrough covering:
- Billable call at the quota boundary
- Idempotent retry (no double-count)
- 429 quota exceeded
- Stripe upgrade flow (Free → Pro)
- Forged webhook rejection
- Duplicate webhook deduplication
- Usage summary after upgrade

## Submission

See [`capstone.yaml`](capstone.yaml) for the machine-readable submission manifest (run / seed / test commands, endpoints).

## Architecture

```
Client ─► POST /api/v1/generate
            └─► BillingService.recordUsage()
                  ├─ getActiveSubscription() → 402 if no active plan
                  ├─ getTotalUsage()         → 429 if quota exceeded
                  └─ insertUsageEvent()      → idempotency_key deduplicated at DB level

GET /api/v1/usage/summary
  └─► BillingService.getUsageSummary()
        ├─ getUsageBreakdown()  → { total_input_tokens, total_output_tokens }
        └─ calculateCost()      → integer cents (no floats, micro-cent arithmetic)

POST /api/v1/checkout/create  →  Stripe Checkout session (tenant metadata embedded)
POST /api/v1/webhooks/stripe  →  verify HMAC signature → deduplicate → update plan
```

## Cost Calculation

Pricing is done in **micro-cents** (integers) to eliminate floating-point rounding errors. Constants are pinned in [`src/config/pricing.js`](src/config/pricing.js):

| Token type   | Rate             |
|--------------|------------------|
| Input tokens | 1 micro-cent     |
| Output tokens| 4 micro-cents    |

Final cost formula: `floor((input × 1 + output × 4) / 1,000,000)` = **whole cents only**

## Limitations

- In-memory Stripe event deduplication — resets on server restart. A production system would persist processed event IDs to the database.
- `current_cost_cents` reflects all-time cumulative usage, not a calendar billing month (no monthly reset job exists).
- No invoicing, proration, or overage billing — out of scope per DESIGN.md §2.

