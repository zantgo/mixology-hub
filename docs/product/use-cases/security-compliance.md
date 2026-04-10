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

**UC 13.4: CSRF Protection for Refresh Token Endpoint**
* **Given** the `/auth/refresh` endpoint utilizes an `HttpOnly` cookie to issue new Access Tokens.
* **When** a `POST /auth/refresh` request is made from a cross-origin context.
* **Then** the backend validates a CSRF token (or relies on strict `SameSite=Strict` cookie policies + CORS origin validation).
* **And** rejects unauthorized automated requests to prevent session hijacking.

**UC 13.5: SSRF and Client IP Leakage Prevention via Secure Image Proxy**
 * **Given** a user submits a custom cocktail with an `image_url`.
 * **Then** the validation layer strictly enforces the `https://` protocol (rejecting `http://`, `file://`, `javascript:`).
 * **And** the backend DNS resolver checks the hostname to explicitly reject routing to internal or private IP ranges (e.g., `10.x.x.x`, `127.0.0.1`, `169.254.169.254`, `localhost`).
 * **And** the backend Image Proxy Service fetches the image through a secure proxy with:
   * **Content Validation**: Validates image format, size (max 5MB), and content type
   * **Security Controls**: Timeouts (5s), redirect limits (2), and request filtering
   * **Caching**: 24-hour cache to improve performance and reduce external requests
   * **Abuse Prevention**: Rate limiting per user and per domain
 * **And** the frontend loads images via the secure proxy endpoint (`/api/images/proxy`) to prevent client IP leakage to external domains.
 * **And** users are shown a privacy notice explaining that their IP address is protected when viewing external images.
 * **And** if the proxy fails, the frontend shows a secure fallback image with appropriate error messaging.

**UC 13.6: Pagination Cursor-Based DoS Prevention**
 * **Given** a malicious script attempts to scrape the database by requesting deep pagination.
 * **When** the request hits the Aggregator or Inventory service.
 * **Then** the backend enforces cursor-based pagination which inherently prevents deep offset performance issues.
 * **And** implements rate limiting on cursor generation to prevent excessive pagination requests.
 * **And** validates cursor format to prevent malformed cursor attacks.

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
 * **And** the report status is updated to `action_taken`.
 * **And** the system automatically emails the reporting user thanking them, and attempts to email the offending author with a warning.
 * **And** maintains audit trail of moderation actions for compliance.
   * **Senior Architectural Decision: Admin Hard Delete vs. Analytics Preservation**
     * **Explicit Trade-off:** While user Favorites will be ruthlessly eradicated via `ON DELETE CASCADE` when an Admin hard-deletes toxic content, `PREPARATION_LOGS` will explicitly use `ON DELETE SET NULL`. We accept that orphaned preparation logs containing the offending `cocktailNameSnapshot` will remain in the database for up to 90 days (until cleaned by cron jobs). We trade immediate, absolute data eradication for the preservation of global inventory depletion metrics and system-wide usage analytics.
   * **Senior Architectural Decision: Anonymized Author Moderation Blackhole**
     * **Explicit Trade-off:** When an Administrator takes punitive action against a reported Public Cocktail, the system attempts to email a warning to the author. We explicitly acknowledge that if the author has previously deleted their account under GDPR (UC 9.10, setting `created_by = NULL`), this notification step is impossible. The moderation service must gracefully catch this NULL reference, skip the warning email, and proceed with the cocktail deletion. We trade complete moderation feedback loops for strict GDPR compliance.
   * **Senior Architectural Decision: Accept Silent Favorites Wiping for Moderated Content**
     * **Explicit Trade-off:** While user-driven deletions utilize a Soft Delete to protect the Favorites UX, Admin-driven moderation of toxic or reported content will execute a strict PostgreSQL Hard Delete. Because the FAVORITES table utilizes ON DELETE CASCADE, this will instantaneously and silently eradicate the recipe from all innocent users' Favorites lists without a tombstone or notification. We explicitly trade a seamless user experience for immediate, absolute legal/compliance eradication of offensive data from all relational tables.
 * **When** an Admin reviews a reported external API cocktail and selects "Hide Content".
 * **Then** the `external_id` is added to the `HIDDEN_EXTERNAL_COCKTAILS` blocklist.
 * **And** the `CocktailAggregatorService` automatically filters this ID out of all future unified search results.