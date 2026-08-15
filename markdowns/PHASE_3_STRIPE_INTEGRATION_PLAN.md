# Phase 3 Implementation Plan: Stripe Integration in Test Mode

This plan implements the Phase 3 requirements described in [markdowns/DEVELOPER.md](DEVELOPER.md) and [markdowns/CLAUDE.md](CLAUDE.md). It is written so both the project owner and the developer/AI assistant know exactly what to build, in what order, and what success looks like.

---

## 1. Goal

Integrate Stripe test mode into the Express backend so a tenant can upgrade from Free to Pro and have the subscription state synced securely from Stripe events.

The system should:
- allow a tenant to start a Stripe Checkout session,
- verify Stripe webhook signatures,
- prevent duplicate processing of the same event,
- update the tenant subscription or plan in PostgreSQL,
- keep everything safe for local development with test keys only.

---

## 2. Scope of Phase 3

Phase 3 includes all work needed to connect billing logic to Stripe without using real money.

### In scope
- Stripe SDK setup in Node.js + Express
- Stripe test key configuration with environment variables
- Checkout session creation for upgrading a tenant
- Webhook listener for Stripe events
- Signature verification using Stripe's webhook secret
- Deduplication and idempotency for webhook processing
- Database updates for subscription and plan status
- Tests covering critical Stripe behaviors

### Out of scope for this phase
- Real payment processing
- Production Stripe credentials
- Cost calculation logic (covered in Phase 4)
- Full UI or frontend flow

---

## 3. Files likely to be changed

Use the current repo structure as the guide:

- [src/app.js](../src/app.js)
- [src/routes/billing.routes.js](../src/routes/billing.routes.js)
- [src/services/billing.service.js](../src/services/billing.service.js)
- [src/repository/billing.repository.js](../src/repository/billing.repository.js)
- [src/tests/billing.test.js](../src/tests/billing.test.js)
- [db/01-create-tables.sql](../db/01-create-tables.sql)
- [package.json](../package.json)
- [README.md](../README.md)
- [.env.example](../.env.example) (if present)

If the repo does not already contain a Stripe config file, add one in the same style as the existing app config.

---

## 4. What I need to do as the project owner

### My responsibilities
1. Confirm the tenant and subscription model already in the project.
2. Decide the upgrade flow:
   - Free -> Pro
   - optional one-time test product or subscription plan
3. Make sure I know which tenant to upgrade in local demo data.
4. Provide Stripe test keys and webhook secret in a local `.env` file.
5. Verify the app is running with Docker and PostgreSQL before testing Stripe integration.
6. Review the webhook payloads and ensure the event names match what Stripe sends in test mode.

### My checklist
- [ ] I have a Stripe test account
- [ ] I have a Stripe secret key for local development
- [ ] I have a webhook secret for local testing
- [ ] I know the tenant ID to test the upgrade flow
- [ ] I can start the app and database locally
- [ ] I can inspect Stripe webhook events in the dashboard

---

## 5. What the developer / AI assistant should implement

### Step 1: Add Stripe dependencies and config

Tasks:
- add the Stripe Node SDK to `package.json`
- update environment variables in `.env.example`
- add support for local runtime config in the app

