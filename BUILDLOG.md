# Build Log: Usage Metering & Billing Engine

This document tracks the progress of the Capstone Project and honestly details the collaboration with the AI assistant.

## Phase 0: Project setup and repo foundation

**Status:** Completed

**What was done:**
- Set up the repository foundation.
- Configured local development tools including Node.js, Express, and PostgreSQL via Docker (`docker-compose.yml`).
- Added standard boilerplate files: `.gitignore`, `.env.example`, `LICENSE`, and `README.md`.
- Created the initial source directory structure (`src/`).

**AI Collaboration Notes:**
- **How AI helped:** The AI verified the initial structure and identified the pre-existing foundational files.
- **My understanding:** I have a clean, runnable environment with Docker and Node.js. Secrets are securely managed via `.env` (git-ignored), and the project structure is ready for Phase 1 and beyond.

## Phase 1: Design

**Status:** Completed

**What was done:**
- Created the initial system design document (`markdowns/DESIGN.md`).
- Defined the core data model with four main entities: `tenants`, `plans`, `subscriptions`, and `usage_events`, including sample data.
- Established the metering API contract for `POST /api/v1/generate` and `GET /api/v1/usage/summary`.
- Clarified the idempotency strategy using a unique database constraint on `(tenant_id, idempotency_key)` to safely handle network retries without double-counting.
- Defined boundary quota logic and the appropriate HTTP status codes (`429` for rate limits and `402` for payment issues).

**AI Collaboration Notes:**
- **How AI helped:** The AI assistant drafted the initial `DESIGN.md` based on the requirements found in `DEVELOPER.md` and `TASK.md`. It structured the document into clear architectural layers and provided the base logic for handling quotas and idempotency.
- **What was refined:** I noticed the initial design was a bit abstract, so I directed the AI to explicitly write out the database schema, add concrete examples with sample data tables, and formalize the JSON API payloads. The AI updated the document to include these specifics.
- **My understanding:** By driving the AI to be more explicit with the schema and API contract, I ensured we have a concrete blueprint for Phase 2. I understand that the PostgreSQL unique constraint is the critical mechanism that will prevent duplicate usage events from being inserted during a network retry.

## Phase 2: Core billing logic

**Status:** Completed

**What was done:**
- Implemented the billable API at `POST /api/v1/generate` to accept `X-Tenant-Id`, `Idempotency-Key`, `input_tokens`, and `output_tokens`.
- Added a repository layer for subscription lookup, usage aggregation, usage insertion, and lookup by idempotency key.
- Added service-level quota enforcement so requests that exceed a tenant’s current plan limit are blocked with `429`.
- Enforced idempotency using PostgreSQL’s unique constraint on `(tenant_id, idempotency_key)` so the same request can safely be retried without double-counting usage.
- Added a usage summary endpoint at `GET /api/v1/usage/summary`.
- Added tests covering duplicate retries, quota boundaries, and summary behavior.
- Switched the database bootstrap to SQL files under `db/`, using numbered init scripts so schema creation and seed data run in a controlled order during container startup.
- Verified the Docker startup flow by resetting the postgres volume and confirming the app connects only after PostgreSQL is healthy.

**AI Collaboration Notes:**
- **How AI helped:** The AI implemented the compact service/repository structure, wired the routes, and tested the duplicate-and-limit behavior against the database-backed API. It also helped debug the database bootstrap flow by separating schema creation from seed data and adjusting the Docker startup pattern to match Postgres best practices.
- **What was refined:** I asked for careful checks around the quota boundary logic, the exact API contract expected by the project task, and the Docker initialization flow. The AI adjusted the setup to avoid redundant runtime database creation logic and kept the real initialization responsibilities in Postgres startup instead of app code.
- **My understanding:** The main correctness rule in Phase 2 is simple but critical: a request plus the same idempotency key must result in exactly one usage event. This protects the system from accidental double-charging during retries while still enforcing plan limits cleanly. I also learned that a database volume can mask earlier bootstrap mistakes, so a clean `docker compose down -v` followed by a fresh `docker compose up` is the reliable way to validate the schema and seed flow.

**Verification Evidence:**
- Ran the database initialization and Jest suite in the Dockerized app container:
  - `docker compose run --rm app sh -lc 'npm test -- --runInBand'`
- Result: `PASS` — 1 suite passed, 6 tests passed, 0 failed.
- The authenticated checks covered:
  - within-limit request succeeds,
  - duplicate idempotent request succeeds without creating a second event,
  - over-limit request returns `429`,
  - exactly-at-limit behavior is enforced correctly,
  - summary endpoint reports total used and quota limit.

