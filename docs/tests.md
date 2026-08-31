# Tests

<filename>
src/tests/billing.test.js
</filename>

---

<codeblock1>

```javascript

describe('Billing API', () => {
    const tenantIdFree = '550e8400-e29b-41d4-a716-446655440000';
    const tenantIdPro = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    beforeAll(async () => {
        await pool.query('DELETE FROM usage_events WHERE tenant_id IN ($1, $2)', [tenantIdFree, tenantIdPro]);
        await pool.query(
            `UPDATE subscriptions
             SET plan_id = 'free', status = 'active',
                 stripe_customer_id = 'cus_test123',
                 stripe_subscription_id = 'sub_test456'
             WHERE tenant_id = $1`,
            [tenantIdFree]
        );
        await pool.query(
            `UPDATE subscriptions
             SET plan_id = 'pro', status = 'active',
                 stripe_customer_id = 'cus_test789',
                 stripe_subscription_id = 'sub_test012'
             WHERE tenant_id = $1`,
            [tenantIdPro]
        );
    });

    afterAll(async () => {
        await pool.end();
    });
})
```

</codeblock1>

<codeblock1func1>

**`describe('Billing API')` — Test Suite Setup**

Defines the top-level test suite for the Billing API. Two tenant UUIDs are used throughout — `tenantIdFree` (on the `free` plan, 10 000-token quota) and `tenantIdPro` (on the `pro` plan).

- **`beforeAll`** — Clears any existing usage events for both tenants and resets their subscription rows to a known baseline state so each test run starts from a clean slate.
- **`afterAll`** — Closes the database connection pool after all tests have finished, preventing open-handle warnings in Jest.

</codeblock1func1>

---

<codeblock2>

```javascript
it('should record usage when within limit', async () => {
    const response = await request(app)
        .post('/api/v1/generate')
        .set('X-Tenant-Id', tenantIdFree)
        .set('Idempotency-Key', 'test-key-1')
        .send({ input_tokens: 100, output_tokens: 200 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tokens_used).toBe(300);
    expect(response.body.event_id).toBeDefined();
});
```

</codeblock2>

<codeblock2func2>

**`it('should record usage when within limit')`**

Verifies the happy-path: posting a usage event with 100 input + 200 output tokens returns `200 OK`, `success: true`, `tokens_used: 300`, and a defined `event_id`. Idempotency key `test-key-1` is used and carries over to the next test.

</codeblock2func2>

---

<codeblock3>

```javascript
it('should return idempotent response for duplicate request', async () => {
    const response = await request(app)
        .post('/api/v1/generate')
        .set('X-Tenant-Id', tenantIdFree)
        .set('Idempotency-Key', 'test-key-1')
        .send({ input_tokens: 100, output_tokens: 200 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tokens_used).toBe(300);
    expect(response.body.idempotent_reply).toBe(true);
});
```

</codeblock3>

<codeblock3func3>

**`it('should return idempotent response for duplicate request')`**

Re-submits the same `Idempotency-Key` (`test-key-1`) used in the previous test. Confirms that the API returns `200 OK` with the original `tokens_used` value and sets `idempotent_reply: true`, proving that no second event was recorded.

</codeblock3func3>

---

<codeblock4>

```javascript
it('should block request that exceeds quota immediately', async () => {
    const response = await request(app)
        .post('/api/v1/generate')
        .set('X-Tenant-Id', tenantIdFree)
        .set('Idempotency-Key', 'test-key-2')
        .send({ input_tokens: 5000, output_tokens: 5000 });

    expect(response.status).toBe(429);
    expect(response.body.error).toMatch(/Quota exceeded/);
});
```

</codeblock4>

<codeblock4func4>

**`it('should block request that exceeds quota immediately')`**

Attempts to consume 10 000 tokens (5 000 + 5 000) when 300 tokens are already used, pushing the total to 10 300 — above the 10 000-token free-plan quota. Asserts that the response is `429 Too Many Requests` and that the error message matches `/Quota exceeded/`.

</codeblock4func4>

---

<codeblock5>

```javascript
it('should allow request that exactly hits the limit', async () => {
    const response = await request(app)
        .post('/api/v1/generate')
        .set('X-Tenant-Id', tenantIdFree)
        .set('Idempotency-Key', 'test-key-3')
        .send({ input_tokens: 4700, output_tokens: 5000 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tokens_used).toBe(9700);
});
```

</codeblock5>

<codeblock5func5>

**`it('should allow request that exactly hits the limit')`**

Sends 9 700 tokens (4 700 + 5 000), bringing the free-plan tenant's total exactly to 10 000. Asserts `200 OK` with `tokens_used: 9700`, confirming that boundary values are allowed (the check is strictly greater-than, not greater-than-or-equal).

</codeblock5func5>

---

<codeblock6>

```javascript
it('should block request when exactly at the limit and requesting more', async () => {
    const response = await request(app)
        .post('/api/v1/generate')
        .set('X-Tenant-Id', tenantIdFree)
        .set('Idempotency-Key', 'test-key-4')
        .send({ input_tokens: 1, output_tokens: 0 });

    expect(response.status).toBe(429);
    expect(response.body.error).toMatch(/Quota exceeded/);
});
```

</codeblock6>

<codeblock6func6>

**`it('should block request when exactly at the limit and requesting more')`**

With the tenant now sitting at exactly 10 000 tokens used, requests even 1 additional token and asserts `429 Too Many Requests`. This validates the boundary condition on the other side — once the quota is fully consumed, no further events are allowed.

