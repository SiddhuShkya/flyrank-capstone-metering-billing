const request = require('supertest');
const app = require('../app');
const pool = require('../db');

jest.mock('stripe', () => {
    const mockStripe = {
        checkout: {
            sessions: {
                create: jest.fn().mockResolvedValue({
                    id: 'cs_test_123',
                    url: 'https://checkout.stripe.com/test_session'
                })
            }
        },
        webhooks: {
            constructEvent: jest.fn()
        }
    };

    return jest.fn(() => mockStripe);
});

describe('Billing API', () => {
    const tenantIdFree = '550e8400-e29b-41d4-a716-446655440000';
    const tenantIdPro = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    beforeAll(async () => {
        await pool.query('DELETE FROM usage_events WHERE tenant_id IN ($1, $2)', [tenantIdFree, tenantIdPro]);
        await pool.query(
            `UPDATE subscriptions
             SET plan_id = 'free',
                 status = 'active',
                 stripe_customer_id = 'cus_test123',
                 stripe_subscription_id = 'sub_test456'
             WHERE tenant_id = $1`,
            [tenantIdFree]
        );
        await pool.query(
            `UPDATE subscriptions
             SET plan_id = 'pro',
                 status = 'active',
                 stripe_customer_id = 'cus_test789',
                 stripe_subscription_id = 'sub_test012'
             WHERE tenant_id = $1`,
            [tenantIdPro]
        );
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

    it('should create a Stripe checkout session for a valid tenant', async () => {
        const response = await request(app)
            .post('/api/v1/checkout/create')
            .set('X-Tenant-Id', tenantIdFree)
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.checkout_url).toBe('https://checkout.stripe.com/test_session');
    });

    it('should reject a webhook with an invalid signature', async () => {
        const rawBody = JSON.stringify({
            id: 'evt_test_123',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_123',
                    customer: 'cus_test_123',
                    subscription: 'sub_test_123',
                    metadata: { tenant_id: tenantIdFree }
                }
            }
        });

        const response = await request(app)
            .post('/api/v1/webhooks/stripe')
            .set('Stripe-Signature', 'invalid-signature')
            .set('Content-Type', 'application/json')
            .send(rawBody);

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/Invalid Stripe signature/i);
    });

    it('should ignore duplicate Stripe webhook events', async () => {
        const StripeLib = require('stripe');
        const mockedStripe = StripeLib();

        mockedStripe.webhooks.constructEvent.mockReturnValue({
            id: 'evt_test_duplicate',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_123',
                    customer: 'cus_test_123',
                    subscription: 'sub_test_123',
                    metadata: { tenant_id: tenantIdFree }
                }
            }
        });

        await pool.query(
            `UPDATE subscriptions
             SET plan_id = 'free',
                 status = 'active',
                 stripe_customer_id = 'cus_test123',
                 stripe_subscription_id = 'sub_test456'
             WHERE tenant_id = $1`,
            [tenantIdFree]
        );

        const payload = JSON.stringify({
            id: 'evt_test_duplicate',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_123',
                    customer: 'cus_test_123',
                    subscription: 'sub_test_123',
                    metadata: { tenant_id: tenantIdFree }
                }
            }
        });

        const firstResponse = await request(app)
            .post('/api/v1/webhooks/stripe')
            .set('Stripe-Signature', 'valid-signature')
            .set('Content-Type', 'application/json')
            .send(payload);

        const secondResponse = await request(app)
            .post('/api/v1/webhooks/stripe')
            .set('Stripe-Signature', 'valid-signature')
            .set('Content-Type', 'application/json')
            .send(payload);

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body.duplicate).toBe(true);
    });
});
