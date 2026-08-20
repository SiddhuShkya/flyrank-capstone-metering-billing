const crypto = require('crypto');
const Stripe = require('stripe');
const billingRepository = require('../repository/billing.repository');
const PRICING = require('../config/pricing');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fake');
const processedStripeEventIds = new Set();

class BillingService {
    /**
     * Converts token usage into a cost in cents (integer).
     *
     * Why micro-cents?
     *   Token prices are fractions of a cent. If we multiplied in cents directly
     *   (e.g. 0.000001 cents per token), floating-point math would introduce
     *   rounding errors. By working in micro-cents (integers) and dividing at
     *   the very end, the result is always exact and deterministic.
     *
     * @param {number} inputTokens   - Number of input tokens
     * @param {number} outputTokens  - Number of output tokens
     * @returns {number} cost in whole cents (integer, floored)
     */
    calculateCost(inputTokens, outputTokens) {
        const microCents =
            inputTokens * PRICING.INPUT_TOKEN_MICRO_CENTS +
            outputTokens * PRICING.OUTPUT_TOKEN_MICRO_CENTS;

        // Integer division: truncate sub-cent remainder
        return Math.floor(microCents / 1_000_000);
    }

    /**
     * Records a billable usage event.
     * Enforces idempotency and quota limits.
     */
    async recordUsage(tenantId, idempotencyKey, inputTokens, outputTokens) {
        // 1. Get active subscription
        const subscription = await billingRepository.getActiveSubscription(tenantId);

        if (!subscription) {
            const error = new Error('Subscription inactive or not found.');
            error.statusCode = 402;
            throw error;
        }

        const totalRequestedTokens = inputTokens + outputTokens;

        // 2. Check quota
        const currentUsage = await billingRepository.getTotalUsage(tenantId);

        if (currentUsage + totalRequestedTokens > subscription.monthly_token_quota) {
            const error = new Error('Quota exceeded. Upgrade your plan.');
            error.statusCode = 429;
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
     * Retrieves the usage summary for a tenant, including the calculated cost.
     *
     * Cost calculation uses per-category token totals so that input and output
     * tokens can be priced at different rates. Summing them first and applying
     * one rate would produce wrong results.
     */
    async getUsageSummary(tenantId) {
        const subscription = await billingRepository.getActiveSubscription(tenantId);

        if (!subscription) {
            const error = new Error('Subscription inactive or not found.');
            error.statusCode = 402;
            throw error;
        }

        // Fetch per-category totals for correct cost calculation
        const breakdown = await billingRepository.getUsageBreakdown(tenantId);

        const currentCostCents = this.calculateCost(
            breakdown.total_input_tokens,
            breakdown.total_output_tokens
        );

        return {
            plan: subscription.plan_id,
            total_tokens_used: breakdown.total_input_tokens + breakdown.total_output_tokens,
            quota_limit: subscription.monthly_token_quota,
            current_cost_cents: currentCostCents
        };
    }

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
}

module.exports = new BillingService();