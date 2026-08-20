# Routes

<filename>
src/routes/billing.routes.js
</filename>

---

<codeblock1>

```javascript
router.post('/generate', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const idempotencyKey = req.headers['idempotency-key'];

        if (!tenantId || !idempotencyKey) {
            return res.status(400).json({
                error: 'Missing required headers: X-Tenant-Id or Idempotency-Key'
            });
        }

        const { input_tokens, output_tokens } = req.body;

        if (typeof input_tokens !== 'number' || typeof output_tokens !== 'number') {
            return res.status(400).json({
                error: 'Invalid request body: input_tokens and output_tokens must be numbers'
            });
        }

        const result = await billingService.recordUsage(
            tenantId,
            idempotencyKey,
            input_tokens,
            output_tokens
        );

        res.status(200).json(result);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
    }
});
```

</codeblock1>

<codeblock1func1>

**`POST /api/v1/generate`**

Records a billable token-usage event for a tenant. Validates that the `X-Tenant-Id` and `Idempotency-Key` headers are present and that `input_tokens` and `output_tokens` in the body are numbers, then delegates to `billingService.recordUsage`. Supports idempotent replay — submitting the same `Idempotency-Key` a second time returns the original result without double-counting.

- **Headers required:**
  - `X-Tenant-Id` — tenant UUID.
  - `Idempotency-Key` — client-supplied deduplication key.
- **Body:** `{ input_tokens: number, output_tokens: number }`
- **Responses:**
  - `200` — `{ success, event_id, tokens_used, idempotent_reply? }`
  - `400` — Missing headers or invalid body types.
  - `402` — Tenant has no active subscription.
  - `429` — Quota exceeded.
  - `500` — Unexpected server error.

</codeblock1func1>

---

<codeblock2>

```javascript
router.get('/usage/summary', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];

        if (!tenantId) {
            return res.status(400).json({
                error: 'Missing required header: X-Tenant-Id'
            });
        }

        const summary = await billingService.getUsageSummary(tenantId);
        res.status(200).json(summary);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
    }
});
```

</codeblock2>

<codeblock2func2>

**`GET /api/v1/usage/summary`**

Returns the current usage summary for a tenant, including the plan name, total tokens used, and the monthly quota limit. Requires the `X-Tenant-Id` header and delegates to `billingService.getUsageSummary`.

- **Headers required:**
  - `X-Tenant-Id` — tenant UUID.
- **Responses:**
  - `200` — `{ plan, total_tokens_used, quota_limit, current_cost_cents }`
  - `400` — Missing `X-Tenant-Id` header.
  - `402` — Tenant has no active subscription.
  - `500` — Unexpected server error.

</codeblock2func2>

---

<codeblock3>

```javascript
router.post('/checkout/create', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];

        if (!tenantId) {
            return res.status(400).json({
                error: 'Missing required header: X-Tenant-Id'
            });
        }

        const session = await billingService.createCheckoutSession(tenantId);
        return res.status(200).json({
            session_id: session.id,
            checkout_url: session.url
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
    }
});
```

</codeblock3>

<codeblock3func3>

**`POST /api/v1/checkout/create`**

Initiates a Stripe Checkout session for a tenant to upgrade their subscription. Validates the `X-Tenant-Id` header, calls `billingService.createCheckoutSession`, and returns both the Stripe session ID and the hosted checkout URL the client should redirect to.

- **Headers required:**
  - `X-Tenant-Id` — tenant UUID.
- **Responses:**
  - `200` — `{ session_id, checkout_url }`
  - `400` — Missing `X-Tenant-Id` header.
  - `500` — Unexpected server error.

</codeblock3func3>

---

<codeblock4>

```javascript
router.post('/webhooks/stripe', async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        if (!signature) {
            return res.status(400).json({ error: 'Missing Stripe signature' });
        }

        const rawBody = req.body;
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET || 'whsec_fake'
            );
        } catch (error) {
            return res.status(400).json({ error: 'Invalid Stripe signature' });
        }

        if (!event || !event.id || !event.type) {
            return res.status(400).json({ error: 'Invalid Stripe signature' });
        }

        const processingResult = await billingService.processStripeEvent(event);

        if (processingResult && processingResult.duplicate) {
            return res.status(200).json({ received: true, duplicate: true });
        }

        return res.status(200).json({ received: true, duplicate: false });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
```

</codeblock4>

<codeblock4func4>

**`POST /api/v1/webhooks/stripe`**

Receives and verifies incoming Stripe webhook events. The route expects the raw request body (not JSON-parsed) so that the HMAC signature can be validated against `STRIPE_WEBHOOK_SECRET`. After successful verification it delegates the event to `billingService.processStripeEvent`, which handles subscription lifecycle changes. Duplicate events are acknowledged silently with `duplicate: true`.

- **Headers required:**
  - `Stripe-Signature` — HMAC signature provided by Stripe.
- **Body:** Raw JSON payload from Stripe.
- **Responses:**
  - `200` — `{ received: true, duplicate: boolean }`
  - `400` — Missing or invalid `Stripe-Signature`, or malformed event.
  - `500` — Unexpected server error.

</codeblock4func4>
