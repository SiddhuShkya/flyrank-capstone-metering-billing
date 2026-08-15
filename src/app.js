const express = require('express');
const pool = require('./db');
const billingRoutes = require('./routes/billing.routes');

const app = express();

app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api/v1', billingRoutes);

app.get('/', (req, res) => {
    res.json({
        message: 'Metering & billing API is running',
        status: 'ok'
    });
});

app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'ok',
            database: 'connected',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            message: error.message
        });
    }
});

module.exports = app;
