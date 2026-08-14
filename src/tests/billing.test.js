const request = require('supertest');
const app = require('../app');
const pool = require('../db');

describe('Billing API', () => {
    const tenantIdFree = '550e8400-e29b-41d4-a716-446655440000';
    const tenantIdPro = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    beforeAll(async () => {
        // Clear any previous usage events for test tenants to have a clean state
        await pool.query('DELETE FROM usage_events WHERE tenant_id IN ($1, $2)', [tenantIdFree, tenantIdPro]);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('should record usage when within limit', async () => {
        const response = await request(app)
            .post('/api/v1/generate')
            .set('X-Tenant-Id', tenantIdFree)
            .set('Idempotency-Key', 'test-key-1')
            .send({
                input_tokens: 100,
                output_tokens: 200
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.tokens_used).toBe(300);
        expect(response.body.event_id).toBeDefined();
    });

    it('should return idempotent response for duplicate request', async () => {
        const response = await request(app)
            .post('/api/v1/generate')
            .set('X-Tenant-Id', tenantIdFree)
            .set('Idempotency-Key', 'test-key-1')
            .send({
                input_tokens: 100, // even if payload changes, should return original
                output_tokens: 200
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.tokens_used).toBe(300);
        expect(response.body.idempotent_reply).toBe(true);
    });

    it('should block request that exceeds quota immediately', async () => {
        const response = await request(app)
            .post('/api/v1/generate')
            .set('X-Tenant-Id', tenantIdFree)
            .set('Idempotency-Key', 'test-key-2')
            .send({
                input_tokens: 5000,
                output_tokens: 5000
            }); // 300 + 10000 = 10300 > 10000 limit

        expect(response.status).toBe(429);
        expect(response.body.error).toMatch(/Quota exceeded/);
    });

    it('should allow request that exactly hits the limit', async () => {
        // Current usage is 300
        // Limit is 10000, so remaining is 9700
        const response = await request(app)
            .post('/api/v1/generate')
            .set('X-Tenant-Id', tenantIdFree)
            .set('Idempotency-Key', 'test-key-3')
            .send({
                input_tokens: 4700,
                output_tokens: 5000
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.tokens_used).toBe(9700);
    });
    
    it('should block request when exactly at the limit and requesting more', async () => {
        const response = await request(app)
            .post('/api/v1/generate')
            .set('X-Tenant-Id', tenantIdFree)
            .set('Idempotency-Key', 'test-key-4')
            .send({
                input_tokens: 1,
                output_tokens: 0
            });

        expect(response.status).toBe(429);
        expect(response.body.error).toMatch(/Quota exceeded/);
    });

    it('should show correct usage summary', async () => {
        const response = await request(app)
            .get('/api/v1/usage/summary')
            .set('X-Tenant-Id', tenantIdFree);

        expect(response.status).toBe(200);
        expect(response.body.plan).toBe('free');
        expect(response.body.total_tokens_used).toBe(10000); // 300 + 9700
        expect(response.body.quota_limit).toBe(10000);
    });
});