Required env values:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` or equivalent upgrade price identifier
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

Implementation notes:
- never commit real secrets
- keep all Stripe config in local environment variables
- use test-mode keys only

---

### Step 2: Create a checkout flow for upgrade

Tasks:
- add an Express endpoint such as `POST /api/v1/checkout/create`
- look up the tenant by ID or email
- validate that the tenant exists
- create a Stripe Checkout Session for the Pro upgrade
- return the session URL or checkout object to the client

Recommended behavior:
- the route should only create a session for a valid tenant
- the upgrade should clearly map to the Pro plan
- the client can redirect the user to the Stripe-hosted checkout page

Example flow:
1. client sends tenant ID
2. backend creates Checkout Session
3. backend returns `checkoutUrl`
4. user completes Stripe test checkout
5. Stripe sends webhook events to your backend

---

### Step 3: Implement webhook route and signature verification

Tasks:
- create a webhook endpoint such as `POST /api/v1/webhooks/stripe`
- read the raw request body before JSON parsing
- use `stripe.webhooks.constructEvent` with the secret and the raw body
- reject invalid signatures with a 400 response

Critical rule:
- do not parse the request as JSON before verifying the signature
- the raw request body must be preserved for Stripe verification

Implementation notes:
- Express middleware should be configured carefully for raw body handling
- keep the webhook route separate from the JSON API routes when necessary

---

### Step 4: Handle Stripe events safely

The webhook should process these important events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

For each event:
- parse the event type
- extract the tenant or customer ID
- look up the tenant in your local database
- update the subscription status or plan in PostgreSQL
- write a clear audit record or event log if your schema supports it

Recommended mapping:
- successful checkout session => tenant becomes Pro or active subscriber
- subscription updated => reflect plan or status changes from Stripe
- subscription deleted => mark the plan as canceled/inactive

Important: the logic should use your own DB as the source of truth for the app state after the webhook is verified.

---

### Step 5: Prevent duplicate processing of the same event

This is one of the most important correctness requirements in this phase.

Tasks:
- store processed event IDs in a table or dedupe record
- before applying webhook business logic, check whether the Stripe event ID was already processed
- if the ID exists, return success without redoing work

Suggested strategy:
- create a table like `processed_stripe_events`
- columns: `event_id`, `event_type`, `processed_at`
- unique constraint on `event_id`
- wrap the processing logic in a transaction

This prevents repeated delivery attempts from creating duplicate subscription changes.

---

### Step 6: Update the database layer

Tasks:
- add or update schema for subscription and plan status in the SQL initialization file
- make sure tenant data can be updated from Stripe events
- add repository methods to:
  - find tenant by Stripe customer ID,
  - update subscription status,
  - mark plan as active/inactive,
  - record processed Stripe event IDs

Recommended database pattern:
- keep a `subscriptions` table or equivalent with fields such as:
  - `id`
  - `tenant_id`
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `plan_name`
  - `status`
  - `current_period_end`
  - `updated_at`

If the current schema already includes a variant of this, extend it instead of creating a parallel model.

---

### Step 7: Add tests before finalizing the phase

At minimum, add tests for:
- successful checkout session creation
- invalid webhook signature returns 400
- duplicate Stripe event is ignored
- checkout completion updates plan status in DB
- subscription deletion marks the tenant as inactive

Suggested test pattern:
- keep tests focused on behavior, not mocks alone
- test the real HTTP route behavior using supertest
- verify route responses and DB changes

---

## 6. Developer workflow for this phase

### Recommended order of implementation
1. Add Stripe SDK and env configuration
2. Confirm database schema supports subscription sync
3. Create the checkout route
4. Add Stripe webhook endpoint with signature validation
5. Add dedupe behavior for event IDs
6. Update tenant plan/status in the repository
7. Add tests for success and duplicate cases
8. Validate the local demo flow manually

### Safe implementation principle
Do not write the entire Stripe integration in one commit. Build in small, testable steps.

---

## 7. Acceptance criteria for Phase 3

The phase is complete when:
- a tenant can start a Stripe Checkout upgrade flow in test mode,
- webhook signatures are verified before any state change,
- duplicate Stripe events are ignored,
- tenant subscription status updates correctly in PostgreSQL,
- the system returns clear API responses for success and error states,
- relevant tests pass and explain the business behavior.

---

## 8. Demo flow for the project owner

Use this as the final demo sequence:

1. Start the app and PostgreSQL.
2. Seed a tenant in Free plan.
3. Call the checkout endpoint for that tenant.
4. Complete the Stripe test checkout using a Stripe test card.
5. Confirm the app receives a webhook.
6. Check the tenant’s updated status and plan in the database.
7. Retry the same Stripe event and confirm nothing changes.
8. Show that duplicate events do not double-apply subscription logic.

---

## 9. Success checklist

### For me
- [ ] I can explain how Stripe checkout upgrades a tenant
- [ ] I understand why webhook signature verification matters
- [ ] I understand why event deduplication is required
- [ ] I can show a successful upgrade and a duplicate event being ignored

### For the developer / AI assistant
- [ ] Stripe SDK is configured correctly
- [ ] checkout route creates a valid session
- [ ] webhook verification is implemented before processing
- [ ] Stripe event IDs are deduplicated
- [ ] tenant plan status is updated in Postgres
- [ ] tests cover core Stripe behaviors

---

## 10. Important reminders

- Use Stripe test mode only.
- Never hardcode real secrets.
- Keep the app logic simple and easy to reason about.
- Treat webhooks as untrusted input until verified.
- Focus on correctness over cleverness.

This phase is not about building a production payment platform; it is about demonstrating that you understand secure payment integration, idempotent webhooks, and subscription state synchronization.
