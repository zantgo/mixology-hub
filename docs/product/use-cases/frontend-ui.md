# 💻 Domain 7: Frontend UI & Reactivity (Angular)

> **ONLINE-ONLY MANDATE:** This application requires a persistent internet connection to function. All offline and sync functionality has been removed to simplify architecture and eliminate complex state reconciliation.

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
 * **Then** the Angular UI triggers the API with the `page` parameter incremented from the previous response.
 * **And** the Signals/RxJS streams append the new results to the *existing* array without flashing or resetting the UI.

**UC 7.8: User-Preferred Measurement System (Localization)**
* **Given** the user's settings are configured to "Imperial" (oz).
* **And** the backend returns a cocktail requiring `59.14 ml` of Gin.
* **When** the UI renders the cocktail details or preparation screen.
* **Then** the Angular frontend (via a generic Pipe or Service) automatically converts and displays `2 oz`.
* **And** input forms for inventory automatically default to their preferred unit.

**UC 7.9: Cocktail Image Display with Fallback**
* **Given** a cocktail card component receives a cocktail object.
* **When** the component renders the cocktail image.
* **Then** it attempts to load the local `/uploads/...` path from `imageThumb`.
* **And** if `imageThumb` is null, or if the local file was accidentally deleted causing a 404, it falls back to the default local image (`/assets/images/cocktails/default/cocktail-placeholder.jpg`).

**UC 7.10: Optimistic Update Rollback**
* **Given** the user clicks "Prepare" and the Signal optimistically deducts inventory.
* **When** the backend returns a `500 Server Error` or network drops.
* **Then** the UI Signal catches the error and instantly *reverts* the inventory quantities back to their previous state.
* **And** displays an error toast.
* **Architectural Decision: Optimistic State Desynchronization Trap**
  * **Explicit Trade-off:** Because we strictly enforce the "No Concurrency / No Sync" mandates, we have removed all distributed idempotency locks and real-time state reconciliation. We explicitly accept that if an HTTP response drops in transit after the backend successfully commits a transaction, the frontend's optimistic rollback (reverting the UI to the pre-action state) will cause a silent Client-Server state desynchronization. If the user clicks "Retry", they will suffer a double-deduction. We trade robust, idempotent network recovery for absolute SPA architectural simplicity, relying on the user to manually refresh the browser or use the "Undo" feature to correct ledger inaccuracies.

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

**UC 7.19: SIMPLIFIED - Basic Token Refresh Handling**
 * **Given** multiple HTTP requests fail with 401 Unauthorized.
 * **When** the Angular HTTP Interceptor catches them.
 * **Then** basic token refresh logic is applied.
 * **Architectural Decision: Trading Seamless Multi-Tab UX for SPA Simplicity**
   * **Explicit Trade-off:** We explicitly strip out cross-tab synchronization, `BroadcastChannel`, and race condition prevention mechanisms. We trade seamless multi-tab user experience for strict Single Page Application architectural simplicity. Users must manually refresh browser tabs to synchronize state across sessions.

**UC 7.20: Density Conversion Boundary UI**
* **Given** a user selects an ingredient defined by Mass (g).
* **When** they attempt to type a Volume unit (ml) in the UI dropdown.
* **Then** the Angular UI actively filters the select options to only show compatible units.
* **And** prevents the user from submitting a request that is guaranteed to fail validation.
* **And** displays a tooltip explaining the conversion constraint when incompatible units are attempted.



**UC 7.24: Asynchronous AI Loading State Recovery**
* **Given** a user requests an AI recipe and navigates to the "Inventory" page while waiting.
* **When** the AI generation completes successfully in the background.
* **Then** a global Angular Signal (`pendingAiRecipe`) catches the result.
* **And** triggers a non-intrusive Toast notification: "Your AI Recipe is ready!".
* **And** when the user navigates back to the AI Bartender view, the generated recipe is preserved and rendered instead of being lost.
* **And** the recipe remains available for 1 hour or until the user generates a new one.

**UC 7.25: SIMPLIFIED - No Cross-Tab Synchronization**
 * **Given** a user has MixologyHub open in Tab A and Tab B.
 * **When** the user clicks "Prepare Drink" in Tab A, deducting 50ml of Vodka.
 * **Then** Tab B does not automatically update.
 * **Architectural Decision: Trading Seamless Multi-Tab UX for SPA Simplicity**
   * **Explicit Trade-off:** We explicitly strip out cross-tab synchronization, `BroadcastChannel`, and race condition prevention mechanisms. We trade seamless multi-tab user experience for strict Single Page Application architectural simplicity. Users must manually refresh browser tabs to synchronize state across sessions.

**UC 7.26: SIMPLIFIED - Network Error Handling**
 * **Given** a user clicks "Prepare Drink" and the UI optimistically deducts 50ml of Vodka.
 * **And** the network drops *while* the request is in-flight to the server.
 * **When** the frontend times out, it rolls back the UI to the previous state (Vodka +50ml).
 * **Then** shows error toast: "Network error: Preparation failed. Please try again."
 * **Architectural Decision: Trading Resilient Networking for SPA Simplicity**
   * **Explicit Trade-off:** We explicitly strip out automatic retry logic and idempotency mechanisms for network error handling. We trade resilient networking with automatic recovery for strict Single Page Application architectural simplicity. Users must manually retry failed operations.