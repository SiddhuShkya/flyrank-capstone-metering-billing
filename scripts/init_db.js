const pool = require('../src/db');

async function initDB() {
    const client = await pool.connect();
    try {
        console.log('Starting database initialization...');
        await client.query('BEGIN');

        // Create tenants table
        await client.query(`
            CREATE TABLE IF NOT EXISTS tenants (
                id UUID PRIMARY KEY,
                name VARCHAR NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create plans table
        await client.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                monthly_token_quota INTEGER NOT NULL
            );
        `);

        // Create subscriptions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id),
                plan_id VARCHAR REFERENCES plans(id),
                status VARCHAR NOT NULL,
                stripe_customer_id VARCHAR,
                stripe_subscription_id VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create usage_events table
        await client.query(`
            CREATE TABLE IF NOT EXISTS usage_events (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id),
                idempotency_key VARCHAR NOT NULL,
                input_tokens INTEGER NOT NULL,
                output_tokens INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (tenant_id, idempotency_key)
            );
        `);

        // Seed initial plans
        await client.query(`
            INSERT INTO plans (id, name, monthly_token_quota) 
            VALUES 
                ('free', 'Free Plan', 10000),
                ('pro', 'Pro Plan', 1000000)
            ON CONFLICT (id) DO NOTHING;
        `);

        // Seed a test tenant and subscription
        await client.query(`
            INSERT INTO tenants (id, name, created_at)
            VALUES 
                ('550e8400-e29b-41d4-a716-446655440000', 'Acme Corp', '2026-08-13T10:00:00Z'),
                ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Startup Inc', '2026-08-13T10:15:00Z')
            ON CONFLICT (id) DO NOTHING;
        `);

        await client.query(`
            INSERT INTO subscriptions (id, tenant_id, plan_id, status, stripe_customer_id, stripe_subscription_id, created_at)
            VALUES 
                ('123e4567-e89b-12d3-a456-426614174000', '550e8400-e29b-41d4-a716-446655440000', 'free', 'active', 'cus_test123', 'sub_test456', '2026-08-13T10:05:00Z'),
                ('223e4567-e89b-12d3-a456-426614174001', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'pro', 'active', 'cus_test789', 'sub_test012', '2026-08-13T10:15:00Z')
            ON CONFLICT (id) DO NOTHING;
        `);

        await client.query('COMMIT');
        console.log('Database initialized successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during database initialization:', error);
    } finally {
        client.release();
        process.exit();
    }
}

initDB();
