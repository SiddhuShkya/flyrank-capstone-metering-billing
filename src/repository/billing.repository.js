const pool = require('../db');

class BillingRepository {
    /**
     * Retrieve the active subscription and plan for a tenant.
     */
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

    /**
     * Retrieve the total token usage for a tenant.
     */
    async getTotalUsage(tenantId) {
        const query = `
            SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total_used
            FROM usage_events
            WHERE tenant_id = $1
        `;
        const result = await pool.query(query, [tenantId]);
        return parseInt(result.rows[0].total_used, 10);
    }
    
    /**
     * Retrieve per-category token totals for a tenant.
     * Used by the service layer to calculate cost correctly.
     *
     * Why not reuse getTotalUsage()?
     *   getTotalUsage() sums all tokens into one number — fine for quota checks.
     *   For cost calculation, input and output tokens have different rates,
     *   so they must be totalled separately before pricing is applied.
     */
    async getUsageBreakdown(tenantId) {
        const query = `
            SELECT
                COALESCE(SUM(input_tokens), 0)  AS total_input_tokens,
                COALESCE(SUM(output_tokens), 0) AS total_output_tokens
            FROM usage_events
            WHERE tenant_id = $1
        `;
        const result = await pool.query(query, [tenantId]);
        const row = result.rows[0];
        return {
            total_input_tokens:  parseInt(row.total_input_tokens, 10),
            total_output_tokens: parseInt(row.total_output_tokens, 10),
        };
    }

    /**
     * Attempt to insert a new usage event.
     * Throws an error if the idempotency_key already exists for this tenant.
     */
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
            // Postgres unique violation code is 23505
            if (error.code === '23505') {
                const conflictError = new Error('Duplicate idempotency key');
                conflictError.code = '23505';
                throw conflictError;
            }
            throw error;
        }
    }

    /**
     * Retrieve an existing usage event by idempotency key.
     */
    async getUsageEventByIdempotencyKey(tenantId, idempotencyKey) {
        const query = `
            SELECT * FROM usage_events
            WHERE tenant_id = $1 AND idempotency_key = $2
        `;
        const result = await pool.query(query, [tenantId, idempotencyKey]);
        return result.rows[0] || null;
    }

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
}

module.exports = new BillingRepository();