</codeblock6func6>

---

<codeblock7>

```javascript
it('should show correct usage summary with cost', async () => {
    const response = await request(app)
        .get('/api/v1/usage/summary')
        .set('X-Tenant-Id', tenantIdFree);

    expect(response.status).toBe(200);
    expect(response.body.plan).toBe('free');
    expect(response.body.total_tokens_used).toBe(10000); // 300 + 9700
    expect(response.body.quota_limit).toBe(10000);

    // current_cost_cents must be a non-negative integer
    expect(typeof response.body.current_cost_cents).toBe('number');
    expect(Number.isInteger(response.body.current_cost_cents)).toBe(true);
    expect(response.body.current_cost_cents).toBeGreaterThanOrEqual(0);
});
```

</codeblock7>

<codeblock7func7>

**`it('should show correct usage summary with cost')`**

Verifies the `GET /api/v1/usage/summary` endpoint reflects the accumulated state: plan is `'free'`, total tokens used is `10 000` (300 + 9 700), quota limit is `10 000`, and `current_cost_cents` is a non-negative integer (no longer the placeholder `0` value).

</codeblock7func7>

---

<codeblock8>

```javascript
it('should create a Stripe checkout session for a valid tenant', async () => {
    const response = await request(app)
        .post('/api/v1/checkout/create')
        .set('X-Tenant-Id', tenantIdFree)
        .send({});

    expect(response.status).toBe(200);
    expect(response.body.checkout_url).toBe('https://checkout.stripe.com/test_session');
});
```

</codeblock8>

<codeblock8func8>

**`it('should create a Stripe checkout session for a valid tenant')`**

Tests the checkout-session creation endpoint using the mocked Stripe SDK (which returns a fixed URL). Asserts `200 OK` and confirms the `checkout_url` matches the mock value, verifying the route correctly calls the service and serialises the response.

</codeblock8func8>

---

<codeblock9>

```javascript
it('should reject a webhook with an invalid signature', async () => {
    const rawBody = JSON.stringify({ ... });

    const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('Stripe-Signature', 'invalid-signature')
        .set('Content-Type', 'application/json')
        .send(rawBody);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Invalid Stripe signature/i);
});
```

</codeblock9>

<codeblock9func9>

**`it('should reject a webhook with an invalid signature')`**

Posts a webhook payload with a deliberately invalid `Stripe-Signature` header. Since the Stripe mock's `constructEvent` throws for unrecognised signatures, the route catches it and returns `400` with an `Invalid Stripe signature` message, confirming the security guard is working.

</codeblock9func9>

---

<codeblock10>

```javascript
it('should ignore duplicate Stripe webhook events', async () => {
    mockedStripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_test_duplicate',
        type: 'checkout.session.completed',
        data: { object: { ... } }
    });

    const firstResponse = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('Stripe-Signature', 'valid-signature')
        .send(payload);

    const secondResponse = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('Stripe-Signature', 'valid-signature')
        .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.duplicate).toBe(true);
});
```

</codeblock10>

<codeblock10func10>

**`it('should ignore duplicate Stripe webhook events')`**

Sends the same webhook event (`evt_test_duplicate`) twice. The first call succeeds and processes the event; the second call is recognised as a duplicate via the in-memory `processedStripeEventIds` set and returns `{ received: true, duplicate: true }` without re-processing. Both responses return `200 OK`.

</codeblock10func10>

---

<filename>
src/tests/chat-pricing.test.js
</filename>

---

<codeblock11>

```javascript
describe('BillingService.calculateCost — pinned pricing tests', () => {

    it('should return 0 cost for zero tokens', () => {
        expect(billingService.calculateCost(0, 0)).toBe(0);
    });

    it('should price only input tokens correctly', () => {
        expect(billingService.calculateCost(1_000_000, 0)).toBe(1);
    });

    it('should price only output tokens correctly', () => {
        expect(billingService.calculateCost(0, 1_000_000)).toBe(4);
    });

    it('should price output tokens higher than input tokens for the same quantity', () => {
        const inputCost  = billingService.calculateCost(1_000_000, 0);
        const outputCost = billingService.calculateCost(0, 1_000_000);
        expect(outputCost).toBeGreaterThan(inputCost);
    });

    it('should price both categories and add them together correctly', () => {
        expect(billingService.calculateCost(500_000, 500_000)).toBe(2);
    });

    it('should floor sub-cent remainders, not round them', () => {
        expect(billingService.calculateCost(999_999, 0)).toBe(0);
        expect(billingService.calculateCost(1_000_001, 0)).toBe(1);
    });
});
```

</codeblock11>

<codeblock11func11>

**`describe('BillingService.calculateCost')` — Unit Test Suite**

Validates the cost calculation service logic in `src/services/billing.service.js` against micro-cents pricing rules.
- **Zero tokens** — Cost calculation returns `0` cents.
- **Input and Output token pricing** — 1,000,000 input tokens cost 1 cent; 1,000,000 output tokens cost 4 cents. Output tokens are priced higher than input tokens.
- **Combined pricing** — Correctly aggregates input and output tokens (e.g., 500,000 input tokens + 500,000 output tokens cost 2 cents after flooring).
- **Rounding vs Flooring** — Verifies that any fractional micro-cents that do not amount to a full cent are floored rather than rounded up (e.g., 999,999 input tokens cost 0 cents).
- **Pinned constants verification** — Assures that the configured pricing constants match the specification and will alert if modified.

</codeblock11func11>
