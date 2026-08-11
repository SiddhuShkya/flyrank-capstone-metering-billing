# Usage Metering & Billing Engine

A backend service every SaaS needs that tells you: 
- How much has this customer used?
- What does it cost?
- Have they hit their limit? 

Metering, quotas, correct money math, and Stripe test mode — where correctness really matters.

## Tech Stack
- **Node.js + Express**: Used for building the API endpoints. It is lightweight, widely understood, and great for building simple RESTful services.
- **PostgreSQL**: Used for relational data storage (tenants, subscriptions, usage events). Crucial for data consistency and reliable SQL math.
- **Docker**: Used to easily spin up a PostgreSQL instance without requiring manual database installations.

## Setup & Local Development

This project relies on Docker for the database and Node.js for the API. It is designed to be beginner-friendly.

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in the placeholders in `.env` if needed, though the defaults will work out-of-the-box with Docker Compose.

### 2. Run with Docker Compose (Recommended)
This will start both the PostgreSQL database and the Node.js API:
```bash
docker compose up
```

The API will be available at http://localhost:3000. 

### Database Connection Configuration
If you want to run the app outside of Docker (e.g., using `npm run dev`), make sure the Postgres container is running.
The connection is configured via the `DATABASE_URL` environment variable in your `.env` file. By default, it connects to:
`postgres://YOUR_POSTGRES_USERNAME:YOUR_POSTGRES_PASSWORD@localhost:5433/YOUR_POSTGRES_DB_NAME` (note that we expose port 5433 to the host machine in `docker-compose.yml` to avoid conflicts).

### 3. Run Locally (Alternative)
First, ensure you've started the database using Docker Compose:
```bash
docker compose up postgres -d
```
Then, install dependencies and start the app in watch mode:
```bash
npm install
npm run dev
```
