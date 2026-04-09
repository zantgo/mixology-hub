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
* **And** returns the Access Token in the JSON response payload (kept in Angular memory).
* **And** sets the Refresh Token via a `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict` header.

**UC 9.5: Token Expiration & Refresh**
* **Given** a user's Access Token has expired.
* **When** the user attempts an action.
* **Then** the server rejects it with `401 Unauthorized`.
* **And** the Angular HTTP Interceptor automatically attempts to hit the `/auth/refresh` endpoint using the HttpOnly Refresh Token cookie to maintain a seamless UX.
* **And** returns a new Access Token in the JSON response payload.

**UC 9.6: User Logout & Session Invalidation**
* **Given** an authenticated user is finished using the app.
* **When** they trigger `POST /auth/logout`.
* **Then** the backend blacklists the current Refresh Token (or clears the HTTP-Only cookie).
* **And** the Angular frontend clears the JWT from memory/storage.
* **And** redirects the user to the `/login` screen.

**UC 9.7: Login Brute-Force Protection (Rate Limiting)**
* **Given** an unauthenticated client or IP address.
* **When** they submit 5 consecutive invalid login attempts for an email.
* **Then** the Auth Service locks the account or blocks the IP for 15 minutes.
* **And** returns a `429 Too Many Requests` or `401 Unauthorized` with a lockout message.

**UC 9.8: Password Reset Flow (Optional but recommended for Prod)**
* **Given** a user forgot their password.
* **When** they request a password reset via `/auth/forgot-password`.
* **Then** the system generates a short-lived, single-use JWT token.
* **And** emails a secure reset link to the user.

**UC 9.9: Complete Account Deletion (GDPR)**
* **Given** an authenticated user requests account deletion.
* **When** the `DELETE /users/me` endpoint is triggered.
* **Then** the system permanently removes their `user_inventory`, `favorites`, and `profile` data.
* **And** safely anonymizes (or soft-deletes) any public Custom Cocktails they authored to prevent breaking other users' Favorites lists.
* **And** invalidates their active JWTs.

**UC 9.10: Updating User Preferences (Localization/Theme)**
* **Given** an authenticated user.
* **When** they submit a `PATCH /users/me/preferences` request with `{ "unitSystem": "imperial", "theme": "dark" }`.
* **Then** the database updates the `user_profiles` table.
* **And** the frontend state management (Signals) instantly updates the UI to reflect ounces instead of milliliters.

**UC 9.11: Email Verification Flow (Optional - Recommended for Production)**
* **Given** a new user registers an account.
* **When** they attempt to access protected API routes.
* **Then** the system checks the `is_email_verified` flag.
* **And** restricts AI generation (costly feature) until they click the secure verification token sent via Nodemailer to their inbox.
* **And** allows basic features (browsing, inventory viewing) while unverified.

**UC 9.12: Case-Insensitive Email Login**
* **Given** a user registered with email "John.Doe@Example.com".
* **When** they attempt to login with "john.doe@example.com" or "JOHN.DOE@EXAMPLE.COM".
* **Then** the authentication system normalizes emails to lowercase before comparison.
* **And** successfully authenticates the user regardless of email case.
* **And** prevents duplicate registration with different email cases.

**UC 9.13: Session Invalidation on Password Change**
* **Given** an authenticated user changes their password.
* **When** they attempt to use their old JWT token.
* **Then** the token validation checks the `token_version` field in the user record.
* **And** rejects tokens with outdated `token_version`.
* **And** forces re-authentication with the new password.

**UC 9.14: Refresh Token Reuse Detection**
* **Given** a user's refresh token is stolen and used.
* **When** the legitimate user attempts to refresh their access token.
* **Then** the system detects the refresh token reuse.
* **And** immediately invalidates all refresh tokens for that user.
* **And** sends a security alert email about suspicious activity.

**UC 9.15: Expired Verification Link & Resend Flow**
* **Given** a user's email verification link expires after 24 hours.
* **When** they click the expired link.
* **Then** the system detects the expired token.
* **And** presents a clear "Link expired" message with option to resend.
* **And** rate limits resend requests to prevent email spam.

**UC 9.16: Secure Email Change**
* **Given** a user wants to change their registered email address.
* **When** they initiate an email change request.
* **Then** the system sends a verification link to the NEW email address.
* **And** sends a security notice to the OLD email address.
* **And** only updates the email after the new address is verified.
* **And** invalidates all existing sessions after email change.

**UC 9.17: Stateless Access Token Revocation Mitigation**
* **Given** a user logs out or changes their password.
* **When** they attempt to use an access token issued before the logout/password change.
* **Then** the JWT validation checks the `last_logout_timestamp` and `token_version`.
* **And** rejects tokens issued before the `last_logout_timestamp`.
* **And** provides stateless revocation without maintaining a server-side blacklist.

**UC 9.18: Role-Based Access Control (Admin Guards)**
* **Given** a standard authenticated user attempts to call `PATCH /ingredients/:id/promote` (Global Promotion).
* **When** the request hits the API.
* **Then** the `RolesGuard` verifies the JWT payload for an `admin` role.
* **And** blocks the request with a `403 Forbidden` if the role is missing or equals `user`.
* **And** allows the request to proceed only if the role equals `admin`.
* **And** logs admin actions for audit trail purposes.

**UC 9.19: Auto-creation of User Profile**
* **Given** a new user registers successfully.
* **When** the database transaction creates the `users` row.
* **Then** it automatically inserts a linked 1-to-1 row in `user_profiles`.
* **And** applies the default system values (`unit_system: 'metric'`, `theme: 'system'`).

**UC 9.20: GDPR Data Export (Right to Access)**
* **Given** an authenticated user.
* **When** they request a data export via `GET /users/me/export`.
* **Then** the system aggregates their Profile, Inventory, Favorites, and Custom Cocktails.
* **And** returns a standardized JSON file containing all their personal data.

**UC 9.21: Recalculating Ratings on GDPR Account Deletion**
* **Given** a user has rated several public cocktails.
* **When** they trigger the `DELETE /users/me` endpoint.
* **Then** their individual rows in the `cocktail_ratings` pivot table are permanently deleted.
* **And** an asynchronous background job is triggered to recalculate and update the cached `rating` average on the `COCKTAILS` table for all affected drinks.