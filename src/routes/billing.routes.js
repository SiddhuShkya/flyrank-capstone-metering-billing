const express = require('express');
const billingService = require('../services/billing.service');

const router = express.Router();

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

module.exports = router;
