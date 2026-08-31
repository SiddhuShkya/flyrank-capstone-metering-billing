# Phase 5: Demo Preparation & Polish

Phases 0–4 are fully complete with 17 passing tests across 2 suites. Phase 5 is the final milestone — its goal is to make the project easy to **explain, demonstrate, and submit**. No new business logic is added; instead we polish the demo flow, seed realistic data, fill any documentation gaps, and produce the `capstone.yaml` submission manifest required by the evaluator.

---

## What Phase 5 Accomplishes

| Area | Goal |
|---|---|
| Demo data | Seed a "near-limit" tenant so the quota boundary fires on the **second** curl call |
| Demo script | A step-by-step curl runbook covering all 5 demo moments from §13 |
| README | Tighten setup steps so a stranger can clone + run in < 5 min |
| `capstone.yaml` | The machine-readable submission manifest required by §11 |
| EVIDENCE.md | Add Phase 5 live proof (curl transcripts, test screenshot) |
| BUILDLOG.md | Add Phase 5 entry |

> [!IMPORTANT]
> **No breaking changes to existing code.** Phase 5 is documentation, seeding, and scripting only. All 17 tests must stay green throughout.

---

## Open Questions

> [!IMPORTANT]
> **Cached-input & reasoning tokens** — TASK.md §6 (Cost Calculation) and Probe 5 say pricing must handle *cached input tokens* and *reasoning tokens* separately. The current `src/config/pricing.js` (or `chat-pricing.js`) only has `INPUT_TOKEN_MICRO_CENTS` and `OUTPUT_TOKEN_MICRO_CENTS`. Before the demo, we should confirm:
> - Are cached-input and reasoning-token pricing constants already defined in the config?
> - Should the usage summary endpoint surface them, or is it sufficient that the config has the constants and the tests pin them?
>
> **This is a quick check — not a Phase 4 redo.** If the constants exist but were not surfaced in earlier tests, we add a pinned test now. If they are missing entirely, we add them to the config and a test to keep PROBE 5 safe.

---

## Proposed Changes

### Component 1 — Demo Seed Data

#### [MODIFY] [02-insert-data.sql](file:///home/siddhu/Desktop/FlyRankAI-Internship/Capstone%20Project/flyrank-capstone-metering-billing/db/02-insert-data.sql)

Add a third tenant `"Demo Tenant"` on the **Free plan** (10 000 token quota) with pre-inserted usage events totalling **9 700 tokens** — just 300 tokens under the limit. This means:
- First demo call (300 tokens) → hits the exact limit ✅
- Second demo call → 429 Quota Exceeded ✅

The existing Acme Corp and Startup Inc rows are preserved with `ON CONFLICT DO NOTHING`.

```sql
-- Demo tenant — near quota, used for live demo flow
INSERT INTO tenants (id, name, created_at)
VALUES ('d0000000-0000-0000-0000-000000000001', 'Demo Tenant', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (id, tenant_id, plan_id, status, stripe_customer_id, stripe_subscription_id, created_at)
VALUES ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'free', 'active', 'cus_demo', 'sub_demo', NOW())
ON CONFLICT (id) DO NOTHING;

-- Pre-load 9700 tokens (97% of 10 000 limit) across 3 usage events
INSERT INTO usage_events (id, tenant_id, idempotency_key, input_tokens, output_tokens, created_at)
VALUES
  ('d0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000001', 'demo-seed-1', 3000, 1000, NOW()),
  ('d0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001', 'demo-seed-2', 2500, 1200, NOW()),
  ('d0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000001', 'demo-seed-3', 1500, 500,  NOW())
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
```

> [!NOTE]
> Seeded usage = 3000+1000 + 2500+1200 + 1500+500 = **9 700 tokens**. Free plan limit = 10 000. Remaining = 300.

---

### Component 2 — Demo Runbook Script

#### [NEW] [demo/demo-runbook.md](file:///home/siddhu/Desktop/FlyRankAI-Internship/Capstone%20Project/flyrank-capstone-metering-billing/demo/demo-runbook.md)

A step-by-step curl script that mirrors the §13 demo flow exactly. Each step includes the expected response so you know it's working before you go live. Sections:

1. **Reset & boot** — `docker compose down -v && docker compose up -d`
2. **Step 1 — Billable call at the boundary** — POST /generate with 300 tokens → 200 OK
3. **Step 2 — Retry with same idempotency key** — same curl → `idempotent_reply: true`, no double-count
4. **Step 3 — Over-limit call** — POST /generate with 1 token → 429 Quota Exceeded
5. **Step 4 — Stripe upgrade** — POST /checkout/create → visit URL → test card 4242 → checkout.session.completed webhook fires → plan flips to Pro
6. **Step 5 — Forged webhook** — curl with bad `Stripe-Signature` → 400
7. **Step 6 — Duplicate real webhook replay** — `stripe trigger checkout.session.completed --override…` sent twice → second reply is `duplicate: true`
8. **Step 7 — Usage summary after upgrade** — GET /usage → new Pro limit, cost shown

