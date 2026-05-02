# 🔐 Domain 9: Authentication & Access Control

> **B2B CONTEXT:** All authenticated users share the same global `bar_inventory`. There is no per-user inventory isolation. RBAC distinguishes `admin` (Bar Manager) from `bartender` (staff).

**UC 9.1: Role-Based Access to Shared Inventory**
* **Given** an admin has stocked `500 ml` of "Vodka" in the shared `bar_inventory`.
* **And** a bartender logs in and views the bar inventory.
* **Then** the system returns `500 ml` of Vodka — all staff see the same stock.
* **And** the bartender cannot add, update, or delete inventory (admin-only operations).
* **And** the `AdminGuard` enforces role restrictions on POST/PUT/DELETE `/bar-inventory`.

**UC 9.2: Protecting protected endpoints (JWT/Auth)**
* **Given** an unauthenticated client.
* **When** the client attempts to call `POST /cocktails/:id/prepare`.
* **Then** the Auth Guard blocks the request.
* **And** returns a `401 Unauthorized` without hitting the database or math engine.

**UC 9.3: User Registration & Password Hashing**
* **Given** an unauthenticated client submits a valid email and password.
* **When** `POST /auth/register` is called.
* **Then** the password is cryptographically hashed (e.g., bcrypt/argon2).
* **And** the user is saved to the database.
* **And** sensitive fields (like the hash) are stripped from the response payload.

**UC 9.4: JWT Login & Token Generation**
 * **Given** a registered user submits correct credentials.
 * **When** `POST /auth/login` is called.
 * **Then** the system validates the password hash.
 * **And** generates a signed JWT containing the `user_id`.
  * **And** returns the Access Token in the JSON response payload (stored in memory for security - see Senior Arch Decision below).
  * **Architectural Decision: In-Memory Access Tokens (XSS Mitigation)**
    * **Explicit Trade-off:** With the removal of offline queuing requirements, we no longer need persistent access to JWTs during network loss. We explicitly mandate moving the JWT Access Token out of localStorage and into strict browser memory (Angular Service closure). The Refresh Token will remain in a secure HttpOnly cookie. If a user opens a new browser tab, the application will silently hit the `/auth/refresh` endpoint to pull a fresh in-memory Access Token. We trade the slight latency of a silent background refresh on new-tab initialization for the absolute elimination of XSS token theft vulnerabilities.

**UC 9.5: Token Expiration & Refresh**
* **Given** a user's Access Token has expired.
* **When** the user attempts an action.
* **Then** the server rejects it with `401 Unauthorized`.
* **And** the Angular HTTP Interceptor automatically attempts to hit the `/auth/refresh` endpoint using the HttpOnly Refresh Token cookie to maintain a seamless UX.
  * **And** returns a new Access Token in the JSON response payload.

**UC 9.6: Refresh Token Rotation & Reuse Detection**
* **Given** a user presents a valid refresh token cookie.
* **When** the `/auth/refresh` endpoint is called.
* **Then** the system validates the token against the `REFRESH_TOKENS` table (checking `hashed_token`, `is_revoked`, `expires_at`).
* **And** issues a new access token and a new refresh token (rotating the token chain).
* **And** marks the old refresh token as revoked in the database.
* **And** if the same refresh token is presented again (replay attack), the entire token family is revoked for security.
  * **Architectural Decision: False-Positive Session Revocation on Concurrent Token Refresh**
  * **Explicit Trade-off:** To maintain backend architectural simplicity, we explicitly refuse to implement atomic locking around the /auth/refresh endpoint. We acknowledge that benign concurrent network requests from a single client (e.g., rapid double-clicks or multi-tab loading on an expired token) may trigger the "Refresh Token Reuse" security protocol, resulting in a false-positive invalidation of the user's entire token family. We explicitly trade robust multi-tab session stability for absolute backend architectural simplicity and zero locking overhead.

* **Architectural Decision: Session Destruction on Network Drop during Token Rotation**
  * **Explicit Trade-off:** We explicitly accept that if an HTTP response containing a newly rotated HttpOnly refresh token is lost to network packet drop, the client's automated HTTP retry will present the invalidated token, triggering our Token Reuse Defense. This will immediately terminate all of the user's active sessions. We trade resilient connection recovery for absolute token theft protection and simplified, lock-free backend architecture.

**UC 9.7: User Logout & Session Invalidation**
* **Given** an authenticated user is finished using the app.
* **When** they trigger `POST /auth/logout`.
* **Then** the backend blacklists the current Refresh Token (or clears the HTTP-Only cookie).
* **And** the Angular frontend clears the JWT from memory/storage.
* **And** redirects the user to the `/login` screen.

