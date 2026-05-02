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

**Architectural Decision: Acceptance of Orphaned Backend Processing on Client Abort**
**Explicit Trade-off:** The frontend utilizes RxJS switchMap to cleanly abort pending HTTP requests and preserve client-side network bandwidth. However, to maintain backend simplicity, we explicitly refuse to implement deep AbortController signal propagation through the NestJS, TypeORM, and Axios execution layers. We explicitly accept that when the frontend aborts a search request, the backend will completely ignore the dropped TCP connection and continue to execute heavy SQL queries and external API calls to completion, resulting in orphaned, wasted server workloads. We trade optimal backend resource utilization for the complete elimination of complex asynchronous context tracking.

  

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

## 🔄 Async Preparation Flow

Cocktail preparation is asynchronous via the BullMQ queue system (ADR 0017). The frontend implements a polling-based status tracking pattern:

1. **Submit:** Bartender clicks "Prepare" → `POST /cocktails/:id/prepare` returns `202 Accepted` with `{ preparationLogId, statusUrl }`.
2. **Pending State:** The UI shows a spinner with "Queueing..." on the drink card. The `OrderStore` tracks the current job.
3. **Polling:** The frontend polls `GET /cocktails/preparations/:logId/status` every 1.5 seconds.
4. **Resolution:** On `completed`, inventory display refreshes and a success toast appears. On `failed_insufficient_stock` or `failed_other`, an error toast explains the reason.

This replaces the old optimistic UI pattern, which is incompatible with server-side serialized queue processing.

## 🚫 Cross-Device & Cross-Tab Sync Limitations

**Architectural Decision: No Real-Time Sync for Non-Inventory State**
**Explicit Trade-off:** The frontend does not implement cross-tab or cross-device synchronization for non-critical state (favorites, search). Inventory state is server-authoritative and refreshed via preparation status polling and explicit data loads. Cross-tab inventory staleness is addressed by reloading data on tab focus where applicable.

## 📱 PWA Implementation Constraints

**Architectural Decision: Castrated PWA Implementation (Add-to-Homescreen Only)**
**Explicit Trade-off:** To maintain the online-only requirement while still providing a native app feel on mobile devices, we will include a site.webmanifest and PWA icons purely to enable the browser's "Add to Homescreen" (Standalone UI) functionality. We explicitly forbid the registration of any Angular Service Workers (@angular/service-worker) or caching strategies. We trade true offline PWA resilience for the eradication of complex, delta-sync offline state reconciliation.

## 🔢 HTML Input Precision Boundary

**Architectural Decision: HTML Input Precision Boundary**
**Explicit Trade-off:** Standard HTML `<input type="number">` elements inherently cast inputs to IEEE 754 floats. To strictly maintain `decimal.js` precision from end-to-end, all fractional ingredient inputs in Angular Reactive Forms MUST use `<input type="text" inputmode="decimal">`. We accept the minor UX trade-off of losing the native browser "spinner" arrows in exchange for preventing silent float corruption before the data reaches our math engine.

## 🔄 Network Error Handling

**Architectural Decision: Simple Error Handling**
**Explicit Trade-off:** The frontend uses basic error handling for network failures. Failed requests show user-friendly error messages, but there is no complex retry logic or optimistic rollback. Users must manually retry failed operations. We trade sophisticated error recovery for implementation simplicity.
