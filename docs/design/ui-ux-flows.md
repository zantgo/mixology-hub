# 🎨 1. Design System & Visual Language

MixologyHub is a utility app that blends utility (inventory math) with lifestyle/leisure (crafting cocktails). The design should feel premium, appetizing, and highly responsive.

### Visual Theme: "Modern Speakeasy"
*   **Typography**: 
    *   *Headings*: A modern serif (e.g., *Playfair Display* or *Lora*) for cocktail names to evoke a premium, classic menu feel.
    *   *Body/UI*: A clean, highly legible sans-serif (e.g., *Inter* or *Inter UI*) for inventory numbers, filters, and instructions.
*   **Color Palette (Dynamic via Angular Signals)**:
    *   **Dark Mode (Default)**: Deep charcoal background (`#121212`), elevated cards in slightly lighter grey (`#1E1E1E`). Accents in Copper/Amber (`#D97736`) and Mint Green (`#2E7D32`) for "Makeable" states.
    *   **Light Mode**: Off-white background (`#F9F9F9`), crisp white cards (`#FFFFFF`). Slate text (`#333333`). Accents in vibrant Orange/Gold and Forest Green.
*   **UI Components**:
    *   **Cards**: Soft rounded corners (`8px` or `12px`), subtle drop shadows.
    *   **Skeleton Loaders**: Used during AI generation and unified search hydration to prevent layout shift.
    *   **Badges**: Status indicators (e.g., 🟢 *Makeable*, 🟡 *Missing 1*, 🔴 *Unmakeable*, 🤖 *AI Generated*).

---

# 📱 2. Global Navigation & Layout

**Mobile-First Approach**: Users will likely be standing at their home bar holding their phone.
*   **Mobile**: Bottom Navigation Bar with 5 icons: `Home`, `Search`, `My Bar (Inventory)`, `AI Bartender`, `Profile`.
*   **Desktop/Tablet**: Left-hand collapsible sidebar.
*   **Global Headers**: 
    *   Top right: Network status indicator (Cloud icon with a slash if offline).
    *   Persistent Toast/Snackbar container at the bottom (above nav) for "Undo" actions and error messages.

---

# 🍸 3. Standard User UX Flow

## Flow 1: Onboarding & Empty States (UC 7.5)
*   **Sign Up/Login**: Simple email/password form.
*   **Initial State**: The user lands on "My Bar". Because it is empty, they see a beautiful **Empty State** illustration of an empty glass.
*   **Call to Action (CTA)**: A pulsing primary button: *"Add your first ingredient"*.
*   *Micro-interaction*: On first login, a quick modal asks for their preferred unit system (Metric: `ml` vs Imperial: `oz`). This saves to `UserProfiles`.

## Flow 2: "My Bar" (Inventory Management) (Domain 1)
*   **Layout**: A list view grouped by category (Spirits, Mixers, Garnishes).
*   **Adding Ingredients**: 
    1. User taps "+ Add Ingredient".
    2. A search bar opens. As they type "Vod", the `IngredientService` fuzzy-matches and suggests "Vodka (Global)". 
    3. User selects Vodka. A bottom sheet slides up asking for quantity and unit. (e.g., `[ 750 ]` `[ ml ⌄ ]`).
    4. If the user types a custom ingredient ("Dave's Secret Bitters"), they are prompted to create it, selecting a base unit (`volume`, `mass`, `count`).
*   **Quick Adjustments**: Each inventory row has a quick `-` and `+` button for rapid manual stock adjustments, alongside the current quantity.

## Flow 3: Smart Discovery & Dashboard (Domain 2 & 3)
*   **Home Dashboard Layout**:
    *   **Hero Section**: *"Cocktails you can make right now"* (Horizontal scrolling carousel).
    *   **Secondary Section**: *"Almost Makeable (Missing 1 ingredient)"*. Clicking a cocktail here highlights the exact missing ingredient in red to drive the user's shopping list.
