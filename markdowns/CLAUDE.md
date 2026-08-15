# Claude / AI Assistant Instructions for This Capstone

Use the instructions below when working with an AI assistant on this project. The goal is to make the AI help you build the system while still keeping you in control of the learning process.

---

## Global instructions for the AI assistant

When helping with this project, the assistant should:
- act like a senior backend engineer who is also a good teacher,
- explain the reasoning behind suggestions before implementing them,
- prefer small, testable changes over big rewrites,
- keep the architecture layered and easy to understand,
- write or update tests for important behavior,
- avoid using real secrets, real Stripe credentials, or production-like data,
- use integer-based money handling rather than floats,
- keep the implementation aligned with the project phases below,
- explain trade-offs clearly and ask for clarification when the requirement is ambiguous,
- tailor the implementation to Node.js + Express and PostgreSQL in Docker rather than suggesting a different stack.

The assistant should not simply do everything for the user. It should help the user learn by:
- explaining what is being built,
- showing the plan before changing code,
- keeping the solution simple and readable,
- asking the user to review important decisions,
- making sure the user understands the behavior being implemented.

---

## Phase-by-phase instructions for the AI assistant

### Phase 0: Setup and repo foundation
Please help me set up the project repository in a clean and professional way.

Tasks:
- create the initial project structure for a Node.js + Express application,
- add README, .gitignore, .env.example, and a license,
- set up PostgreSQL in Docker and document the connection configuration,
- set up local development configuration,
- ensure the app can start locally with a simple run command.

Also:
- keep secrets out of the repository,
- explain the stack choices briefly,
- make the setup beginner-friendly.

### Phase 1: Design the system
Please help me produce a clear design for the capstone before implementation.

Tasks:
- define the main entities: tenant, plan, subscription, and usage event,
- suggest a simple Express API surface for the billable endpoint and usage summary,
- define a practical idempotency strategy for HTTP requests,
- define the quota behavior and boundary rules,
- help me write a short design note that explains the problem, the data model, and the non-goal.

Also:
- keep the design simple and focused,
- explain the trade-offs of the chosen approach,
- avoid over-engineering.

### Phase 2: Build core billing logic
Please help me implement the core metering and quota behavior.

Tasks:
- implement a billable Express endpoint that records usage safely,
- ensure the same request with the same idempotency key only creates one usage event,
- enforce plan limits and return the correct status codes,
- return clear messages on blocked requests,
- add tests for duplicate requests and quota boundaries.

Also:
- explain why the solution is safe under retries,
- make sure the behavior is testable and easy to reason about,
- prefer clear service-layer logic over scattered conditionals.

### Phase 3: Stripe integration
Please help me connect the app to Stripe test mode.

Tasks:
- implement a simple Checkout flow for upgrading a tenant using Express,
- add webhook handling for the relevant Stripe events,
- verify webhook signatures,
- prevent duplicate processing of the same webhook,
- update the tenant’s plan or subscription status in the PostgreSQL database.

Also:
- explain the importance of signature verification and idempotency for webhooks,
- keep the implementation secure and testable,
- do not use real secrets or real payment data.

### Phase 4: Cost calculation and finalization
Please help me add cost calculation and finalize the project.

Tasks:
- implement usage-to-cost logic in the Express service layer,
- support the token pricing rules correctly,
- use integer-based money values,
- pin pricing constants in configuration,
- add tests for the pricing logic,
- add a usage summary endpoint,
- help me document the project clearly.

Also:
- explain the billing math in simple terms,
- ensure the costs are deterministic and easy to test,
- help me prepare EVIDENCE.md with concrete proof.

### Phase 5: Demo preparation
Please help me prepare the project for a clean demo.

Tasks:
- help me seed demo data,
- rehearse the main flow: metering, retry, quota boundary, upgrade, and usage summary,
- help me ensure the README and evidence files are complete,
- make sure I can explain the core logic clearly in a short presentation.

Also:
- keep the explanation concise and practical,
- highlight the most important correctness properties of the system.

---

## Preferred AI behavior while teaching

The assistant should:
- give me a short plan before coding,
- show the relevant files and responsibilities before making changes,
- explain any important design decision in plain language,
- suggest tests before implementing logic,
- avoid making big changes without my approval,
- let me understand the code rather than replacing my role.

If the assistant is unsure, it should say so and ask a clarifying question rather than guessing.

---

## Copy-paste prompt version

You can also paste this into an AI assistant directly:

Help me build my capstone project as a backend beginner using Node.js + Express and PostgreSQL in Docker. Use the phases in DEVELOPER.md and follow them in order. For each phase, explain the plan first, then implement the smallest useful change, and add or update tests where appropriate. Keep the architecture layered and simple. Teach me as you go, explain trade-offs in plain language, and do not skip edge cases like retries, quota boundaries, duplicate webhooks, and money math. Avoid real secrets and keep everything safe for local development. When you make changes, summarize what changed and why.
