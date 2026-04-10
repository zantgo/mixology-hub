# 🔧 Domain 15: Development & Operations

**UC 15.1: Database Migration Rollback**
* **Given** a database migration introduces a breaking change.
* **When** the migration fails in production.
* **Then** TypeORM's migration system allows rolling back to the previous state.
* **And** the application continues functioning with the old schema.

**UC 15.2: Environment-Specific Configuration**
* **Given** the application runs in development, staging, and production environments.
* **When** configuration values are needed (API keys, feature flags, etc.).
* **Then** the system loads the appropriate `.env` file or configuration service.
* **And** ensures sensitive production values are never exposed in development.

**UC 15.3: Health Check Endpoints**
* **Given** the application is deployed with a load balancer or orchestrator.
* **When** the health check endpoint (`/health`) is called.
* **Then** it verifies database connectivity, Redis connectivity, and external API availability.
* **And** returns appropriate status codes for automated monitoring systems.

**UC 15.4: Database Reconnection Strategy**
* **Given** the NestJS app loses connection to PostgreSQL at runtime.
* **When** a database query is attempted during the outage.
* **Then** TypeORM's connection pool automatically retries with configured `retryAttempts` and `retryDelay`.
* **And** the application logs the connection issue but doesn't crash.
* **And** once the database is available again, connections resume automatically without requiring a restart.

**UC 15.5: Automated cleanup of transient AI recipes**
 * **Given** the `ai_generated_recipes` table contains transient recipes not linked to permanent cocktails.
 * **When** the nightly cron job (or background task) executes.
 * **Then** the system identifies records where `created_at` is older than 24 hours AND `cocktail_id IS NULL` (not saved as permanent cocktail).
 * **And** safely permanently deletes these rows to reclaim database storage.
 * **Note:** Recipes saved as permanent cocktails (`cocktail_id` not null) are preserved for historical reference even if older than 24 hours.
 * **Senior Architectural Decision: AI JSONB Storage Retention**
   * **Explicit Trade-off:** To maintain a perfect audit trail of AI generations, the system will retain the heavy JSONB payloads of AI recipes indefinitely if they were ever saved by a user, even if the resulting cocktail is subsequently soft-deleted. We accept the storage bloat cost in Postgres to ensure we can always trace back any flagged/reported public cocktail to its original LLM prompt and raw output.
   * **Edge Case:** If a user generates 50 AI recipes, saves them, and immediately deletes them (soft delete with `is_deleted = true`), the `cocktail_id` remains populated (pointing to a soft-deleted row). The cron job will never clean up these heavy JSONB rows, leading to permanent, unreferenced database bloat. We accept this as the cost of auditability.

**UC 15.6: Graceful Shutdown of Active Transactions**
* **Given** the backend receives a `SIGTERM` signal from the Docker/Kubernetes orchestrator.
* **When** there are active PostgreSQL transactions (e.g., cocktail preparation).
* **Then** the NestJS application stops accepting new HTTP requests.
* **And** waits for existing database connections and transactions to commit or rollback gracefully (up to 10 seconds) before terminating the process.
* **And** logs the shutdown process with transaction completion status for debugging.
* **And** ensures no data corruption occurs during deployment restarts.

**UC 15.7: Automated cleanup of expired preparation logs**
 * **Given** the `PREPARATION_LOGS` table contains logs older than 30 days.
 * **When** the nightly cron job executes.
 * **Then** the system permanently deletes logs where `created_at` is older than 30 days and `undone = false`.
 * **And** retains logs marked as `undone = true` for 90 days for audit purposes.
 * **And** minimizes database bloat while preserving audit trail for disputed transactions.

**UC 15.8: Automated cleanup of old sync operations**
 * **Given** the `SYNC_OPERATIONS` table contains operations older than 90 days.
 * **When** the nightly cron job executes.
 * **Then** the system permanently deletes operations where `created_at` is older than 90 days and `status = 'synced'`.
 * **And** retains failed operations (`status = 'failed'`) for 180 days for debugging purposes.
 * **And** prevents unbounded growth of the sync operations table for active mobile users.