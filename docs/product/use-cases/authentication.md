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
* **And** returns the token (or sets it in an HTTP-Only cookie).

**UC 9.5: Token Expiration & Refresh**
* **Given** a user's JWT has expired.
* **When** the user attempts an action.
* **Then** the server rejects it with `401 Unauthorized`.
* **And** the Angular HTTP Interceptor automatically attempts to hit the `/auth/refresh` endpoint using a stored Refresh Token to maintain a seamless UX.

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