*   **Unified Search**:
    *   User navigates to Search tab and types "Margarita".
    *   *RxJS Debounce* waits 300ms, then shows skeleton loaders.
    *   Results populate in a grid. Each card displays the cocktail image, name, star rating, and a Makeability Badge (🟢/🟡/🔴).
    *   **Filters**: A slider icon opens a drawer allowing users to `Include` or `Exclude` specific ingredients (e.g., "Exclude: Tequila").
    *   **Architectural Decision: Visual UI Degradation for External Search**
    *   **Explicit Trade-off:** Because the backend is strictly forbidden from passing external image URLs (ADR 0016) and cannot synchronously ingest 50 Sharp images without blocking the Node.js event loop, we explicitly accept a degraded visual experience during Unified Search. Any cocktail card sourced from the external API will intentionally render the local static SVG placeholder (`/assets/images/cocktail-placeholder.jpg`) until the user explicitly saves it as a custom recipe.

## Flow 4: Cocktail Details & Preparation (Domain 4)
*   **Layout**:
    *   Large hero image at the top. Top-right heart icon (Favorites toggle).
    *   Title, Author (if custom), and Rating.
    *   **Ingredient Checklist**: A list of ingredients. 
        *   If in stock: Shows green checkmark and user's current stock vs required amount.
        *   If missing: Shows red 'X'.
    *   **Preparation Instructions**: Step-by-step text.
*   **The "Prepare" Action**:
    1. User taps the sticky "Prepare Drink" FAB at the bottom.
    2. A modal confirms serving size: `[-] 1 [+] Servings` or `Total Volume [ 150 ] ml` for part-based drinks.
    3. User confirms. The button shows a spinner and the text changes to "Queueing...". The backend returns `202 Accepted`.
    4. The UI polls `GET /preparations/:logId/status` every 1-2 seconds.
    5. When the BullMQ worker completes the deduction, the status changes to `completed`. The button turns into a green checkmark. Inventory display updates.
    6. If status is `failed_insufficient_stock`, the UI shows an error with the missing ingredient.
    7. **Undo Mechanism (UC 4.4)**: A sticky toast appears at the bottom: *"1 Margarita prepared. Stock deducted. [UNDO]"*. This toast persists in a "Recent Preparations" menu for 15 minutes.
    * **Architectural Decision: Async Queue Processing over Optimistic UI**
      * **Explicit Trade-off:** Because inventory deductions execute inside a single-threaded BullMQ worker (ADR 0017), the UI cannot display an instant "Stock Deducted" confirmation. A polling/spinner state replaces the old optimistic UI pattern. We trade instant visual feedback for absolute inventory correctness and elimination of the phantom-deduction/desynchronization problem.

## Flow 5: The AI Bartender (Domain 5)
*   **Layout**: Conversational/Prompt interface.
*   **Inputs**:
    *   Text area: *"What flavors are you craving?"*
    *   Toggle Switch: *"[x] Use ONLY ingredients from My Bar"* (Strict inventory mode). 
      - **Disabled state**: Grayed out with tooltip "Add ingredients to My Bar first" when inventory is empty.
      - **Validation**: Frontend checks inventory count before allowing toggle activation.
    *   Dropdown: Stylistic modifier (e.g., Tiki, Classic, Frozen).
*   **Generation State**: When the user taps "Generate", a fun animation plays (e.g., a cocktail shaker shaking) to mask the LLM latency.
*   **Result**: The AI recipe is presented on a card with a special 🤖 badge. 
*   **Actions**:
    *   *Thumbs Down*: Discards and resets.
    *   *Save Recipe*: Triggers `save-as-cocktail` transaction, mapping hallucinated ingredients to the DB, and adds it to the user's personal recipes.

