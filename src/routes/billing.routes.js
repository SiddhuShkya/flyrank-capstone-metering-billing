const express = require('express');
const Stripe = require('stripe');
const billingService = require('../services/billing.service');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fake');

/**
 * POST /api/v1/generate
 * Records a billable action.
 */
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

/**
 * GET /api/v1/usage/summary
 * Retrieves the usage summary for a tenant.
 */
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

router.post('/checkout/create', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || (req.body && (req.body.tenantId || req.body.tenant_id));

        if (!tenantId) {
            return res.status(400).json({
                error: 'Missing required tenant ID (provide X-Tenant-Id header or tenantId in body)'
            });
        }

        const session = await billingService.createCheckoutSession(tenantId);
        return res.status(200).json({
            id: session.id,
            session_id: session.id,
            url: session.url,
            checkout_url: session.url
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
    }
});

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

module.exports = router;