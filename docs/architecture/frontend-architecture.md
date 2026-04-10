# Frontend Architecture & Design Patterns

> **ONLINE-ONLY MANDATE:** This application requires a persistent internet connection to function. All offline and sync functionality has been removed to simplify architecture and eliminate complex state reconciliation.

  

The MixologyHub frontend is built with **Angular 18+**, leveraging the framework's most modern features to deliver a highly reactive, performant, and maintainable User Interface.

  

The architecture moves away from legacy Angular patterns (like heavy `NgModules` and Zone.js) in favor of **Standalone Components**, **Angular Signals**, and **Zoneless Change Detection**.

  

---

  

## 🏗️ Modern Angular Paradigms

  

### 1. Zoneless Change Detection

Historically, Angular relied on `zone.js` to monkey-patch browser APIs and trigger change detection. MixologyHub is configured to use modern Zoneless Change Detection (`provideZonelessChangeDetection()`).

- **Why?** It drastically reduces the bundle size, improves runtime performance, and forces a cleaner, more explicit state management architecture using Signals.

  

### 2. Standalone Components

The application is entirely module-less (`NgModules` are not used). Components, Directives, and Pipes are standalone.

- **Why?** This reduces boilerplate, makes component dependencies explicit via the `imports` array, and significantly improves tree-shaking and lazy-loading capabilities.

  

### 3. Angular Signals (Reactive State)

We use **Angular Signals** (`signal`, `computed`, `effect`) for synchronous UI state management, replacing complex RxJS `BehaviorSubject` patterns where fine-grained reactivity is required.

- **Example:** The user list and inventory states are held in signals (`users = signal<any[]>([])`). When the signal updates, Angular surgically updates only the DOM nodes bound to that specific signal, rather than running a global change detection cycle.

  

---

  

## 🔀 RxJS & Asynchronous Data Streams

  

While Signals handle synchronous state, **RxJS** remains the backbone for asynchronous operations, specifically HTTP requests and complex event handling.

  

### Real-Time Search Debouncing

To prevent spamming the backend aggregator API on every keystroke, RxJS operators are utilized in the search implementation:

  

```typescript

searchInput.valueChanges.pipe(

debounceTime(300), // Wait 300ms after the last keystroke

distinctUntilChanged(), // Only emit if the value actually changed

switchMap(query => this.api.search(query)) // Cancel previous pending requests

).subscribe(results => this.searchResults.set(results));

```

*This ensures optimal network usage and prevents race conditions where an older request resolves after a newer one.*

  

---

  

## 📂 Core Structure & Layering

  

The `src/app/` directory is structured to clearly separate feature domains from core infrastructure.

  

```text

src/app/

├── core/ # Singleton services, Interceptors, Auth logic

│ ├── interceptors/ # HTTP Interceptors (JWT attachment, error handling)

│ └── services/ # HTTP API wrappers (UserService, CocktailService)

├── shared/ # Reusable UI components (Buttons, Cards, Pipes)

├── features/ # Feature modules (Lazy-loaded routes)

│ ├── ai-bartender/ # AI Prompt UI and Recipe rendering

│ ├── cocktails/ # Recipe browsing and detail views

│ ├── inventory/ # User ingredient management

│ └── auth/ # Login/Register flows

├── app.component.ts # Root standalone component

└── app.routes.ts # Global routing definitions

```

  

---

  

## 🛡️ HTTP Interceptors & Global Error Handling

  

All outbound HTTP requests are processed through Angular's functional interceptors (`HttpInterceptorFn`).

  

1. **Auth Interceptor:** Automatically attaches JWT Bearer tokens to outbound requests for protected routes.

2. **Error Handling:** Globally catches HTTP errors (e.g., 401 Unauthorized, 500 Internal Server Error), triggers UI toast notifications, and securely handles token expiration/redirects to the login flow.

  

---

  

## 📝 Dynamic Forms (Reactive Forms)

  

Creating a cocktail involves complex, dynamic data structures (e.g., a recipe can have 1 ingredient or 15).

  

We utilize **Angular Reactive Forms** with `FormArray` to handle this.

- **Why?** Reactive forms provide synchronous access to form state, making it easy to dynamically add/remove ingredient rows in the UI while maintaining strict validation rules (e.g., ensuring `measure` and `ingredientId` are provided before enabling the "Save" button).

## 🚫 Cross-Device Real-Time Sync Limitations

**Senior Architectural Decision: Absence of Cross-Device Real-Time Sync**
**Explicit Trade-off:** While cross-tab synchronization works perfectly via BroadcastChannel API (UC 7.25), cross-device synchronization for shared accounts (e.g., two roommates using the same login on different phones) will experience "phantom" stale state. We explicitly accept that one user will not see the other's real-time inventory deductions until a hard refresh or state-mutating action occurs. We trade perfect multi-device real-time parity for backend architectural simplicity by omitting WebSockets/SSE in the MVP.

## 🔢 HTML Input Precision Boundary

**Senior Architectural Decision: HTML Input Precision Boundary**
**Explicit Trade-off:** Standard HTML `<input type="number">` elements inherently cast inputs to IEEE 754 floats. To strictly maintain `decimal.js` precision from end-to-end, all fractional ingredient inputs in Angular Reactive Forms MUST use `<input type="text" inputmode="decimal">`. We accept the minor UX trade-off of losing the native browser "spinner" arrows in exchange for preventing silent float corruption before the data reaches our math engine.

## 🔄 Network Error Handling

**Senior Architectural Decision: Optimistic Rollback & Idempotent Auto-Retry**
**Explicit Trade-off:** With the removal of offline queuing, the frontend must handle network failures in real-time. We explicitly mandate the use of RxJS `retry({ count: 2, delay: 1000 })` for all state-mutating requests, relying on the backend's Idempotency Key system to prevent duplicate processing. If the request fails after 2 retries, the Angular Signal state MUST be mathematically rolled back to its previous value, and the user presented with a hard error toast: "Network error: Operation failed. Please try again." We trade offline usability for strict client-server state consistency.
