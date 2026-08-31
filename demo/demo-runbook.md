# Demo Runbook — FlyRank Metering & Billing Engine

> **Before you start:** rehearse this at least twice on a fresh Docker volume. A clean reset guarantees the seed data is in the exact state described here.

---

## Prerequisites

- Docker running
- Stripe CLI installed and logged in (`stripe login`)
- `.env` file filled with your test keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`)
- Terminal 1: app + database
- Terminal 2: Stripe CLI listener
- Terminal 3: curl commands (this runbook)

---

## Step 0 — Reset & Boot (fresh state)

Run this **every time** before rehearsing or presenting:

```bash
# Terminal 1 — tear down any previous state and start fresh
docker compose down -v && docker compose up -d

# Wait ~5 seconds for Postgres to initialise, then start the app
npm run dev
```

```bash
# Terminal 2 — forward Stripe webhooks to your local server
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

Copy the `whsec_...` signing secret printed by the CLI into `STRIPE_WEBHOOK_SECRET` in your `.env` if you haven't already, then restart the app.

**Demo Tenant ID:** `d0000000-0000-0000-0000-000000000001`  
**Pre-seeded usage:** 9 700 / 10 000 tokens (300 tokens remaining)

---

## Step 1 — Billable call that hits the exact quota limit

> **Talking point:** "The tenant has 9 700 of 10 000 tokens used. I'll send exactly 300 tokens — 200 input + 100 output."

```bash
curl -s -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: d0000000-0000-0000-0000-000000000001" \
  -H "Idempotency-Key: demo-live-1" \
  -d '{"input_tokens": 200, "output_tokens": 100}' | jq
```

**Expected response (200 OK):**
```json
{
  "success": true,
  "event_id": "<uuid>",
  "tokens_used": 300
}
```

> "The request succeeds. The tenant is now exactly at the 10 000-token limit."

---

## Step 2 — Retry with the same idempotency key (no double-count)

> **Talking point:** "Now I retry the exact same request — simulating a network retry."

```bash
curl -s -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: d0000000-0000-0000-0000-000000000001" \
  -H "Idempotency-Key: demo-live-1" \
  -d '{"input_tokens": 200, "output_tokens": 100}' | jq
```

**Expected response (200 OK):**
```json
{
  "success": true,
  "event_id": "<same uuid as Step 1>",
  "tokens_used": 300,
  "idempotent_reply": true
}
```

> "Same event ID, `idempotent_reply: true`. The database still has exactly 10 000 tokens — not 10 300."

---

## Step 3 — Over-limit call returns 429

> **Talking point:** "The tenant is exactly at their limit. Any new request should be refused."

```bash
curl -s -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: d0000000-0000-0000-0000-000000000001" \
  -H "Idempotency-Key: demo-live-2" \
  -d '{"input_tokens": 1, "output_tokens": 0}' | jq
```

**Expected response (429 Too Many Requests):**
```json
{
  "error": "Quota exceeded. Upgrade your plan."
}
```

> "429 — clearly explained. The client knows exactly why and what to do: upgrade."

---

## Step 4 — Stripe upgrade: Free → Pro

> **Talking point:** "I'll trigger a Stripe Checkout to upgrade this tenant."

```bash
curl -s -X POST http://localhost:3000/api/v1/checkout/create \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "d0000000-0000-0000-0000-000000000001"}' | jq
```

**Expected response (200 OK):**
```json
{
  "id": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

1. Open the `url` in a browser.
2. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. Complete the checkout.
4. Watch Terminal 2 — the Stripe CLI shows `checkout.session.completed` forwarded and a `200` from your server.

> "The webhook fires, the signature is verified, and the tenant's plan flips from Free to Pro."

---

## Step 5 — Forged webhook is rejected (400)

> **Talking point:** "What happens if someone sends a fake Stripe event?"

```bash
curl -s -X POST http://localhost:3000/api/v1/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=1234,v1=badsignature" \
  -d '{"type": "checkout.session.completed", "data": {"object": {}}}' | jq
```

**Expected response (400 Bad Request):**
```json
{
  "error": "Invalid signature."
}
```

> "400 — rejected before any processing happens. No plan change, no data mutation."

---

## Step 6 — Duplicate real webhook event (deduplicated)

> **Talking point:** "Stripe can re-deliver the same webhook on retries. Let's replay it."

In Terminal 2, copy the event ID (e.g. `evt_1...`) from the `checkout.session.completed` line, then:

```bash
stripe events resend <evt_id_from_terminal_2>
```

Watch the app logs — the server responds:
```json
{ "received": true, "duplicate": true }
```

> "Recognised as already processed. No second plan upgrade, no data corruption."

---

## Step 7 — Usage summary after upgrade

> **Talking point:** "Now the tenant is on Pro. Let's check the usage summary."

```bash
curl -s "http://localhost:3000/api/v1/usage/summary" \
  -H "X-Tenant-Id: d0000000-0000-0000-0000-000000000001" | jq
```

**Expected response (200 OK):**
```json
{
  "plan": "pro",
  "total_tokens_used": 10000,
  "quota_limit": 1000000,
  "current_cost_cents": 0
}
```

> "Plan is `pro`, quota is 1 000 000. Usage, money, and customer access stay correct under retries, failures, and real-world conditions."

---

## Closing line

> "The database never double-counts, the quota boundary is exact, payments are signature-verified, and costs are integer math with pinned tests. That's the system."

---

## Quick reference

| Field | Value |
|---|---|
| Demo Tenant ID | `d0000000-0000-0000-0000-000000000001` |
| Plan at boot | `free` (10 000 tokens) |
| Pre-seeded usage | 9 700 tokens |
| Remaining at boot | 300 tokens |
| Step 1–2 idempotency key | `demo-live-1` |
| Step 3 idempotency key | `demo-live-2` |