## Flow 6: Custom Recipe Creation (UC 7.3)
*   **Layout**: A dynamic Angular `FormArray`.
*   **Fields**: Name, Instructions, Image File Upload (with instant local preview).
*   **Dynamic Ingredients**: 
    *   Rows with `Ingredient Name` (autocomplete search), `Measure` (free text like "1 1/2 oz"), and a trash can icon to remove the row.
    *   "+ Add Ingredient" button appends a new row. Focus is automatically moved to the new input for screen readers and keyboard users.
*   **Privacy**: Toggle switch for "Make Public".

---

# 🛡️ 4. Administrator UX Flow

Admin features are hidden behind a route guard (`/admin`) accessible only to users with `role: 'admin'`. The design here shifts from "Lifestyle App" to "Data-Dense Dashboard" (Data grids, side-navigation).

## Flow 1: Admin Dashboard Overview
*   **Layout**: Sidebar navigation (Overview, Ingredients, Moderation).
*   **Metrics**: Top cards showing system health: "New Users", "Pending Ingredients", "Reported Content", "API Errors".

## Flow 2: Ingredient Moderation & Merging (Domain 10)
When users create custom ingredients, the global catalog can get messy.
*   **Pending Ingredients Queue**:
    *   A data table listing custom ingredients created by users (e.g., "Granny's Mint Bitters").
    *   Actions: `Promote to Global`, `Edit`, `Reject`.
*   **The Merge Interface (UC 7.18)**:
    *   Admin identifies "Fresh Lime" and "Lime".
    *   Admin selects both and clicks "Merge".
    *   **UI**: A side-by-side comparison modal opens. 
    *   Admin selects which entity survives (the "Canonical" ingredient) and which is deleted.
    *   Warning text displays: *"This will update 145 user inventories and 32 recipes."* Admin types "CONFIRM" to execute the database transaction.

## Flow 3: Synonym & Taxonomy Management
*   **UI**: A node-based list or simple parent-child table.
*   Admin searches "Cointreau", clicks "Add Parent/Synonym", and selects "Orange Liqueur".
*   The UI actively prevents circular logic via backend validation and shows a red error toast if the Admin attempts to make "Orange Liqueur" a child of "Cointreau" when the reverse already exists.

## Flow 4: Content Moderation (UC 12.11)
*   **Reported Content Queue**:
    *   List of recipes flagged by users (e.g., inappropriate text).
    *   Columns: `Reporter`, `Cocktail Name`, `Reason`, `Status`.
*   **Review Modal**:
    *   Shows the reported recipe content.
    *   Action Buttons: `Dismiss Report` (green), `Hide Cocktail` (yellow), `Delete & Warn User` (red).

---

# ⚡ 5. Critical UX Micro-Interactions & Edge Cases

1.  **Network Error Handling**:
    *   *Trigger*: Browser loses network connection.
    *   *UI*: A red error banner drops down from the top: *"Network connection lost. Please check your internet connection."*
    *   *Behavior*: All API calls will fail with standard HTTP timeouts. The UI will display network error toasts with retry options for critical operations.
    *   **Note:** The `POST /prepare` endpoint returns a `202 Accepted` as soon as the job is enqueued to Redis. If network drops after this response, the preparation is still queued; the UI will pick up the status on reconnect via polling.
2.  **Fractional Input Handling**:
    *   If a user types "1/3 oz", the UI displays "1/3 oz" (retained in `original_measure`), even though the backend converts it to `0.33` for math.
3.  **Image Fallbacks (UC 7.9)**:
    *   **Architectural Decision: Image Blackout for External Search UX**
    *   **Explicit Trade-off:** Because we enforce a strict "No Image URLs" policy, the backend cannot pass external TheCocktailDB image URLs to the frontend during search. Simultaneously, synchronously downloading and processing 50 images via the Sharp library during a search request would block the Node.js event loop causing a DoS. Therefore, we explicitly dictate that all external search results will return null for images. We trade search interface aesthetics (forcing users to look at local placeholder SVGs) for guaranteed Node.js server stability and strict adherence to the local-assets-only security mandate.
    *   If a local image file is missing from `/uploads/cocktails/`, the Angular `(error)` directive instantly swaps the `src` to a beautifully designed local SVG placeholder of a cocktail glass, preventing broken UI frames.
