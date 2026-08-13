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
