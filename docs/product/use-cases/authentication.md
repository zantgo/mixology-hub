# 🔐 Domain 9: Authentication & Multi-Tenant Isolation

**UC 9.1: Multi-tenant Inventory Isolation**
* **Given** User A has `500 ml` of "Vodka" in their inventory.
* **And** User B has an empty inventory.
* **When** User B logs in and requests their inventory.
* **Then** the system returns an empty array.
* **And** User A's data is strictly protected via `user_id` foreign key scoping.

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
 * **And** returns the Access Token in the JSON response payload (stored in localStorage for cross-tab sync - see Senior Arch Decision below).
 * **And** sets the Refresh Token via a `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh` header to prevent the token from being sent to unrelated endpoints.
 * **Senior Architectural Decision: LocalStorage for Access Tokens**
   * **Explicit Trade-off:** To support cross-tab state synchronization (UC 7.25) and offline operation queueing (UC 12.1), we explicitly abandon the "in-memory only" access token pattern. Access Tokens will be persisted in localStorage. We accept the XSS exposure risk, mitigating it via short 15-minute token lifespans and strict CSP headers, prioritizing multi-tab/offline UX over maximal token security.

**UC 9.5: Token Expiration & Refresh**
* **Given** a user's Access Token has expired.
* **When** the user attempts an action.
* **Then** the server rejects it with `401 Unauthorized`.
* **And** the Angular HTTP Interceptor automatically attempts to hit the `/auth/refresh` endpoint using the HttpOnly Refresh Token cookie to maintain a seamless UX.
* **And** returns a new Access Token in the JSON response payload.
* **Senior Architectural Decision: Stale JWT Acceptance for Offline Queuing**
  * **Explicit Trade-off:** We explicitly accept a deviation from standard JWT lifecycle enforcement during offline mode. To support extended offline usage (e.g., 10-day camping trips), the frontend Angular application will ignore the `exp` (expiration) claim of the Access Token only when `navigator.onLine === false`. It will continue to use the cryptographically verified `user_id` from the stale JWT payload to partition local IndexedDB storage and queue operations. We trade strict local session timeouts for uninterrupted offline UX. When the device reconnects, the Sync Service will pause the queue, execute the HttpOnly refresh token rotation, and append the new valid Access Token to the pending offline payload batch before transmitting to the server.

**UC 9.6: Refresh Token Rotation & Reuse Detection**
* **Given** a user presents a valid refresh token cookie.
* **When** the `/auth/refresh` endpoint is called.
* **Then** the system validates the token against the `REFRESH_TOKENS` table (checking `hashed_token`, `is_revoked`, `expires_at`).
* **And** issues a new access token and a new refresh token (rotating the token chain).
* **And** marks the old refresh token as revoked in the database.
* **And** if the same refresh token is presented again (replay attack), the entire token family is revoked for security.

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
 * **And** cascades to delete their `user_inventory`, `favorites`, and private `cocktails`.
 * **And** anonymizes (or soft-deletes) any public Custom Cocktails they authored (setting `created_by = NULL`).
 * **And** anonymizes AI_RECIPES by setting `created_by = NULL` (preserving AI training data while severing user association).
 * **And** returns a `204 No Content` to confirm deletion.
  * **Senior Architectural Decision: GDPR Soft Anonymization Limit**
    * **Explicit Trade-off:** True GDPR "Right to be Forgotten" for user-generated text fields (recipe instructions, custom ingredient names) requires Natural Language Processing to scrub PII. For MVP, we define "Anonymization" strictly as the severing of the relational Database Foreign Key (`created_by = NULL`). We explicitly accept the risk that users may leave PII in their public recipe text, which will remain visible post-deletion. Users are responsible for editing their text before triggering account deletion.

  * **Senior Architectural Decision: Retention of Anonymized Soft-Deleted Content**
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
 * **Senior Architectural Decision: Eventual Consistency for Access Token Revocation**
   * **Explicit Trade-off:** Because we prioritize API performance (O(1) stateless JWT verification) over a Redis blocklist, we explicitly accept an "Eventual Consistency" model for Access Token revocation. When a user resets their password or changes their email, their `token_version` is incremented in PostgreSQL, but their existing Access Token remains valid in the wild until its hard 15-minute expiration time (`exp`). We trade absolute immediate security lockdown for high-performance authentication.

**UC 9.12: Email Verification (Optional)**
* **Given** a new user registers.
* **When** the `users` row is created.
* **Then** the system sets `is_email_verified: false`.
* **And** sends a verification email with a unique, time-limited link.
* **And** when the user clicks the link, the backend updates `is_email_verified: true`.

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

