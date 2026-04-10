# 💻 Domain 7: Frontend UI & Reactivity (Angular)

**UC 7.1: Real-time UI updates via Signals**
* **Given** the user views their inventory and the "Makeable Cocktails" list.
* **When** the user clicks "Prepare" on a makeable cocktail.
* **Then** the HTTP request resolves successfully.
* **And** the Angular Signals managing inventory state trigger a surgical DOM update.
* **And** the inventory quantities decrement instantly on-screen without a full page reload.

**UC 7.2: RxJS Search Debouncing**
* **Given** the user is typing "M-a-r-g-a-r-i-t-a" rapidly into the unified search bar.
* **When** keystrokes are registered.
* **Then** the RxJS `debounceTime(300)` and `switchMap` operators prevent an API call for every letter.
* **And** only one HTTP API call is fired 300ms after the user stops typing.

**UC 7.3: Dynamic Recipe Creation Forms**
* **Given** the user is creating a custom recipe using the UI.
* **When** the user clicks "Add Ingredient".
* **Then** the Angular `FormArray` dynamically adds a new set of validation fields (Ingredient, Measure, Unit).
* **And** the "Save" button remains disabled until all dynamic rows are fully populated and valid.

**UC 7.4: Graceful UI Error States (Global Interceptor)**
* **Given** the backend returns a `400` or `500` error during any HTTP request.
* **When** the Angular `HttpClient` receives the response.
* **Then** a global HTTP Interceptor catches the error.
* **And** displays a user-friendly Toast Notification without breaking the UI state or requiring a page reload.

**UC 7.5: Empty States**
* **Given** a brand new user navigates to "My Inventory".
* **When** the API returns an empty array.
* **Then** the UI displays an intuitive "Empty State" component (e.g., "Your bar is empty! Click here to add ingredients") rather than a blank screen or a data-grid with no rows.

**UC 7.6: Protected Frontend Routes**
* **Given** an unauthenticated user visits the site.
* **When** they attempt to navigate to `/my-inventory`.
* **Then** the Angular Route Guard intercepts the navigation.
* **And** redirects the user to the `/login` page.

**UC 7.7: Infinite Scrolling / Load More Data**
 * **Given** the user has loaded the first page of the Unified Search results.
 * **When** the user scrolls to the bottom of the list (or clicks "Load More").
 * **Then** the Angular UI triggers the API with the `cursor` parameter from the previous response.
 * **And** the Signals/RxJS streams append the new results to the *existing* array without flashing or resetting the UI.

**UC 7.8: User-Preferred Measurement System (Localization)**
* **Given** the user's settings are configured to "Imperial" (oz).
* **And** the backend returns a cocktail requiring `59.14 ml` of Gin.
* **When** the UI renders the cocktail details or preparation screen.
* **Then** the Angular frontend (via a generic Pipe or Service) automatically converts and displays `2 oz`.
* **And** input forms for inventory automatically default to their preferred unit.

**UC 7.9: Cocktail Image Display with Fallback**
* **Given** a cocktail card component receives a cocktail object with optional `imageUrl`.
* **When** the component renders the cocktail image.
* **Then** it attempts to load the image from the provided URL.
* **And** shows a loading skeleton/placeholder during image fetch.
* **And** if the URL fails to load (404, network error, or invalid), falls back to default local image (`/assets/images/cocktails/default/cocktail-placeholder.jpg`).
* **And** maintains aspect ratio and responsive sizing across different screen sizes.
* **And** logs image loading failures to analytics without breaking the UI.

**UC 7.10: Optimistic Update Rollback**
* **Given** the user clicks "Prepare" and the Signal optimistically deducts inventory.
* **When** the backend returns a `500 Server Error` or network drops.
* **Then** the UI Signal catches the error and instantly *reverts* the inventory quantities back to their previous state.
* **And** displays an error toast.

**UC 7.11: Screen Reader Accessibility for Dynamic Forms**
* **Given** a visually impaired user is using a screen reader on the custom cocktail form.
* **When** they click "Add Ingredient" or trigger a validation error.
* **Then** the Angular `LiveAnnouncer` explicitly reads "New ingredient row added" or the specific error state.
* **And** focus management seamlessly moves the cursor to the newly created input field.

**UC 7.12: Unsaved Changes Guard (CanDeactivate)**
* **Given** a user is filling out the "Create Custom Cocktail" dynamic form.
* **And** the form is `dirty` (changes have been made).
* **When** the user attempts to navigate away (clicks a link or the browser back button).
* **Then** an Angular `CanDeactivate` route guard intercepts the navigation.
* **And** prompts the user with a confirmation dialog ("You have unsaved changes. Leave?").
* **And** allows navigation if confirmed, or blocks it if cancelled.

