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

app.get('/success', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head><title>Payment Successful</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f4f6f8;">
                <h1 style="color: #2e7d32;">Payment Successful!</h1>
                <p>Your subscription upgrade has been completed in Stripe test mode.</p>
                <p>You can close this tab and return to the terminal.</p>
            </body>
        </html>
    `);
});

app.get('/cancel', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head><title>Payment Canceled</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f4f6f8;">
                <h1 style="color: #c62828;">Payment Canceled</h1>
                <p>No charges were made and your subscription remains unchanged.</p>
            </body>
        </html>
    `);
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