4.  **Debouncing & Skeletons (UC 7.2)**:
    *   Never show a "No results found" immediately while typing. Wait 300ms, show a pulsing skeleton grid for 100ms, *then* show the results or the empty state.
5.  **Acceptance of Cross-Device Stale State**:
    *   **Architectural Decision: Acceptance of Cross-Device Stale State**
    *   **Explicit Trade-off:** We explicitly strip out all WebSockets, polling, and BroadcastChannel implementations for non-critical state (favorites, search). We accept that users operating MixologyHub across multiple browser tabs or devices will experience visually stale favorites data. Users must manually refresh their browser to synchronize non-inventory state. Note: Inventory state is server-authoritative and refreshed via the preparation status polling endpoint.
6.  **Theme Switching UX**:
    *   **Location**: User profile/settings page → Appearance section
    *   **Selector Type**: Visual preview cards (Light/Dark/System) with icon indicators
    *   **Options**: Light Mode | Dark Mode | System Default (Recommended)
    *   **Default**: System Default (follows OS preference)
    *   **Persistence**: localStorage with Angular Signals
    *   **FOUC Prevention**: Read theme from localStorage before Angular bootstrap, apply via data-theme attribute
  *   **Transition**: Smooth 200ms transition for all color properties
  *   **System Detection**: Listen to `prefers-color-scheme` media query changes
  *   **Screen Reader**: Announce theme changes via `LiveAnnouncer`

7.  **Tombstoned Favorites Handling (UC 6.6)**:
    *   **Problem**: When a user's limit=10 query fetches 10 favorites, and 8 of them are tombstoned (soft-deleted by author), the user sees a page of mostly dead recipes.
    *   **UI Solution**: 
      *   **Visual Grouping**: Tombstoned favorites are visually collapsed into an "Archived Recipes" section at the bottom of the Favorites grid.
      *   **Visual Distinction**: Tombstoned cards use a 50% opacity, grayscale filter, and a "Recipe deleted by author" badge.
      *   **Action Options**: Users can "Remove from Favorites" tombstoned recipes with a single click.
      *   **Pagination Adjustment**: The favorites grid automatically excludes tombstoned recipes from the main display count, ensuring users see active recipes first.
    *   **Implementation**: The frontend filters `is_deleted: true` recipes to a separate array, displays them in a collapsible section, and provides clear visual feedback that these recipes are no longer available.

---

# 👮 8. Admin Moderation Flows

**Admin Dashboard Access**: Accessible via `/admin` route for users with `role: 'admin'`.

*   **Reported Content Queue**:
    *   **UI**: Table view with columns: `Report ID`, `Cocktail Name`, `Report Reason`, `Reporter`, `Date`, `Status`, `Actions`
    *   **Actions**: `Review`, `Dismiss`, `Delete Cocktail`, `Hide External Cocktail`, `Warn User`
    *   **Filters**: `Status (pending/reviewed/dismissed/action_taken)`, `Report Type`, `Date Range`

*   **External Cocktail Hiding**:
    *   **When**: Admin selects "Hide External Cocktail" action for reported external API cocktails
    *   **UI**: Modal with confirmation: "This will hide cocktail [ID] from all future search results. Reason: [dropdown: inappropriate/spam/copyright/other]"
    *   **Result**: External ID added to `HIDDEN_EXTERNAL_COCKTAILS` blocklist, instantly filtered from unified search
    *   **Audit Trail**: Action logged with admin ID, timestamp, and reason

*   **Local Cocktail Moderation**:
    *   **Delete**: Hard delete for severe violations, soft delete for minor issues
    *   **Warning**: Automated email to cocktail author with violation details
    *   **Notification**: Email to reporter thanking them for their report