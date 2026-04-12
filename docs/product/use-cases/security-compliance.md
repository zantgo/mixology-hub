# 🛡️ Domain 13: Security & Compliance

**UC 13.1: Input Sanitization for XSS Prevention**
* **Given** a user submits a custom cocktail name containing `<script>alert('xss')</script>`.
* **When** the backend processes the request.
* **Then** the input sanitization layer strips or escapes HTML tags.
* **And** stores the sanitized version in the database.

**UC 13.2: SQL Injection Prevention**
* **Given** a malicious user attempts to inject SQL via search parameters.
* **When** they submit a search for `"'; DROP TABLE users; --"`.
* **Then** TypeORM's parameterized queries prevent the injection.
* **And** the query safely treats the input as a literal string value.

**UC 13.3: API Rate Limiting Per Endpoint**
* **Given** different API endpoints have varying cost/load profiles.
* **When** a user makes requests.
* **Then** the rate limiter applies different thresholds (e.g., 5/min for AI generation, 60/min for inventory updates).
* **And** protects both cost-sensitive and performance-sensitive endpoints appropriately.
* **Architectural Decision: Rate Limiter E2E Test Evasion**
  * **Explicit Trade-off:** Because our ThrottlerGuard operates strictly in memory (per the "No Distributed State" mandate), parallel E2E testing pipelines (e.g., Playwright) running against a single test instance will instantly trigger 429 Too Many Requests blocks. We explicitly mandate that the ThrottlerGuard must instantly pass any request containing a specific pre-shared secret header (e.g., `x-test-bypass-ratelimit`) when `NODE_ENV=test`. We trade a microscopic production vulnerability (if `NODE_ENV` is accidentally misconfigured) for stable, parallelized CI/CD testing pipelines.

**UC 13.4: CSRF Protection for Refresh Token Endpoint**
* **Given** the `/auth/refresh` endpoint utilizes an `HttpOnly` cookie to issue new Access Tokens.
* **When** a `POST /auth/refresh` request is made from a cross-origin context.
* **Then** the backend validates a CSRF token (or relies on strict `SameSite=Strict` cookie policies + CORS origin validation).
* **And** rejects unauthorized automated requests to prevent session hijacking.



**UC 13.6: Pagination DoS Prevention with Page Limits**
 * **Given** a malicious script attempts to scrape the database by requesting deep pagination.
 * **When** the request hits any paginated endpoint.
 * **Then** the backend enforces page number limits (max page: 100) to prevent deep offset performance issues.
 * **And** implements rate limiting on pagination requests to prevent excessive requests.
 * **And** validates pagination parameters to prevent malformed requests.

**UC 13.7: CORS Policy Enforcement**
* **Given** a malicious site (`http://evil.com`) attempts to make an AJAX request to the MixologyHub API.
* **When** the browser sends an `OPTIONS` preflight request.
* **Then** the NestJS CORS middleware rejects the request.
* **And** ensures only whitelisted origins (e.g., `localhost:4200`, `mixologyhub.com`) return the `Access-Control-Allow-Origin` headers.
* **And** validates Origin headers against environment-configured whitelist.
* **And** includes appropriate CORS headers (`Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`) for legitimate preflight requests.

**UC 13.8: Sanitization of LLM Output**
* **Given** the LLM generates a recipe where the `instructions` field contains `<img src="x" onerror="alert('XSS')">`.
* **When** the backend parses the JSON and saves it via `save-as-cocktail`.
* **Then** the DTO validation/sanitization layer aggressively strips all HTML tags from the LLM strings before database insertion.
* **And** escapes special characters to prevent XSS attacks when the recipe is rendered on the frontend.
* **And** logs sanitization events for security auditing when malicious patterns are detected.

**UC 13.9: Rate Limiting Public Search to Prevent Scraping**
* **Given** an unauthenticated IP address querying `GET /cocktails`.
* **When** they make 100 requests in 10 seconds.
* **Then** the `ThrottlerGuard` flags the anomalous pagination/search behavior.
* **And** returns a `429 Too Many Requests` to prevent malicious scraping of the local ingredient and cocktail database.

**UC 13.10: Content Moderation & Reporting**
* **Given** a user discovers a public cocktail with inappropriate instructions or images.
* **When** they click "Report Cocktail".
* **Then** the cocktail is flagged in a new `REPORTED_CONTENT` database table.
* **And** it is temporarily hidden from the global Aggregator Search until an Admin reviews and clears/deletes it via the Admin Dashboard.
* **And** the reporting user receives confirmation that their report has been received and will be reviewed.

