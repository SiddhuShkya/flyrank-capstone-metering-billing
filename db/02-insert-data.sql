INSERT INTO plans (id, name, monthly_token_quota)
VALUES
    ('free', 'Free Plan', 10000),
    ('pro', 'Pro Plan', 1000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenants (id, name, created_at)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Acme Corp', '2026-08-13T10:00:00Z'),
    ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Startup Inc', '2026-08-13T10:15:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (id, tenant_id, plan_id, status, stripe_customer_id, stripe_subscription_id, created_at)
VALUES
    ('123e4567-e89b-12d3-a456-426614174000', '550e8400-e29b-41d4-a716-446655440000', 'free', 'active', 'cus_test123', 'sub_test456', '2026-08-13T10:05:00Z'),
    ('223e4567-e89b-12d3-a456-426614174001', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'pro', 'active', 'cus_test789', 'sub_test012', '2026-08-13T10:15:00Z')
ON CONFLICT (id) DO NOTHING;
