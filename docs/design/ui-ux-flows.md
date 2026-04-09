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
    3. User confirms. **Optimistic UI Update**: The button turns into a green checkmark, and inventory decreases instantly.
    4. **Undo Mechanism (UC 4.4)**: A sticky toast appears at the bottom: *"1 Margarita prepared. Stock deducted. [UNDO]"*. This toast persists in a "Recent Preparations" menu for 15 minutes.

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
*   **Fields**: Name, Instructions, Image URL (with instant preview on blur).
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

1.  **Offline Mode (UC 7.21)**:
    *   *Trigger*: Browser loses network.
    *   *UI*: A subtle grey banner drops down from the top: *"You are offline. You can still view your bar and prepare drinks."*
    *   *Interaction*: If the user clicks "Prepare", the UI optimistically updates. A badge appears next to the drink saying *"Sync pending..."*.
2.  **Fractional Input Handling**:
    *   If a user types "1/3 oz", the UI displays "1/3 oz" (retained in `original_measure`), even though the backend converts it to `0.33` for math.
3.  **Image Fallbacks (UC 7.9)**:
    *   If an external API image link is broken (404), the Angular `(error)` directive instantly swaps the `src` to a beautifully designed local SVG placeholder of a cocktail glass, preventing broken UI frames.
4.  **Debouncing & Skeletons (UC 7.2)**:
    *   Never show a "No results found" immediately while typing. Wait 300ms, show a pulsing skeleton grid for 100ms, *then* show the results or the empty state.
5.  **Cross-Tab Sync (UC 7.25)**:
    *   If a user has MixologyHub open on their laptop and their phone, and they deduct Vodka on their phone, the laptop tab instantly updates the Vodka quantity. A brief, non-intrusive toast on the laptop says: *"Inventory updated from another device."*
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