# Services

<filename>
src/services/billing.service.js
</filename>

---

<codeblock1>

```javascript
async recordUsage(tenantId, idempotencyKey, inputTokens, outputTokens) {
    // 1. Get active subscription
    const subscription = await billingRepository.getActiveSubscription(tenantId);

    if (!subscription) {
        const error = new Error('Subscription inactive or not found.');
        error.statusCode = 402; // Payment Required
        throw error;
    }

    const totalRequestedTokens = inputTokens + outputTokens;

    // 2. Check quota
    const currentUsage = await billingRepository.getTotalUsage(tenantId);

    if (currentUsage + totalRequestedTokens > subscription.monthly_token_quota) {
        const error = new Error('Quota exceeded. Upgrade your plan.');
        error.statusCode = 429; // Too Many Requests
        throw error;
    }

    // 3. Attempt to record the event
    const eventId = crypto.randomUUID();

    try {
        const event = await billingRepository.insertUsageEvent(
            eventId,
            tenantId,
            idempotencyKey,
            inputTokens,
            outputTokens
        );
        return {
            success: true,
            event_id: event.id,
            tokens_used: event.input_tokens + event.output_tokens
        };
    } catch (error) {
        if (error.code === '23505') {
            // Idempotency: Return the existing event
            const existingEvent = await billingRepository.getUsageEventByIdempotencyKey(tenantId, idempotencyKey);
            if (existingEvent) {
                return {
                    success: true,
                    event_id: existingEvent.id,
                    tokens_used: existingEvent.input_tokens + existingEvent.output_tokens,
                    idempotent_reply: true
                };
            }
        }
        throw error;
    }
}
```

</codeblock1>

<codeblock1func1>

**`recordUsage(tenantId, idempotencyKey, inputTokens, outputTokens)`**

Core billing logic that records a token-usage event. Executes three ordered steps:

1. **Subscription check** — fetches the tenant's active subscription; throws `402` if none is found.
2. **Quota check** — sums existing usage and compares to `monthly_token_quota`; throws `429` if the new request would exceed the limit.
3. **Event insertion** — generates a UUID, inserts the usage event, and returns `{ success, event_id, tokens_used }`. If the insert conflicts on `idempotency_key` (Postgres error `23505`), it fetches and returns the original event with `idempotent_reply: true` instead of throwing.

- **Parameters:**
  - `tenantId` — tenant UUID.
  - `idempotencyKey` — client-supplied deduplication key.
  - `inputTokens` — number of input tokens.
  - `outputTokens` — number of output tokens.
- **Returns:** `{ success, event_id, tokens_used, idempotent_reply? }`
- **Throws:** `402` (no subscription), `429` (quota exceeded).

</codeblock1func1>

---

<codeblock2>

```javascript
async getUsageSummary(tenantId) {
    const subscription = await billingRepository.getActiveSubscription(tenantId);

    if (!subscription) {
        const error = new Error('Subscription inactive or not found.');
        error.statusCode = 402;
        throw error;
    }

    const totalUsed = await billingRepository.getTotalUsage(tenantId);

    return {
        plan: subscription.plan_id,
        total_tokens_used: totalUsed,
        quota_limit: subscription.monthly_token_quota,
        current_cost_cents: 0 // Will implement in Phase 4
    };
}
```

</codeblock2>

<codeblock2func2>

**`getUsageSummary(tenantId)`**

Builds a usage summary for a tenant by fetching their active subscription and total token consumption. Returns a structured object suitable for display in a dashboard or API response. `current_cost_cents` is a placeholder, to be implemented in a future phase.

- **Parameters:** `tenantId` — tenant UUID.
- **Returns:** `{ plan, total_tokens_used, quota_limit, current_cost_cents }`
- **Throws:** `402` if the tenant has no active subscription.

</codeblock2func2>

---

<codeblock3>

```javascript
async createCheckoutSession(tenantId) {
    if (!tenantId) {
        const error = new Error('Missing tenant ID.');
        error.statusCode = 400;
        throw error;
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{
            price: process.env.STRIPE_PRICE_ID || 'price_test_placeholder',
            quantity: 1
        }],
        success_url: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/success',
        cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/cancel',
        metadata: {
            tenant_id: tenantId
        }
    });

    return {
        id: session.id,
        url: session.url
    };
}
```

</codeblock3>

<codeblock3func3>

**`createCheckoutSession(tenantId)`**

Creates a Stripe-hosted subscription checkout session for a tenant. Embeds `tenant_id` in the session metadata so it can be recovered when Stripe fires the `checkout.session.completed` webhook. The price, success URL, and cancel URL are all driven by environment variables with fallback values for local development.

- **Parameters:** `tenantId` — tenant UUID.
- **Returns:** `{ id, url }` — Stripe session ID and the hosted checkout page URL.
- **Throws:** `400` if `tenantId` is falsy.

</codeblock3func3>

---

<codeblock4>

```javascript
async processStripeEvent(event) {
    if (!event || !event.id) {
        return { processed: false, duplicate: false };
    }

    if (processedStripeEventIds.has(event.id)) {
        return { processed: true, duplicate: true };
    }

    const eventType = event.type || 'unknown';
    const object = event.data && event.data.object ? event.data.object : {};

    if (eventType === 'checkout.session.completed') {
        const tenantId = object.metadata && object.metadata.tenant_id;
        if (tenantId) {
            await billingRepository.updateSubscriptionStatus(tenantId, 'pro', 'active', object.customer, object.subscription);
        }
    }

    if (eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.deleted') {
        const customerId = object.customer;
        const subscription = await billingRepository.findTenantByStripeCustomerId(customerId);
        if (subscription) {
            const nextStatus = eventType === 'customer.subscription.deleted' ? 'canceled' : 'active';
            const planId = eventType === 'customer.subscription.deleted' ? 'free' : 'pro';
            await billingRepository.updateSubscriptionStatus(subscription.tenant_id, planId, nextStatus, customerId, object.id);
        }
    }

    processedStripeEventIds.add(event.id);

    return { processed: true, duplicate: false };
}
```

</codeblock4>

<codeblock4func4>

**`processStripeEvent(event)`**

Handles incoming Stripe webhook events with in-memory deduplication. Maintains a module-level `Set` (`processedStripeEventIds`) to detect and short-circuit replayed events. Handles three event types:

| Event type | Action |
|---|---|
| `checkout.session.completed` | Upgrades the tenant to `pro` / `active` using the `tenant_id` from session metadata. |
| `customer.subscription.updated` | Resolves the tenant via `stripe_customer_id` and sets plan to `pro` / status to `active`. |
| `customer.subscription.deleted` | Resolves the tenant via `stripe_customer_id` and sets plan to `free` / status to `canceled`. |

- **Parameters:** `event` — a verified Stripe event object.
- **Returns:** `{ processed: boolean, duplicate: boolean }`

</codeblock4func4>
