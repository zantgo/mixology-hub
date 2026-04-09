# 🛡️ Domain 12: Security & Compliance

**UC 12.1: Input Sanitization for XSS Prevention**
* **Given** a user submits a custom cocktail name containing `<script>alert('xss')</script>`.
* **When** the backend processes the request.
* **Then** the input sanitization layer strips or escapes HTML tags.
* **And** stores the sanitized version in the database.

**UC 12.2: SQL Injection Prevention**
* **Given** a malicious user attempts to inject SQL via search parameters.
* **When** they submit a search for `"'; DROP TABLE users; --"`.
* **Then** TypeORM's parameterized queries prevent the injection.
* **And** the query safely treats the input as a literal string value.

**UC 12.3: API Rate Limiting Per Endpoint**
* **Given** different API endpoints have varying cost/load profiles.
* **When** a user makes requests.
* **Then** the rate limiter applies different thresholds (e.g., 5/min for AI generation, 60/min for inventory updates).
* **And** protects both cost-sensitive and performance-sensitive endpoints appropriately.

**UC 12.4: CSRF Protection for State-Changing Requests (Conditional - If using HTTP-Only cookies)**
* **Given** the application uses HTTP-Only cookies for authentication.
* **When** a `POST`, `PUT`, or `DELETE` request is made from an unauthorized origin or missing a CSRF token.
* **Then** the global CSRF middleware intercepts the request.
* **And** rejects it with a `403 Forbidden` error.

**UC 12.5: SSRF and Malicious Image URL Protection**
* **Given** a malicious user submits a custom cocktail with an `image_url` pointing to an internal IP (e.g., `http://169.254.169.254` or `javascript:alert(1)`).
* **When** the `POST /cocktails` endpoint receives the request.
* **Then** the validation layer strictly enforces `http://` or `https://` protocols.
* **And** the frontend sanitizes the URL via Angular's `DomSanitizer` before binding to the `src` attribute.
* **And** the backend never fetches the URL directly (preventing SSRF).

**UC 12.6: Pagination Deep-Offset DoS Prevention**
* **Given** a malicious script attempts to scrape the database by requesting `limit=100&page=999999`.
* **When** the request hits the Aggregator or Inventory service.
* **Then** the backend enforces a hard cap on maximum pagination depth (e.g., max 100 pages).
* **And** returns a `400 Bad Request` to prevent high CPU/Memory load from massive offset scans.
* **And** implements cursor-based pagination where possible to avoid offset-based performance degradation.

**UC 12.7: CORS Policy Enforcement**
* **Given** a malicious site (`http://evil.com`) attempts to make an AJAX request to the MixologyHub API.
* **When** the browser sends an `OPTIONS` preflight request.
* **Then** the NestJS CORS middleware rejects the request.
* **And** ensures only whitelisted origins (e.g., `localhost:4200`, `mixologyhub.com`) return the `Access-Control-Allow-Origin` headers.
* **And** validates Origin headers against environment-configured whitelist.
* **And** includes appropriate CORS headers (`Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`) for legitimate preflight requests.

**UC 12.8: Sanitization of LLM Output**
* **Given** the LLM generates a recipe where the `instructions` field contains `<img src="x" onerror="alert('XSS')">`.
* **When** the backend parses the JSON and saves it via `save-as-cocktail`.
* **Then** the DTO validation/sanitization layer aggressively strips all HTML tags from the LLM strings before database insertion.
* **And** escapes special characters to prevent XSS attacks when the recipe is rendered on the frontend.
* **And** logs sanitization events for security auditing when malicious patterns are detected.

**UC 12.9: Rate Limiting Public Search to Prevent Scraping**
* **Given** an unauthenticated IP address querying `GET /cocktails`.
* **When** they make 100 requests in 10 seconds.
* **Then** the `ThrottlerGuard` flags the anomalous pagination/search behavior.
* **And** returns a `429 Too Many Requests` to prevent malicious scraping of the local ingredient and cocktail database.