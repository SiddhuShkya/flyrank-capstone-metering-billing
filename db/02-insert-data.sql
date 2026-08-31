INSERT INTO plans (id, name, monthly_token_quota)
VALUES
    ('free', 'Free Plan', 10000),
    ('pro', 'Pro Plan', 1000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenants (id, name, created_at)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Acme Corp',   '2026-08-13T10:00:00Z'),
    ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Startup Inc', '2026-08-13T10:15:00Z'),
    -- Demo tenant: pre-loaded near its Free plan quota limit for the live demo
    ('d0000000-0000-0000-0000-000000000001', 'Demo Tenant', '2026-08-13T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (id, tenant_id, plan_id, status, stripe_customer_id, stripe_subscription_id, created_at)
VALUES
    ('123e4567-e89b-12d3-a456-426614174000', '550e8400-e29b-41d4-a716-446655440000', 'free', 'active', 'cus_test123', 'sub_test456', '2026-08-13T10:05:00Z'),
    ('223e4567-e89b-12d3-a456-426614174001', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'pro',  'active', 'cus_test789', 'sub_test012', '2026-08-13T10:15:00Z'),
    -- Demo tenant on Free plan — used for the quota boundary demo moment
    ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'free', 'active', 'cus_demo',    'sub_demo',    '2026-08-13T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- Pre-load 9700 tokens for Demo Tenant (97% of the 10 000-token Free plan limit).
-- Remaining quota = 300 tokens.
-- Demo flow:
--   Call 1 (200 input + 100 output = 300 tokens) → 200 OK, hits the exact limit
--   Call 2 (same idempotency key)                → 200 OK, idempotent_reply: true
--   Call 3 (any new tokens)                      → 429 Quota Exceeded
INSERT INTO usage_events (id, tenant_id, idempotency_key, input_tokens, output_tokens, created_at)
VALUES
    ('d0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000001', 'demo-seed-1', 3000, 1000, '2026-08-13T10:31:00Z'),
    ('d0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001', 'demo-seed-2', 2500, 1200, '2026-08-13T10:32:00Z'),
    ('d0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000001', 'demo-seed-3', 1500,  500, '2026-08-13T10:33:00Z')
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
-- Total seeded: (3000+1000) + (2500+1200) + (1500+500) = 9700 tokens
