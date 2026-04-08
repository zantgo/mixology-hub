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