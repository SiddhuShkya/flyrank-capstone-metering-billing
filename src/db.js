require('dotenv').config();
const { Pool } = require('pg');

const host = process.env.POSTGRES_HOST || 'localhost';
const port = process.env.POSTGRES_PORT || 5433;
const user = process.env.POSTGRES_USER || 'postgres';
const password = process.env.POSTGRES_PASSWORD || 'postgres';
const database = process.env.POSTGRES_DB || 'postgres';

const connectionString = process.env.DATABASE_URL || `postgres://${user}:${password}@${host}:${port}/${database}`;

const pool = new Pool({
    connectionString,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle Postgres client', err);
    process.exit(-1);
});

module.exports = pool;