**UC 9.15: Refresh Token Reuse Detection with Grace Period**
 * **Given** a malicious actor steals a user's refresh token.
 * **When** they attempt to use it after the legitimate user has already refreshed.
 * **Then** the system detects the reuse (old token presented after rotation).
 * **And** applies a 5-second grace period with token caching: if the old token is presented within 5 seconds of rotation, the backend returns the EXACT SAME new access/refresh token pair that was generated for the first request.
 * **And** this prevents token family chain invalidation when multiple SPA tabs race to refresh simultaneously.
 * **And** if the old token is presented after the grace period, revokes the entire token family for that user.
 * **And** forces re-authentication on all devices for security.
 * **Implementation:** 
   * **Primary (Redis)**: When Tab A refreshes, store the generated token pair in Redis with key `refresh_grace:${userId}:${oldRefreshTokenHash}` and 5-second TTL.
   * **Fallback (PostgreSQL)**: If Redis is unavailable, the grace period is **DISABLED** and the system immediately revokes the token family on any refresh request. This prevents token family divergence where different tabs would receive different token pairs.
   * **Rationale**: Better to force re-authentication during Redis outages than risk creating multiple valid token chains that can't be coordinated.
 * **Redis Outage Mitigation**: 
   * **Short Token Expiry**: Refresh tokens expire in 24 hours (not 7 days) to limit exposure window
   * **User Notification**: Frontend shows "Service degraded - re-authentication required" message during Redis outages
   * **Monitoring**: Track Redis outage frequency and duration to assess impact
 * **Note:** The grace period prevents false positives from multi-tab SPA race conditions while maintaining security against actual token theft. During Redis outages, security takes precedence over UX to prevent token family divergence.

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

**UC 9.22: Bulk Rating Recalculation with Optimistic Concurrency**
 * **Given** a user has rated several public cocktails (potentially 2,000+).
 * **When** they trigger the `DELETE /users/me` endpoint.
 * **Then** their individual rows in the `cocktail_ratings` pivot table are permanently deleted.
 * **And** an asynchronous background job recalculates ratings using **batch optimistic updates**:
   * **Batch Processing**: Process cocktails in batches of 100 to avoid transaction size issues
   * **Atomic Updates**: Single SQL per cocktail: `UPDATE cocktails SET rating = ((rating * rating_count) - :userRating) / (rating_count - 1), rating_count = rating_count - 1 WHERE id = :cocktailId AND rating_count > 1`
   * **Zero-Rating Handling**: If `rating_count - 1 = 0`, set `rating = NULL, rating_count = 0`
   * **Conflict Resilience**: Exponential backoff retry for concurrent updates
   * **Progress Tracking**: Track completion percentage for large deletions
 * **Performance**: Avoids `SELECT FOR UPDATE` contention, enables parallel processing of batches.
 * **Monitoring**: Logs batch completion times and retry counts for operational visibility.

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
* **Then** the system automatically clears the brute-force lockout block in Redis.
* **And** allows the user to log in immediately with their new password without waiting the remaining 15 minutes.
* **And** sends a security notification email confirming the password reset and lockout clearance.

**UC 9.26: Unverified User State (Grace Period)**
* **Context:** New users have `is_email_verified: false` by default. Business decision: Allow limited functionality during 24-hour grace period.
* **Given** a user has registered but not clicked their email verification link.
* **When** they attempt to call costly endpoints like `POST /ai/generate` or create custom cocktails via `POST /cocktails`.
* **Then** the Auth Guard rejects the request with `403 Forbidden: Email verification required`.
* **Architectural Decision:** Unverified users can ONLY:
  - View public cocktails and search results
  - Browse ingredient catalog
  - Add ingredients to inventory (up to 10 items)
  - View makeable cocktails based on their inventory
* **And** the system enforces a 24-hour grace period after registration, after which ALL endpoints (except email verification) are blocked until verification is complete.
* **And** sends reminder emails at 12h and 23h post-registration to prompt verification.

**UC 9.27: Emergency Global Session Revocation (Admin Protocol)**
* **Given** a suspected system-wide breach or JWT secret compromise.
* **When** an Admin triggers the emergency global logout via `POST /admin/security/global-revoke`.
* **Then** the system increments the `global_token_salt_version` persisted in the `SYSTEM_SETTINGS` PostgreSQL table (to ensure it survives cache evictions/restarts).
* **And** subsequently updates the cached version in Redis.
* **And** publishes a Redis Pub/Sub message to all backend instances to instantly invalidate every active user session across the platform.
* **And** logs the emergency action with full admin audit trail including IP, timestamp, and reason.