**UC 13.11: Admin Moderation of Reported Content**
 * **Given** a user has reported a public cocktail (creating a `REPORTED_CONTENT` row).
 * **When** an Admin reviews it and calls `PATCH /admin/reports/:id/resolve` with action `delete_cocktail`.
 * **Then** the cocktail is hard-deleted (not soft-deleted) using PostgreSQL's ON DELETE CASCADE.
 * **And** because native database cascades bypass the Node.js lifecycle, the associated `.webp` files remain orphaned in `/uploads/cocktails/` directory.
 * **And** the report status is updated to `action_taken`.
  * **And** the system automatically emails the reporting user thanking them, and attempts to email the offending author with a warning.
  * **And** maintains audit trail of moderation actions for compliance.
    * **Architectural Decision: Synchronous Email Dispatch for Moderation**
      * **Explicit Trade-off:** Because we have removed all asynchronous message queues (Redis/Bull) to simplify the architecture, moderation notification emails must be dispatched synchronously during the Admin's HTTP request. We explicitly accept that network latency or degradation from our third-party email provider will directly bottleneck the Admin's API response time, potentially resulting in 500/504 errors if the email provider hangs. We trade robust, queued email delivery for absolute backend simplicity.
    * **Architectural Decision: Admin Hard Delete vs. Analytics Preservation**
      * **Explicit Trade-off:** While user Favorites will be ruthlessly eradicated via `ON DELETE CASCADE` when an Admin hard-deletes toxic content, `PREPARATION_LOGS` will explicitly use `ON DELETE SET NULL`. We accept that orphaned preparation logs containing the offending `cocktailNameSnapshot` will remain in the database for up to 90 days (until cleaned by cron jobs). We trade immediate, absolute data eradication for the preservation of global inventory depletion metrics and system-wide usage analytics.
   * **Architectural Decision: Anonymized Author Moderation Blackhole**
     * **Explicit Trade-off:** When an Administrator takes punitive action against a reported Public Cocktail, the system attempts to email a warning to the author. We explicitly acknowledge that if the author has previously deleted their account under GDPR (UC 9.10, setting `created_by = NULL`), this notification step is impossible. The moderation service must gracefully catch this NULL reference, skip the warning email, and proceed with the cocktail deletion. We trade complete moderation feedback loops for strict GDPR compliance.
    * **Architectural Decision: Accept Silent Favorites Wiping for Moderated Content**
      * **Explicit Trade-off:** While user-driven deletions utilize a Soft Delete to protect the Favorites UX, Admin-driven moderation of toxic or reported content will execute a strict PostgreSQL Hard Delete. Because the FAVORITES table utilizes ON DELETE CASCADE, this will instantaneously and silently eradicate the recipe from all innocent users' Favorites lists without a tombstone or notification. We explicitly trade a seamless user experience for immediate, absolute legal/compliance eradication of offensive data from all relational tables.
    * **Architectural Decision: Acceptance of File System Bloat on Admin Cascading Deletes**
      * **Explicit Trade-off:** We rely on PostgreSQL's native ON DELETE CASCADE for rapid, transaction-safe Admin moderation deletions. Because native database cascades bypass the Node.js lifecycle, we cannot reliably trigger fs.unlink() to delete the associated local .webp images. We explicitly accept orphaned image files and storage bloat as a trade-off for simplified, database-level moderation compliance. We defer disk-cleanup to an infrastructure-level cron job (Phase 2) that will periodically diff the /uploads/ directory against the COCKTAILS table to purge orphaned files.
      * **Architectural Decision: Uncoordinated File Deletion (ENOENT Collisions)**
        * **Explicit Trade-off:** Because we explicitly ban distributed locks for cron execution, scaling the application vertically across multiple CPU workers means multiple processes will attempt to fs.unlink() the same orphaned .webp images simultaneously. We explicitly mandate catching and silently swallowing ENOENT (File Not Found) errors in the disk-cleanup script. We trade clean, predictable log outputs for the complete elimination of inter-process lock coordination.
    * **Architectural Decision: Ephemeral AI Audit Trails on Admin Hard-Deletes**
      * **Explicit Trade-off:** If an Administrator hard-deletes an offensive AI-generated public cocktail, the relational cascade will set the AI Recipe's foreign key to NULL, marking it for deletion by the nightly cron job (UC 15.5). We explicitly accept the destruction of the original LLM prompt audit trail upon Admin hard-deletion. We trade long-term forensic LLM auditing for aggressive database storage reclamation and immediate content removal.
  * **When** an Admin reviews a reported external API cocktail and selects "Hide Content".
  * **Then** the `external_id` is added to the `HIDDEN_EXTERNAL_COCKTAILS` blocklist.
  * **And** the `CocktailAggregatorService` automatically filters this ID out of all future unified search results.

**UC 13.12: GDPR Data Erasure & Cache Consistency**
* **Given** a user executes a GDPR Account Deletion, anonymizing their public cocktails in PostgreSQL (`created_by = NULL`).
* **When** those cocktails are currently cached in the Redis Unified Search cache.
* **Then** the JSON payloads inside Redis will continue to serve the user's name/ID until the 5-minute TTL expires.
* **Architectural Decision: Eventual Consistency for GDPR PII in Cache**
  * **Explicit Trade-off:** When a user executes a GDPR Account Deletion, their public cocktails are anonymized in PostgreSQL (`created_by = NULL`). However, if those cocktails are currently cached in the Redis Unified Search cache, the JSON payloads inside Redis will continue to serve the user's name/ID until the 5-minute TTL expires. We explicitly accept this "Eventual Consistency" for GDPR data erasure. We trade the extreme complexity of deep-scanning and mutating localized JSON blobs in Redis for high-performance cache stability.

* **Architectural Decision: Delayed PII Eradication for User Images**
  * **Explicit Trade-off:** Because we rely on database-level ON DELETE CASCADE for GDPR account deletion, we bypass the Node.js lifecycle required to synchronously trigger fs.unlink(). We explicitly accept that when a user invokes their Right to be Forgotten, any uploaded images containing PII will remain orphaned and publicly accessible on the host file system until an infrastructure-level disk-cleanup script runs. We trade immediate, cryptographic eradication of user-uploaded binary PII for the architectural simplicity of native database cascades.