const crypto = require('crypto');
const billingRepository = require('../repository/billing.repository');

class BillingService {
    /**
     * Records a billable usage event.
     * Enforces idempotency and quota limits.
     */
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

    /**
     * Retrieves the usage summary for a tenant.
     */
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
}

module.exports = new BillingService();