## Phase 3: Stripe subscription checkout and webhook flow

**Status:** Completed

**What was done:**
- Added Stripe integration with `stripe` SDK support and local environment configuration for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_SUCCESS_URL`, and `STRIPE_CANCEL_URL`.
- Implemented a checkout endpoint at `POST /api/v1/checkout/create` that creates a Stripe Checkout Session for the active tenant and returns the session URL.
- Implemented a webhook endpoint at `POST /api/v1/webhooks/stripe` that validates the Stripe signature using the raw request body before JSON parsing.
- Added webhook processing for `checkout.session.completed` to map the tenant, customer, and subscription information to the project’s existing subscription model.
- Updated the billing service to enforce the original project design: no new `processed_stripe_events` table was added, and duplicate webhook events are ignored using an in-memory dedupe set instead of a separate database table.
- Added and verified tests for:
  - successful Stripe checkout session creation,
  - invalid webhook signature rejection,
  - duplicate webhook event handling,
  - quota and usage behavior continuing to work correctly alongside Stripe updates.
- Kept the implementation aligned with the original capstone architecture rather than introducing schema drift.

**AI Collaboration Notes:**
- **How AI helped:** The AI set up the Stripe checkout flow, connected the webhook verification logic to the existing Express app, and ensured the raw-body requirement for Stripe signatures was respected without breaking the rest of the JSON API.
- **What was refined:** I specifically rejected the idea of adding a new `processed_stripe_events` table because it did not match the system design. The AI adjusted the implementation to use the existing subscription and usage model and kept deduplication lightweight and local to the service layer.
- **My understanding:** Phase 3 is not just about creating a payment session; the real correctness requirement is secure webhook handling and proper subscription state alignment without adding unnecessary persistence. The webhook must be signature-verified and idempotent, and the app should continue to respect the tenant quota logic in the same way it did before Stripe was introduced.

**Verification Evidence:**
- Ran the final verification command after the design correction:
  - `docker compose up -d postgres && npm test -- --runInBand`
- Result: `PASS` — 1 suite passed, 9 tests passed, 0 failed.
- The checks covered both the original billing logic and the Stripe checkout/webhook flow, confirming the app is stable in the current design without the extra processed-events table.

## Phase 4: Cost calculation and finalization

**Status:** Completed

**What was done:**
- Implemented the token pricing logic in `src/services/billing.service.js` using integer-based arithmetic in micro-cents to prevent floating-point rounding errors.
- Added pricing constants to a dedicated configuration file `src/config/pricing.js` to enforce decoupling.
- Scoped the implementation to a clean 2-column token design (Input and Output tokens) to match the original database schema in `DESIGN.md` and avoid unnecessary DB schema migration.
- Implemented `getUsageBreakdown()` in `src/repository/billing.repository.js` to fetch input and output token counts separately so they can be priced at different rates.
- Wired the cost calculation into the `getUsageSummary` service method and summary API response, replacing the placeholder `0` value.
- Added a dedicated unit test suite `src/tests/pricing.test.js` with 8 pinned tests covering standard input, output, combined pricing, integer rounding/flooring, and constant pinning.
- Updated the existing integration test suite `src/tests/billing.test.js` to verify that `current_cost_cents` is returned as a valid non-negative integer.
- Confirmed all 17 tests are passing successfully in local development.

**AI Collaboration Notes:**
- **How AI helped:** The AI assistant provided a detailed implementation plan and code snippets for Option A (2-column design matching `DESIGN.md` without schema changes). It also helped debug a failing test case in `pricing.test.js` where using 1,000 tokens for input and output both rounded down to 0 cents, causing a test assertion failure. The AI corrected the test inputs to 1,000,000 tokens to ensure the prices survived the integer division division check.
- **My understanding:** Storing currency as integers (micro-cents) is standard practice in billing engineering. Floating-point division must only happen at the final presentation boundary, and using standard `Math.floor()` ensures sub-cent remainders are truncated safely. By keeping the design constrained to `input_tokens` and `output_tokens`, we successfully completed Phase 4 without introducing database schema drift.

**Verification Evidence:**
- Ran clean container initialization and test suite:
  - `docker compose down -v && docker compose up -d && npm test`
- Result: `PASS` — 2 test suites passed, 17 tests passed total.
- All unit tests for money calculation and integration tests for route boundaries are green.
