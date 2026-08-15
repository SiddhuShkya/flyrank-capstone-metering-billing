# FlyRank Metering & Billing — Quick Start

A small backend service for tracking usage, metering, and testing Stripe-based billing flows in development.

## Quick start

Prerequisites:
- `node` (v18+ recommended)
- `npm`
- `docker` and `docker-compose` (for local Postgres)

1. Copy the example env and edit as needed:

```bash
cp .env.example .env
```

2. Start the database (recommended):

```bash
docker compose up -d postgres
```

3. Install dependencies and run the app locally:

```bash
npm install
npm run dev
```

The app listens on `http://localhost:3000` by default.

## Tests

Ensure Postgres is running, then:

```bash
npm test
```

## Important environment variables

Required (set in your `.env`):
- `DATABASE_URL` or the Postgres pieces: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `STRIPE_SECRET_KEY` (test key, `sk_test_...`)

Optional for webhook testing:
- `STRIPE_WEBHOOK_SECRET` (from Stripe CLI or Dashboard)
- `STRIPE_PRICE_ID` (a recurring price id for subscription tests)

The project reads Postgres config from `DATABASE_URL` if present; otherwise you can set the `POSTGRES_*` variables used by the local Docker compose file.

## Common commands

- Start app: `npm start`
- Dev with watch: `npm run dev`
- Run tests: `npm test`
- Bring up full stack (build): `npm run docker:up` (uses `docker compose`)
- Stop and remove volumes: `npm run docker:down:v`

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

