# Usage Metering & Billing Engine

A backend service every SaaS needs that tells you: 
- How much has this customer used?
- What does it cost?
- Have they hit their limit? 

Metering, quotas, correct money math, and Stripe test mode — where correctness really matters.

## Tech Stack
- **Node.js + Express**: Used for building the API endpoints. It is lightweight, widely understood, and great for building simple RESTful services.
- **PostgreSQL**: Used for relational data storage (tenants, subscriptions, usage events). Crucial for data consistency and reliable SQL math.
- **Docker**: Used to easily spin up a PostgreSQL instance without requiring manual database installations.

## Setup & Local Development

This project relies on Docker for the database and Node.js for the API. It is designed to be beginner-friendly.

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in the placeholders in `.env` if needed, though the defaults will work out-of-the-box with Docker Compose.

### 2. Run with Docker Compose (Recommended)
This will start both the PostgreSQL database and the Node.js API:
```bash
docker compose up
```

The API will be available at http://localhost:3000. 

### Database Connection Configuration
If you want to run the app outside of Docker (e.g., using `npm run dev`), make sure the Postgres container is running.
The connection is configured via the `DATABASE_URL` environment variable in your `.env` file. By default, it connects to:
`postgres://YOUR_POSTGRES_USERNAME:YOUR_POSTGRES_PASSWORD@localhost:5433/YOUR_POSTGRES_DB_NAME` (note that we expose port 5433 to the host machine in `docker-compose.yml` to avoid conflicts).

The database schema and seed data are initialized automatically from the SQL files in `db/` when PostgreSQL starts for the first time in Docker. The files are run in order (`01-create_tables.sql` first, then `02-insert_data.sql`). If you reset the Docker volume with `docker compose down -v`, the scripts will be re-run.

### 3. Run Tests
Make sure PostgreSQL is running first:
```bash
docker compose up postgres -d
```
Then run the test suite:
```bash
npm test
```

### 4. Run Locally (Alternative)
First, ensure you've started the database using Docker Compose:
```bash
docker compose up postgres -d
```
Then, install dependencies and start the app in watch mode:
```bash
npm install
npm run dev
```

## Stripe Test Mode Setup for Developers

This project uses Stripe in test mode only. Do not use a live production key or real payment data.

### Get the Stripe secret key
1. Log in to your Stripe Dashboard: https://dashboard.stripe.com/
2. Open the Developers section.
3. Click on API keys.
4. Copy the value under Secret keys. It will look like:
   ```text
   sk_test_...
   ```
5. Add it to your local `.env` file:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_key_here
   ```

### Get the webhook secret
The webhook secret is required so your app can verify that Stripe events really came from Stripe.

#### Recommended method: Stripe CLI
1. Install Stripe CLI from: https://docs.stripe.com/cli
2. Log in:
   ```bash
   stripe login
   ```
3. Start local webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
   ```
4. Stripe CLI will print a signing secret like:
   ```text
   whsec_...
   ```
5. Add it to your `.env` file:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

#### Alternative method: Stripe Dashboard
1. Go to Developers → Webhooks in the Stripe Dashboard.
2. Add a new endpoint pointing to:
   ```text
   http://localhost:3000/api/v1/webhooks/stripe
   ```
3. Select the events you want to listen for, such as:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret and save it in `.env`.

### Example `.env` values
```env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_PRICE_ID=price_your_test_price_id
```

### Create a Stripe test product and price
To test the upgrade flow, create a test product in Stripe:
1. Go to the Stripe Dashboard.
2. Open the Billing section.
3. Create a product such as `Pro Plan`.
4. Add a recurring price for that product in test mode.
5. Copy the resulting price ID, which usually looks like:
   ```text
   price_...
   ```
6. Save it in `.env`:
   ```env
   STRIPE_PRICE_ID=price_your_test_price_id
   ```

### Real-world verification with Stripe CLI

This is the recommended way to validate the Stripe flow in a real local environment. It verifies the live webhook signature, event delivery, and that your app updates subscription state.

1) Start local services

- If you run the app locally (Node on host):
```bash
docker compose up -d postgres
npm install
npm run dev
```

- If you run the app in Docker Compose (app runs in a container):

```bash
docker compose up -d postgres app
# If you change .env, rebuild/recreate the app so the container picks up new values:
docker compose up -d --build --force-recreate app
```

2) Start Stripe CLI and forward webhooks

```bash
stripe login
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

Stripe CLI prints a webhook signing secret (whsec_...). Copy it into `.env` as `STRIPE_WEBHOOK_SECRET` and restart the app/container so the new value is loaded.

3) Create a Checkout session and open Checkout

Request a new session from your app and extract the URL with `jq`:

```bash
curl -s -X POST http://localhost:3000/api/v1/checkout/create \
   -H "X-Tenant-Id: tenant_123" -H "Content-Type: application/json" \
| jq -r .checkout_url
```

Open the returned URL in a browser and complete checkout with Stripe test card `4242 4242 4242 4242` (any valid future expiry and CVC).

4) Confirm webhook delivery and processing

- Watch the Stripe CLI for the forwarded event and the app logs for processing output:
```bash
# Stripe CLI terminal shows forwarded requests
docker compose logs -f app
```

- After the webhook is processed the app should update the tenant subscription. Verify with:
```bash
curl -X GET http://localhost:3000/api/v1/usage/summary -H "X-Tenant-Id: tenant_123"
```

5) Quick smoke triggers and resends

- For a fast smoke test (no browser):
```bash
stripe trigger checkout.session.completed
```

- If an event was delivered while your database or app was down, re-send it from Stripe:
```bash
stripe events list
stripe events resend <EVENT_ID>
```

Notes
- Keep `.env` out of version control. Use Stripe test keys only.
- `STRIPE_PRICE_ID` must be a recurring `price_...` for `mode: subscription` (create via Dashboard or API).
- When you change `.env` you must restart the backend process or recreate the Docker service so the process loads the new values.
- Swagger/OpenAPI is useful for documenting endpoints, but it cannot validate real Stripe webhook signatures — use Stripe CLI for that.

