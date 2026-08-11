# Developer Guide: Metering & Billing Capstone

This document is a practical roadmap for building the capstone project in a way that helps you learn backend engineering while still making steady progress. You are encouraged to use AI tools, but your goal is to understand the system deeply enough to explain it clearly in a demo or interview.

## Core goal
Build a small but correct SaaS billing backend using Node.js + Express and PostgreSQL in Docker that can:
- record usage events for a tenant,
- enforce plan quotas,
- calculate monthly cost from usage,
- sync subscription status through Stripe test-mode webhooks.

The project should feel simple, but it must be correct under retries, edge cases, and duplicate events.

---

## Working principles for this project

1. Learn as you build.
   - Do not hand off every task blindly to AI.
   - Read the code, ask questions, and make sure you can explain why a change matters.

2. Build in small steps.
   - Prefer one small feature at a time.
   - Keep the architecture layered: routes, services, persistence, tests.

3. Test the scary cases.
   - The important parts are retries, quota boundaries, duplicate webhooks, and money math.
   - If a behavior is hard to reason about, write a test for it.

4. Keep evidence as you go.
   - Record proof for each milestone in EVIDENCE.md.
   - Keep BUILDLOG.md honest about where AI helped and what you changed.

---

## Phase 0: Project setup and repo foundation

### Goal
Prepare the repository so the project is clean, runnable, and easy to demo.

### What you should do
- Create or confirm a public GitHub repository for this capstone.
- Create the initial project structure for a Node.js + Express service.
- Add a README skeleton, .gitignore, .env.example, and license.
- Set up local development tools for your chosen stack:
  - Runtime: Node.js + Express
  - Database: PostgreSQL running in Docker
  - Payments: Stripe test mode only
- Create a simple project structure such as:
  - src/app.js or src/server.js
  - src/routes/
  - src/services/
  - src/models/ or src/db/
  - src/tests/
- Create the first run command and confirm the app can start locally.
- Create the initial test folder and basic project configuration.

### Deliverables
- A runnable starter project
- A clean repo structure
- Environment variables documented in .env.example

### Learning focus
- How backend projects are organized
- Environment configuration
- Running services locally
- The importance of keeping secrets out of the repo

---

## Phase 1: Design the system

### Goal
Write a clear design before implementation so you can build the right thing.

### What you should do
- Write a short design document that covers:
  - the problem you are solving,
  - the main entities in the system,
  - the API surface,
  - the architecture layers,
  - one explicit non-goal.
- Decide on the core data model:
  - tenants
  - plans
  - subscriptions
  - usage events
- Define the plan limits for at least two plans, such as Free and Pro.
- Define the billable API contract, such as a dummy endpoint like POST /generate.
- Design how idempotency will work in Express.
  - Example: request + idempotency key should create at most one usage event.
- Decide how quota enforcement will work for boundary cases.
- Decide how the Express app will be structured:
  - route handlers for HTTP endpoints,
  - service layer for billing logic,
  - repository/database layer for persistence.

### Deliverables
- A design document or section in the repo
- A schema concept for the data model
- A clear plan for idempotency and response behavior

### Learning focus
- Designing around business rules
- Mapping real-world requirements into data models
- Thinking about edge cases before coding

---

## Phase 2: Build core billing logic

### Goal
Implement the core behavior that makes the service useful: usage recording and quota enforcement.

### What you should do
- Create the Express API endpoint that records billable usage.
- Add logic to store a usage event for the tenant in PostgreSQL.
- Implement idempotency so a retried request does not create a duplicate event.
- Enforce plan limits before allowing the action.
- Make sure response status codes are correct and meaningful:
  - 429 for usage quota exceeded
  - 402 for upgrade/payment required when needed
- Return clear error messages so the client understands why access was blocked.
- Add tests for:
  - duplicate request with the same idempotency key,
  - request within limit,
  - request at the limit,
  - request over the limit.

### Deliverables
- One billable endpoint that records usage safely
- Quota checks that refuse over-limit requests honestly
- Tests proving the duplicate and boundary behavior

### Learning focus
- Idempotency in backend systems
- Handling retries safely
- Designing clear API responses

---

## Phase 3: Integrate Stripe in test mode

### Goal
Connect subscription changes to your backend without using real money.

### What you should do
- Set up Stripe test mode and configure environment variables in your Express app.
- Implement a simple Checkout flow that allows a tenant to upgrade from Free to Pro.
- Implement webhook handling for the important Stripe events, such as:
  - checkout.session.completed
  - customer.subscription.updated
  - customer.subscription.deleted
- Verify webhook signatures.
- Prevent duplicate processing of the same event.
- Update the tenant’s plan or subscription status in your database based on verified Stripe events.

### Deliverables
- A working test-mode checkout flow
- Webhook endpoint that verifies signatures and avoids double-processing
- Tenant plan status synchronized from Stripe events

### Learning focus
- External integrations
- Webhook security and verification
- Why payment systems require idempotency and event deduplication

---

## Phase 4: Add cost calculation and finalize the system

### Goal
Make the system report usage and money accurately.

### What you should do
- Implement cost calculation for usage data in your Express service layer.
- Use integer-based money representation, not floats.
- Add pricing rules for:
  - input tokens,
  - cached input tokens,
  - output tokens,
  - reasoning tokens.
- Pin pricing constants in configuration so they are easy to test.
- Add tests for the pricing logic.
- Add a usage read endpoint so a tenant can see:
  - used amount,
  - plan limit,
  - current cost.
- Add documentation to README and the architecture diagram.
- Fill EVIDENCE.md with real proof of each completed milestone.

### Deliverables
- Correct cost rollups
- Pinned pricing tests
- Usage summary endpoint
- Clear project documentation

### Learning focus
- Money math in backend systems
- Why billing systems need careful tests
- Writing maintainable configuration and tests

---

## Phase 5: Demo preparation and polish

### Goal
Make sure the project is easy to explain and demonstrate.

### What you should do
- Seed demo data so you can show a tenant near the limit.
- Rehearse the primary demo flow:
  1. make a billable request,
  2. retry the same request with the same idempotency key,
  3. hit the quota boundary,
  4. upgrade through Stripe test mode,
  5. show the usage and cost summary.
- Make sure your README and evidence files are complete.
- Be ready to explain the most important logic in simple terms.

### Deliverables
- A polished demo flow
- Fresh evidence for the main checks
- A confident explanation of the core system

### Learning focus
- Communication skills
- Explaining technical choices clearly
- Preparing for interviews and demos

---

## Recommended workflow for a newer backend developer

Use this rhythm while working:

1. Understand the requirement.
   - Read the task carefully.
   - Ask what the expected behavior is before writing code.

2. Write or review tests first.
   - Especially for quota, idempotency, and cost.

3. Implement the smallest useful change.
   - Keep the code simple.

4. Run the tests and inspect the result.
   - Do not assume it works.

5. Explain what changed in plain language.
   - If you cannot explain it, you probably do not understand it yet.

6. Commit in small meaningful steps.
   - Keep a visible history of your learning and progress.

---

## What success looks like

You are done when:
- the core billing flow works,
- retries do not double-count usage,
- quota boundaries behave correctly,
- Stripe test-mode subscription changes are reflected,
- the cost logic is tested and documented,
- you can explain the system clearly.

If you use AI during the project, let it help you move faster, but make sure you still understand the underlying design and can explain the behavior yourself.
