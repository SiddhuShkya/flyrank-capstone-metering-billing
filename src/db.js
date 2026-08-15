require('dotenv').config();
const { Pool } = require('pg');

const host = process.env.POSTGRES_HOST;
const port = Number(process.env.POSTGRES_PORT);
const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const database = process.env.POSTGRES_DB;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle Postgres client', err);
    process.exit(-1);
});

module.exports = pool;