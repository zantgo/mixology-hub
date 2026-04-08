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
* **Given** the user has loaded Page 1 of the Unified Search results.
* **When** the user scrolls to the bottom of the list (or clicks "Load More").
* **Then** the Angular UI triggers the API for `page=2`.
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