**UC 7.13: Dynamic CSS Theme Toggling**
* **Given** the user updates their preference to `theme: 'dark'`.
* **When** the `UserStore` signal updates.
* **Then** the frontend globally applies a `dark-theme` CSS class to the document root.
* **And** overrides OS-level `prefers-color-scheme` settings.

**UC 7.14: MVP Image URL Constraint (No File Upload)**
* **Given** a user is creating a custom cocktail or ingredient on their mobile device.
* **When** they interact with the image field expecting to upload a photo.
* **Then** the UI clearly indicates this is a "Paste Image URL" field only (no binary file upload in MVP).
* **And** shows a tooltip explaining: "For MVP, please use a public image URL. Future versions will support photo uploads."
* **And** the UI attempts to preview the image URL on `blur` or `debounce`.
* **And** shows a clear error if the pasted link is a broken image or blocked by CORS.
* **Technical Constraint:** MVP scope excludes S3/R2 file upload infrastructure. Users must use existing public image URLs.

**UC 7.15: Search State Preservation Across Navigation**
* **Given** a user searches for "Martini" with filters (ABV: 20-30%, Glass: Martini Glass).
* **When** they navigate to view a cocktail detail page.
* **Then** the frontend stores the search state (query, filters, pagination) in a service or URL query params.
* **And** when they navigate back to the search results, the exact same state is restored.
* **And** the search results are reloaded from cache or re-queried if cache expired.

**UC 7.16: Optimistic UI Updates for Favorites**
* **Given** the user clicks the "Heart/Favorite" button on a cocktail card.
* **When** the action is triggered.
* **Then** the Angular Signal immediately toggles `is_favorited = true` so the UI reacts instantly.
* **And** if the background HTTP `POST /favorites` request fails, the signal reverts to `false` and displays an error toast.

**UC 7.17: Admin Dashboard - Pending Ingredients Queue**
* **Given** an Admin user with `role: 'admin'` logs into the system.
* **When** they navigate to the Admin Dashboard.
* **Then** the UI displays a queue of user-submitted custom ingredients awaiting approval.
* **And** provides action buttons to "Approve as Global" or "Reject with Reason".
* **And** shows real-time updates as ingredients are processed.

**UC 7.18: Admin Dashboard - Ingredient Merge Interface**
* **Given** an Admin identifies duplicate ingredients in the global catalog.
* **When** they select "Merge Ingredients" from the Admin Dashboard.
* **Then** the UI presents a side-by-side comparison of ingredient properties.
* **And** allows selecting which ingredient becomes the canonical version.
* **And** shows a preview of affected cocktails and user inventories before committing the merge.

**UC 7.19: Refresh Token Race Condition with Cross-Tab Sync**
 * **Given** multiple concurrent HTTP requests fail with 401 Unauthorized across browser tabs.
 * **When** the Angular HTTP Interceptor catches them.
 * **Then** it intercepts and queues all subsequent requests using an RxJS `BehaviorSubject<boolean>` (isRefreshing lock).
 * **And** uses `BroadcastChannel` API to synchronize refresh state across tabs, ensuring only one tab makes the refresh call.
 * **And** makes exactly ONE call to `/auth/refresh` across all tabs.
 * **And** upon success, broadcasts the new access token to all tabs via `BroadcastChannel`.
 * **And** releases the queue and replays all pending requests with the new Access Token.
 * **And** works with backend grace period (UC 9.15) to prevent token family revocation from race conditions.

**UC 7.20: Density Conversion Boundary UI**
* **Given** a user selects an ingredient defined by Mass (g).
* **When** they attempt to type a Volume unit (ml) in the UI dropdown.
* **Then** the Angular UI actively filters the select options to only show compatible units.
* **And** prevents the user from submitting a request that is guaranteed to fail validation.
* **And** displays a tooltip explaining the conversion constraint when incompatible units are attempted.

**UC 7.21: Two-Phase Offline Preparation with Inventory-Aware Logging**
* **Given** a user prepares a cocktail while offline (optimistic UI deducts inventory locally).
* **And** the physical database no longer has sufficient stock (depleted by a roommate/another session).
* **When** the app comes back online and the background sync processes the queue.
* **Then** the backend executes a **two-phase preparation**:
  * **Phase 1: Always create preparation log** - Record the preparation attempt with `inventory_status: 'pending'`
  * **Phase 2: Attempt inventory deduction** - If successful, update log with `inventory_status: 'deducted'`; if fails, update with `inventory_status: 'failed_insufficient'`
* **And** the preparation log is **never dropped** - it always exists for analytics, undo history, and user experience consistency.
* **And** the Angular Sync Service:
  * Shows toast: "Cocktail prepared! (Inventory adjustment failed: insufficient stock)"
  * Updates UI to show preparation in history with warning icon
  * Forces hard refresh of inventory from server
  * Allows user to manually adjust inventory or retry deduction
* **And** the undo system works for all preparations regardless of inventory status.

