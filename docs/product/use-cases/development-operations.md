# 🔧 Domain 14: Development & Operations

**UC 14.1: Database Migration Rollback**
* **Given** a database migration introduces a breaking change.
* **When** the migration fails in production.
* **Then** TypeORM's migration system allows rolling back to the previous state.
* **And** the application continues functioning with the old schema.

**UC 14.2: Environment-Specific Configuration**
* **Given** the application runs in development, staging, and production environments.
* **When** configuration values are needed (API keys, feature flags, etc.).
* **Then** the system loads the appropriate `.env` file or configuration service.
* **And** ensures sensitive production values are never exposed in development.

**UC 14.3: Health Check Endpoints**
* **Given** the application is deployed with a load balancer or orchestrator.
* **When** the health check endpoint (`/health`) is called.
* **Then** it verifies database connectivity, Redis connectivity, and external API availability.
* **And** returns appropriate status codes for automated monitoring systems.

**UC 14.4: Database Reconnection Strategy**
* **Given** the NestJS app loses connection to PostgreSQL at runtime.
* **When** a database query is attempted during the outage.
* **Then** TypeORM's connection pool automatically retries with configured `retryAttempts` and `retryDelay`.
* **And** the application logs the connection issue but doesn't crash.
* **And** once the database is available again, connections resume automatically without requiring a restart.

**UC 14.5: Automated cleanup of transient AI recipes**
* **Given** the `ai_generated_recipes` table contains transient recipes not linked to permanent cocktails.
* **When** the nightly cron job (or background task) executes.
* **Then** the system identifies records where `created_at` is older than 24 hours.
* **And** safely permanently deletes these rows to reclaim database storage.