---

### Component 3 — `capstone.yaml` (required by §11)

#### [NEW] [capstone.yaml](file:///home/siddhu/Desktop/FlyRankAI-Internship/Capstone%20Project/flyrank-capstone-metering-billing/capstone.yaml)

Machine-readable submission manifest. Required by the evaluator — currently missing from the repo.

```yaml
run: docker compose up -d
seed: docker compose exec postgres psql -U postgres -d billing -f /docker-entrypoint-initdb.d/02-insert-data.sql
test: npm test
base_url: http://localhost:3000
endpoints:
  - POST /api/v1/generate
  - GET  /api/v1/usage/summary
  - POST /api/v1/checkout/create
  - POST /api/v1/webhooks/stripe
```

---

### Component 4 — README Polish

#### [MODIFY] [README.md](file:///home/siddhu/Desktop/FlyRankAI-Internship/Capstone%20Project/flyrank-capstone-metering-billing/README.md)

Current README is good but has two gaps that §11 flags:

1. **No explicit seed step** — Add a "Seed demo data" section showing the `docker compose` command a stranger would run.
2. **Next Steps section is incomplete** — Replace placeholder bullet with a pointer to `demo/demo-runbook.md`.
3. **Minor**: Add a note pointing to `capstone.yaml` for evaluators.

No structural changes — just filling the gaps.

---

### Component 5 — EVIDENCE.md Phase 5 Entry

#### [MODIFY] [EVIDENCE.md](file:///home/siddhu/Desktop/FlyRankAI-Internship/Capstone%20Project/flyrank-capstone-metering-billing/EVIDENCE.md)

Add a new **§6 — Phase 5 Demo Flow** section with:
- A live curl transcript showing the quota boundary hit (200 → 200 idempotent → 429)
- A live curl transcript showing the forged-webhook 400
- A screenshot of `npm test` output (all 17 passing) taken after the Phase 5 seed changes

This gives the evaluator "fresh evidence for the main checks" as required by §5's deliverables.

---

### Component 6 — BUILDLOG.md Phase 5 Entry

#### [MODIFY] [BUILDLOG.md](file:///home/siddhu/Desktop/FlyRankAI-Internship/Capstone%20Project/flyrank-capstone-metering-billing/BUILDLOG.md)

Add a Phase 5 section following the established format:
- Status: Completed
- What was done
- AI Collaboration Notes
- Verification Evidence

---

### Component 7 (conditional) — Pricing Config Check

#### [MODIFY] [src/config/pricing.js or chat-pricing.js](file:///home/siddhu/Desktop/FlyRankAI-Internship/Capstone%20Project/flyrank-capstone-metering-billing/src/config)

> [!WARNING]
> TASK.md §6 and PROBE 5 require that **cached input tokens** and **reasoning tokens** are priced separately. If the current config is missing these constants, we add them now — before submitting. This is a 3-line config change + 2 test cases. We will check the file first and only modify if needed.

If constants exist: no change needed.  
If constants are missing: add `CACHED_INPUT_TOKEN_MICRO_CENTS` and `REASONING_TOKEN_MICRO_CENTS`, plus 2 pinned tests in `chat-pricing.test.js`.

---

## Verification Plan

### Automated Tests
```bash
# Must stay green throughout
npm test
```
Expected: 2 suites, 17+ tests, 0 failures.

### Manual Verification (Demo Dress Rehearsal)
Run through `demo/demo-runbook.md` top to bottom — twice — against a **fresh Docker volume**:
```bash
docker compose down -v && docker compose up -d
# then follow demo-runbook.md curl steps
```

Confirm each step's actual response matches the expected response in the runbook.

### Submission Pack Check
```bash
# All 5 required files must exist
ls README.md capstone.yaml EVIDENCE.md BUILDLOG.md .env.example
```

---

## Execution Order

1. Check pricing config constants (Component 7) — 10 min
2. Modify seed SQL (Component 1) — 10 min
3. Create demo runbook (Component 2) — 20 min
4. Create `capstone.yaml` (Component 3) — 5 min
5. Polish README (Component 4) — 10 min
6. Run full test suite to confirm green ✅
7. Add EVIDENCE.md Phase 5 entry with live curl output (Component 5) — 15 min
8. Add BUILDLOG.md Phase 5 entry (Component 6) — 5 min
9. Final dress rehearsal with fresh volume — 15 min