**UC 7.22: Secure Image Proxy Rendering (IP Privacy)**
* **Given** the frontend needs to render a cocktail image sourced from an external API (e.g., TheCocktailDB).
* **When** the browser makes the GET request for the image asset.
* **Then** the Angular `<img [src]="sanitizedUrl">` tag points STRICTLY to the backend proxy (`/api/images/proxy?url=...&hash=...`).
* **And** the frontend explicitly never makes direct outbound requests to the external host, guaranteeing zero client IP leakage (per ADR 0011).
* **And** utilizes the `SecureImageComponent` to seamlessly fallback to `cocktail-placeholder.jpg` if the proxy returns a 4xx/5xx error.

**UC 7.23: Bulk Offline Queue Sync**
 * **Given** a user prepared 3 drinks while entirely offline.
 * **When** the device regains network connectivity.
 * **Then** the Angular Sync Service batches all 3 preparations into a single `POST /sync/operations` request (consistent with UC 12.2).
 * **And** the backend processes each operation independently in separate transactions, returning an array of success/failure statuses for each item.
 * **And** prevents network instability from sending 10 queued items sequentially when the app comes back online.
 * **Note:** Operations are processed independently to maintain item-level idempotency (UC 12.2).

**UC 7.24: Asynchronous AI Loading State Recovery**
* **Given** a user requests an AI recipe and navigates to the "Inventory" page while waiting.
* **When** the AI generation completes successfully in the background.
* **Then** a global Angular Signal (`pendingAiRecipe`) catches the result.
* **And** triggers a non-intrusive Toast notification: "Your AI Recipe is ready!".
* **And** when the user navigates back to the AI Bartender view, the generated recipe is preserved and rendered instead of being lost.
* **And** the recipe remains available for 1 hour or until the user generates a new one.

**UC 7.25: Cross-Tab State Synchronization**
 * **Given** a user has MixologyHub open in Tab A and Tab B.
 * **When** the user clicks "Prepare Drink" in Tab A, deducting 50ml of Vodka.
 * **Then** the Angular application uses `BroadcastChannel API` or listens to `window.addEventListener('storage')` for `localStorage` changes.
 * **And** instantly updates the Angular Signal in Tab B to reflect the new inventory state without requiring a manual refresh.
 * **And** displays a subtle notification in Tab B: "Inventory updated from another tab".
 * **Implementation:** Uses a shared service that publishes state changes to `BroadcastChannel` and subscribes to receive updates from other tabs.
 * **Senior Architectural Decision: Access Token Storage vs. XSS Risk**
   * **Explicit Trade-off:** To enable cross-tab synchronization via `localStorage`, we must store the JWT access token in `localStorage` rather than HttpOnly cookies. This exposes the token to XSS attacks where malicious JavaScript could steal it. We accept this risk because:
     1. **Cross-Tab Sync Requirement:** HttpOnly cookies cannot be read by JavaScript, preventing BroadcastChannel synchronization
     2. **Offline Functionality:** Access tokens in localStorage enable offline queue persistence
     3. **Mitigation:** Strict Content Security Policy (CSP), input sanitization, and regular security audits
     4. **Short Token Lifetime:** 15-minute access token expiration limits exposure window

**UC 7.26: Sync Payload Bounding for Offline Queue**
 * **Given** a user is offline for an extended period and queues preparations.
 * **When** the offline queue in IndexedDB reaches 50 pending operations.
 * **Then** the UI disables further state-mutating actions to prevent generating a massive JSON payload that would cause `413 Payload Too Large` or transaction timeouts when the background sync finally flushes to the server.
 * **And** shows a warning: "Offline queue full. Please sync before adding more actions."
 * **And** provides a "Clear Oldest" button to manually prune the queue.
 * **Senior Architectural Correction: IndexedDB as Primary Offline Store**
   * **Explicit Decision:** The offline queue MUST be stored in IndexedDB, not localStorage. IndexedDB is asynchronous, can hold gigabytes of data, and is designed for structured storage. localStorage should only be used for the Access Token and lightweight User Preferences.
   * **Rationale:** The 50-action limit is not to protect browser storage quotas (IndexedDB can handle much more), but to protect the backend from payload massive synchronization spikes when the device reconnects.

**UC 7.27: State Reconciliation after Intermittent Network Drop**
 * **Given** a user clicks "Prepare Drink" and the UI optimistically deducts 50ml of Vodka.
 * **And** the network drops *while* the request is in-flight to the server.
 * **When** the frontend times out, it rolls back the UI to the previous state (Vodka +50ml).
 * **But** the backend successfully received and processed the request before the client disconnected.
 * **Then** when the `NetworkService` detects connection restored (`window.addEventListener('online')`), it must fire a silent `GET /inventory/hash` (or background refresh).
 * **And** forcibly sync the frontend Signal state with the Server state to resolve the optimistic UI desync, preventing the user from seeing ghost inventory.