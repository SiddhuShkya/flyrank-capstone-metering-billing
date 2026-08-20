# Repository

<filename>
src/repository/billing.repository.js
</filename>

---

<codeblock1>

```javascript
async getActiveSubscription(tenantId) {
    const query = `
        SELECT s.plan_id, p.monthly_token_quota, s.status
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = $1 AND s.status = 'active'
    `;
    const result = await pool.query(query, [tenantId]);
    return result.rows[0] || null;
}
```

</codeblock1>

<codeblock1func1>

**`getActiveSubscription(tenantId)`**

Queries the database for the currently active subscription of a given tenant. It joins the `subscriptions` table with the `plans` table to retrieve the `plan_id`, `monthly_token_quota`, and `status`. Returns the first matching row or `null` if no active subscription is found.

- **Parameters:** `tenantId` — the UUID of the tenant.
- **Returns:** `{ plan_id, monthly_token_quota, status }` or `null`.

</codeblock1func1>

---

<codeblock2>

```javascript
async getTotalUsage(tenantId) {
    const query = `
        SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total_used
        FROM usage_events
        WHERE tenant_id = $1
    `;
    const result = await pool.query(query, [tenantId]);
    return parseInt(result.rows[0].total_used, 10);
}
```

</codeblock2>

<codeblock2func2>

**`getTotalUsage(tenantId)`**

Calculates the cumulative token consumption for a tenant by summing all `input_tokens` and `output_tokens` across every usage event recorded in the `usage_events` table. Uses `COALESCE` to return `0` when no events exist.

- **Parameters:** `tenantId` — the UUID of the tenant.
- **Returns:** `number` — total tokens consumed.

</codeblock2func2>

---

<codeblock3>

```javascript
async insertUsageEvent(id, tenantId, idempotencyKey, inputTokens, outputTokens) {
    const query = `
        INSERT INTO usage_events (id, tenant_id, idempotency_key, input_tokens, output_tokens)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    try {
        const result = await pool.query(query, [id, tenantId, idempotencyKey, inputTokens, outputTokens]);
        return result.rows[0];
    } catch (error) {
        if (error.code === '23505') {
            const conflictError = new Error('Duplicate idempotency key');
            conflictError.code = '23505';
            throw conflictError;
        }
        throw error;
    }
}
```

</codeblock3>

<codeblock3func3>

**`insertUsageEvent(id, tenantId, idempotencyKey, inputTokens, outputTokens)`**

Inserts a new usage event into the `usage_events` table and returns the created row. Handles PostgreSQL unique-constraint violations (error code `23505`) that occur when a duplicate `idempotency_key` is submitted for the same tenant, re-throwing a clearly labelled conflict error so the service layer can react appropriately.

- **Parameters:**
  - `id` — UUID for the new event.
  - `tenantId` — tenant UUID.
  - `idempotencyKey` — client-supplied deduplication key.
  - `inputTokens` — number of input tokens consumed.
  - `outputTokens` — number of output tokens consumed.
- **Returns:** The newly inserted `usage_events` row.
- **Throws:** Error with `code = '23505'` on duplicate key; re-throws all other errors.

</codeblock3func3>

---

<codeblock4>

```javascript
async getUsageEventByIdempotencyKey(tenantId, idempotencyKey) {
    const query = `
        SELECT * FROM usage_events
        WHERE tenant_id = $1 AND idempotency_key = $2
    `;
    const result = await pool.query(query, [tenantId, idempotencyKey]);
    return result.rows[0] || null;
}
```

</codeblock4>

<codeblock4func4>

**`getUsageEventByIdempotencyKey(tenantId, idempotencyKey)`**

Fetches an existing usage event that matches both the tenant ID and the idempotency key. Used by the service layer after a duplicate-key conflict to retrieve the original event and return an idempotent response to the client.

- **Parameters:**
  - `tenantId` — tenant UUID.
  - `idempotencyKey` — client-supplied deduplication key.
- **Returns:** The matching `usage_events` row or `null`.

</codeblock4func4>

---

<codeblock5>

```javascript
async updateSubscriptionStatus(tenantId, planId, status, stripeCustomerId, stripeSubscriptionId) {
    const query = `
        UPDATE subscriptions
        SET plan_id = $1,
            status = $2,
            stripe_customer_id = COALESCE($3, stripe_customer_id),
            stripe_subscription_id = COALESCE($4, stripe_subscription_id)
        WHERE tenant_id = $5
    `;
    await pool.query(query, [planId, status, stripeCustomerId, stripeSubscriptionId, tenantId]);
}
```

</codeblock5>

<codeblock5func5>

**`updateSubscriptionStatus(tenantId, planId, status, stripeCustomerId, stripeSubscriptionId)`**

Updates a tenant's subscription record with a new plan, status, and optional Stripe identifiers. Uses `COALESCE` so that passing `null` for `stripeCustomerId` or `stripeSubscriptionId` preserves the existing values rather than overwriting them.

- **Parameters:**
  - `tenantId` — tenant UUID.
  - `planId` — new plan identifier (e.g. `'free'`, `'pro'`).
  - `status` — new subscription status (e.g. `'active'`, `'canceled'`).
  - `stripeCustomerId` — Stripe customer ID or `null`.
  - `stripeSubscriptionId` — Stripe subscription ID or `null`.
- **Returns:** `void`.

</codeblock5func5>

---

<codeblock6>

```javascript
async findTenantByStripeCustomerId(customerId) {
    const query = `
        SELECT tenant_id
        FROM subscriptions
        WHERE stripe_customer_id = $1
        LIMIT 1
    `;
    const result = await pool.query(query, [customerId]);
    return result.rows[0] || null;
}
```

</codeblock6>

<codeblock6func6>

**`findTenantByStripeCustomerId(customerId)`**

Looks up the tenant associated with a given Stripe customer ID. Used when processing Stripe webhook events where only the customer ID is available and the internal tenant ID must be resolved.

- **Parameters:** `customerId` — Stripe customer ID string.
- **Returns:** `{ tenant_id }` or `null`.

</codeblock6func6>