**UC 9.8: Login Brute-Force Protection (Rate Limiting)**
* **Given** an unauthenticated client or IP address.
* **When** they submit 5 consecutive invalid login attempts for an email.
* **Then** the Auth Service locks the account or blocks the IP for 15 minutes.
* **And** returns a `429 Too Many Requests` or `401 Unauthorized` with a lockout message.

**UC 9.9: Role-Based Access Control (RBAC) for Admins**
* **Given** the database contains a user with `role: 'admin'`.
* **When** they attempt to call `POST /admin/ingredients/synonyms`.
* **Then** the Auth Guard validates the JWT's `role` claim.
* **And** grants access to the protected admin endpoint.

**UC 9.10: GDPR Account Deletion (Right to be Forgotten)**
 * **Given** an authenticated user.
 * **When** they trigger the `DELETE /users/me` endpoint.
 * **Then** the system permanently deletes their `users` row.
 * **And** cascades to delete their `favorites`, and private `cocktails`.
 * **And** their `bartender_id` in `PREPARATION_LOGS` is set to NULL (`ON DELETE SET NULL`), preserving preparation history.
 * **Note:** The shared `bar_inventory` is NOT affected by bartender account deletion, as it belongs to the bar, not any individual user.
 * **And** anonymizes (or soft-deletes) any public Custom Cocktails they authored (setting `created_by = NULL`).
 * **And** anonymizes AI_RECIPES by setting `created_by = NULL` (preserving AI training data while severing user association).
 * **And** returns a `204 No Content` to confirm deletion.
  * **Architectural Decision: GDPR Soft Anonymization Limit**
    * **Explicit Trade-off:** True GDPR "Right to be Forgotten" for user-generated text fields (recipe instructions, custom ingredient names) requires Natural Language Processing to scrub PII. For MVP, we define "Anonymization" strictly as the severing of the relational Database Foreign Key (`created_by = NULL`). We explicitly accept the risk that users may leave PII in their public recipe text, which will remain visible post-deletion. Users are responsible for editing their text before triggering account deletion.

  * **Architectural Decision: Retention of Anonymized Soft-Deleted Content**
    * **Explicit Trade-off:** When a user triggers GDPR account deletion, any of their Public Cocktails that were previously "Soft Deleted" (to preserve other users' Favorites) will be stripped of their `created_by` foreign key but will remain in the database indefinitely. We explicitly accept accumulating these "ownerless ghost records" in our database to ensure that historical Favorites and Preparation Logs belonging to other users are never abruptly broken.

**UC 9.11: Password Reset Flow**
 * **Given** a user forgets their password.
 * **When** they request a password reset via `POST /auth/forgot-password`.
 * **Then** the system generates a time-limited, single-use token.
 * **And** emails it to the user's registered email address.
 * **And** when the user submits the token + new password via `POST /auth/reset-password`, the system validates the token and updates the password hash.
 * **And** increments the user's `token_version` in the database to invalidate all active JWT access tokens.
 * **And** revokes all refresh tokens for that user by setting `is_revoked = true` on all rows in the `REFRESH_TOKENS` table where `user_id = :userId`.
 * **And** forces re-authentication on all devices for security.
  * **Architectural Decision: Eventual Consistency for Access Token Revocation**
    * **Explicit Trade-off:** Because we prioritize API performance (O(1) stateless JWT verification) over a Redis blocklist, we explicitly accept an "Eventual Consistency" model for Access Token revocation. When a user resets their password or changes their email, their `token_version` is incremented in PostgreSQL, but their existing Access Token remains valid in the wild until its hard 15-minute expiration time (`exp`). We trade absolute immediate security lockdown for high-performance authentication.
  * **Architectural Decision: Synchronous Email Dispatch**
    * **Explicit Trade-off:** Because we have removed all asynchronous message queues (Redis/Bull) to simplify the architecture, outbound transactional emails (Password Resets, Moderation Warnings) must be dispatched synchronously during the active HTTP request. We explicitly accept that network latency or degradation from our third-party email provider will directly bottleneck the user's API response time, potentially resulting in 500/504 errors if the email provider hangs. We trade robust, queued email delivery for absolute backend simplicity.

**UC 9.12: Email Verification (Optional)**
* **Given** a new user registers.
* **When** the `users` row is created.
* **Then** the system sets `is_email_verified: false`.
* **And** sends a verification email with a unique, time-limited link.
* **And** when the user clicks the link, the backend updates `is_email_verified: true`.
* **Architectural Decision: Eventual Consistency for Stateless JWT Verification Flags**
  * **Explicit Trade-off:** Because we prioritize API performance via stateless JWT verification, a user's `is_verified` status is baked into the token payload upon login. We explicitly accept that when a user clicks their email verification link, their active Access Token will remain stale (`is_verified: false`) until its natural 15-minute expiration triggers a silent refresh, or until the user manually logs out and logs back in. We trade immediate UI gratification upon email verification for high-performance, I/O-free authentication routing.

**UC 9.13: Concurrent Session Management**
* **Given** a user is logged in on their laptop.
* **And** they log in again on their phone.
* **When** both sessions are active.
* **Then** both refresh tokens are stored in separate `REFRESH_TOKENS` rows.
* **And** both can independently refresh their access tokens.
* **And** if the user logs out from one device, only that specific refresh token is revoked.

**UC 9.14: Selective JWT Blacklisting on Standard Logout**
* **Given** a user logs out from their current device.
* **When** the `POST /auth/logout` endpoint is called.
* **Then** the system marks *only* the specific `refresh_token` presented in the request as `is_revoked = true` in the `REFRESH_TOKENS` table.
* **And** clears the HttpOnly cookie for that specific device.
* **And** explicitly DOES NOT increment the user's `token_version`, preserving their active sessions on other devices (phones, tablets).
* **Architectural Decision: Device-Agnostic Access Token Invalidation**
  * **Explicit Trade-off:** To maintain database simplicity, we use a single `last_logout_timestamp` column per user rather than tracking device-specific session fingerprints. We explicitly accept that logging out on Device A will immediately invalidate the active Access Token on Device B. Because Device B's Refresh Token remains valid, we rely on the frontend HTTP interceptor to seamlessly catch the 401, silently refresh the token, and retry the request. We trade absolute multi-device isolation for a lightweight authentication schema.

**UC 9.15: SIMPLIFIED - Basic Refresh Token Handling**
 * **Given** a user's refresh token is used.
 * **When** the `/auth/refresh` endpoint is called.
 * **Then** basic token validation is performed.
 * **Note**: No 5-second grace period, Redis caching, or multi-tab race condition prevention. Simple token refresh only.

**UC 9.16: Token Family Rotation on Suspicious Activity**
* **Given** the system detects suspicious activity (e.g., refresh token reuse).
* **When** a security event is triggered.
* **Then** the system revokes all refresh tokens for that user's token family.
* **And** requires fresh login on all devices.
* **And** logs the security event for auditing.

**UC 9.17: Session Timeout & Auto-Logout**
* **Given** an authenticated user is inactive for 24 hours.
* **When** their refresh token expires.
* **Then** the next API call fails with `401 Unauthorized`.
* **And** the Angular interceptor redirects to the login page.
* **And** clears any cached user data from memory.

**UC 9.18: Multi-Device Session Limits**
* **Given** a security policy limits users to 5 concurrent sessions.
* **When** a user attempts to log in on a 6th device.
* **Then** the system revokes the oldest active refresh token.
* **And** allows the new login to proceed.
* **And** notifies the user via email about the session revocation.

**UC 9.19: Password Strength Enforcement**
* **Given** a user attempts to register or change their password.
* **When** the password fails complexity requirements (length, special chars, etc.).
* **Then** the validation layer rejects the request with a `400 Bad Request`.
* **And** provides clear feedback on the missing requirements.

**UC 9.20: Automatic Profile Creation on Registration**
* **Given** a new user successfully registers.
* **When** the database transaction creates the `users` row.
* **Then** it automatically inserts a linked 1-to-1 row in `user_profiles`.
* **And** applies the default system values (`unit_system: 'metric'`, `theme: 'system'`).

**UC 9.21: GDPR Data Export (Right to Access)**
* **Given** an authenticated user.
* **When** they request a data export via `GET /users/me/export`.
* **Then** the system aggregates their Profile, Inventory, Favorites, and Custom Cocktails.
* **And** returns a standardized JSON file containing all their personal data.
* **Architectural Decision: Synchronous GDPR Export Timeout Risk**
  * **Explicit Trade-off:** Because we stripped out background task queuing and asynchronous file-delivery systems to maintain a simple MVP architecture, the GDPR JSON data compilation executes synchronously within the HTTP request. We explicitly accept that users with massive data profiles may exceed standard Reverse Proxy timeouts (e.g., 30 seconds), resulting in a 504 Gateway Timeout. Users hitting this limit must manually delete data to reduce their footprint before exporting.

**UC 9.22: Bulk Rating Recalculation (Simplified)**
 * **Given** a user has rated several public cocktails (potentially 2,000+).
 * **When** they trigger the `DELETE /users/me` endpoint.
 * **Then** their individual rows in the `cocktail_ratings` pivot table are permanently deleted via PostgreSQL `ON DELETE CASCADE`.
 * **And** the system does NOT attempt to recalculate ratings synchronously or asynchronously.
  * **Architectural Decision: Deprecation of the GDPR Rating Recalculation Worker**
    * **Explicit Trade-off:** To resolve the race condition between PostgreSQL ON DELETE CASCADE destroying pivot data and the backend attempting to subtract those ratings, we explicitly deprecate the GdprRatingRecalculationService and all asynchronous batch-processing queues for rating deletions. No background worker will be built to handle GDPR rating math. We explicitly accept that average ratings on the COCKTAILS table will remain mathematically inflated when a user deletes their account, trading absolute mathematical purity for vast architectural simplification and guaranteed database integrity.

  * **Architectural Decision: Delayed PII Eradication for User Images**
    * **Explicit Trade-off:** Because we rely on database-level ON DELETE CASCADE for GDPR account deletion, we bypass the Node.js lifecycle required to synchronously trigger fs.unlink(). We explicitly accept that when a user invokes their Right to be Forgotten, any uploaded images containing PII will remain orphaned and publicly accessible on the host file system until an infrastructure-level disk-cleanup script runs. We trade immediate, cryptographic eradication of user-uploaded binary PII for the architectural simplicity of native database cascades.
    * **Mitigation:** We defer disk-cleanup to an infrastructure-level cron job (Phase 2) that will periodically diff the /uploads/ directory against the COCKTAILS table to purge orphaned files.

**UC 9.23: GDPR Anonymization of Analytics & Logs**
* **Given** a user has 50 entries in `PREPARATION_LOGS` and 2 entries in `REPORTED_CONTENT`.
* **When** they trigger `DELETE /users/me` (GDPR Account Deletion).
* **Then** the database transaction safely sets `user_id = NULL` on their `PREPARATION_LOGS` to preserve global cocktail preparation analytics.
* **And** sets `reported_by = NULL` on `REPORTED_CONTENT` to keep the reports active for Admin review.
* **And** successfully deletes the `users` row without Foreign Key constraint violations.
* **And** maintains referential integrity while anonymizing personally identifiable information from logs and reports.

**UC 9.24: Updating User Preferences**
* **Given** an authenticated user calls `PATCH /users/me/preferences` with `{ "theme": "dark" }`.
* **When** the validation pipe processes the request.
* **Then** it updates the `USER_PROFILES` table.
* **And** ignores/strips any attempts to patch protected fields (e.g., `user_id` or `role`).
* **And** returns the updated preferences to the frontend for immediate UI synchronization via Angular Signals.

**UC 9.25: Account Lockout Recovery (Brute Force)**
* **Given** a user's account is locked for 15 minutes due to 5 failed login attempts (UC 9.8).
* **When** the user successfully executes the "Forgot Password" flow and resets their password.
* **Then** the system automatically clears the brute-force lockout block in the local in-memory Map.
* **And** allows the user to log in immediately with their new password without waiting the remaining 15 minutes.
* **And** sends a security notification email confirming the password reset and lockout clearance.
  * **Architectural Decision: Local Lockout Clearance & Cluster Bypass Risk**
    * **Explicit Trade-off:** Because we store brute-force lockouts in a local in-memory Map rather than Redis, clearing a lockout via a password reset only clears the block on the specific Node.js worker process that handled the request. We explicitly accept that a user could theoretically remain temporarily locked out on other worker processes in the cluster. We trade absolute cross-cluster state synchronization for the complete elimination of distributed caching for brute-force protection.

**UC 9.26: Unverified User State (Grace Period)**
* **Context:** New users have `is_email_verified: false` by default. Business decision: Allow limited functionality during 24-hour grace period.
* **Given** a user has registered but not clicked their email verification link.
* **When** they attempt to call costly endpoints like `POST /ai/generate` or create custom cocktails via `POST /cocktails`.
* **Then** the Auth Guard rejects the request with `403 Forbidden: Email verification required`.
 * **Architectural Decision:** Unverified users can ONLY:
   - View public cocktails and search results
   - Browse ingredient catalog
   - View makeable cocktails based on the bar inventory
 * **And** the system enforces a 24-hour grace period after registration, after which ALL endpoints (except email verification) are blocked until verification is complete.
 * **Architectural Decision: Abandonment of Time-Delayed Transactional Emails**
   * **Explicit Trade-off:** We explicitly abandon the 12-hour and 23-hour unverified email reminders. We trade automated user-retention marketing loops for absolute backend architectural purity.

**UC 9.27: Emergency Global Session Revocation (Admin Protocol)**
* **Given** a suspected system-wide breach or JWT secret compromise.
* **When** an Admin triggers the emergency global logout via `POST /admin/security/global-revoke`.
* **Then** the system increments the `global_token_salt_version` persisted in the `SYSTEM_SETTINGS` PostgreSQL table.
* **And** logs the emergency action with full admin audit trail including IP, timestamp, and reason.
 * **Architectural Decision: Database-Only Global Revocation**
   * **Explicit Trade-off:** Emergency global session revocation increments a `global_token_salt_version` in the PostgreSQL database. We explicitly accept that the backend must query the database on every authenticated request (or rely on short TTL local caches) to verify the salt version. We trade immediate, sub-millisecond global memory synchronization for a radically simplified authentication architecture.