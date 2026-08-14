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
- Created the initial system design document (`DESIGN.md`).
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

**AI Collaboration Notes:**
- **How AI helped:** The AI implemented the compact service/repository structure, wired the routes, and tested the duplicate-and-limit behavior against the database-backed API.
- **What was refined:** I asked for careful checks around the quota boundary logic and for the exact API contract expected by the project task. The AI adjusted the implementation to return the correct error statuses and maintain clear request semantics.
- **My understanding:** The main correctness rule in Phase 2 is simple but critical: a request plus the same idempotency key must result in exactly one usage event. This protects the system from accidental double-charging during retries while still enforcing plan limits cleanly.

**Verification Evidence:**
- Ran the database initialization and Jest suite in the Dockerized app container:
  - `docker compose run --rm app sh -lc 'node scripts/init_db.js && npm test -- --runInBand'`
- Result: `PASS` — 1 suite passed, 6 tests passed, 0 failed.
- The authenticated checks covered:
  - within-limit request succeeds,
  - duplicate idempotent request succeeds without creating a second event,
  - over-limit request returns `429`,
  - exactly-at-limit behavior is enforced correctly,
  - summary endpoint reports total used and quota limit.
