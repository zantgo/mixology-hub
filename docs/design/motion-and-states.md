# ⚡ Motion & States

This document defines the animations, loading states, empty states, and interactive feedback for MixologyHub. Motion should be purposeful, delightful, and never obstructive.

## 🎭 Animation Principles

### Core Principles
1. **Purposeful**: Every animation serves a functional purpose
2. **Fast**: Most animations complete in 200-300ms
3. **Natural**: Use easing curves that feel physical
4. **Accessible**: Respect `prefers-reduced-motion`
5. **Performant**: Use CSS transforms and opacity for 60fps

### Easing Curves
```css
/* CSS Custom Properties */
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

/* Usage */
transition: transform var(--duration-normal) var(--ease-out);
```

## 🔄 Loading States

### Skeleton Loaders
Used during: Unified Search, AI Generation, API calls

**Specifications:**
```html
<!-- Cocktail card skeleton -->
<div class="skeleton-card">
  <div class="skeleton-image"></div>
  <div class="skeleton-content">
    <div class="skeleton-line" style="width: 70%"></div>
    <div class="skeleton-line" style="width: 40%"></div>
  </div>
</div>
```

```css
.skeleton-card {
  background: var(--color-bg-tertiary);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  position: relative;
}

.skeleton-image {
  aspect-ratio: 1/1;
  background: var(--color-bg-secondary);
}

.skeleton-line {
  height: 1rem;
  background: var(--color-bg-secondary);
  border-radius: var(--border-radius-sm);
  margin-bottom: var(--space-2);
}

/* Shimmer effect */
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.skeleton-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .skeleton-card::after {
    animation: none;
  }
}
```

### Progress Indicators
**AI Generation Animation (5-10 second latency):**
```html
<div class="ai-generation-loader">
  <div class="cocktail-shaker">
    <div class="shaker-body"></div>
    <div class="ice-cubes">
      <div class="ice-cube"></div>
      <div class="ice-cube"></div>
      <div class="ice-cube"></div>
    </div>
  </div>
  <p class="loading-text">Shaking up something special...</p>
  <div class="progress-bar">
    <div class="progress-fill" [style.width.%]="progress"></div>
  </div>
</div>
```

**Animation:**
- **Shaker**: Subtle shake animation (5° rotation)
- **Ice cubes**: Bounce inside shaker
- **Progress bar**: Smooth width transition
- **Text**: Cycling through fun cocktail puns

## 📭 Empty States

### My Bar (Empty Inventory)
```html
<div class="empty-state">
  <div class="empty-illustration">
    <app-icon name="glass-empty" size="xl"></app-icon>
  </div>
  <h3 class="empty-title">Your bar is empty</h3>
  <p class="empty-description">
    Add your first ingredient to start discovering cocktails you can make.
  </p>
  <button class="btn btn-primary" (click)="addFirstIngredient()">
    <app-icon name="plus"></app-icon>
    Add your first ingredient
  </button>
</div>
```

**Design:**
- **Illustration**: Empty glass icon (subtle animation: gentle pulse)
- **Title**: Clear, actionable
- **Description**: Helpful guidance
- **CTA**: Primary button with icon

### No Search Results
```html
<div class="empty-search">
  <div class="empty-illustration">
    <app-icon name="search-x" size="xl"></app-icon>
  </div>
  <h3 class="empty-title">No cocktails found</h3>
  <p class="empty-description">
    Try adjusting your filters or search for something else.
  </p>
  <div class="empty-actions">
    <button class="btn btn-outline" (click)="clearFilters()">
      Clear filters
    </button>
    <button class="btn btn-primary" (click)="tryAiBartender()">
      Ask AI Bartender
    </button>
  </div>
</div>
```

### Empty Favorites
```html
<div class="empty-favorites">
  <div class="empty-illustration">
    <app-icon name="heart-outline" size="xl"></app-icon>
    <div class="sparkle"></div>
  </div>
  <h3 class="empty-title">No favorites yet</h3>
  <p class="empty-description">
    Tap the heart icon on any cocktail to save it here.
  </p>
  <button class="btn btn-primary" routerLink="/search">
    <app-icon name="search"></app-icon>
    Explore cocktails
  </button>
</div>
```

## 📢 Toast Notifications

### Success Toast (Undo Action)
```html
<div class="toast toast-success" role="alert" aria-live="polite">
  <div class="toast-content">
    <app-icon name="check-circle"></app-icon>
    <div class="toast-message">
      <strong>1 Margarita prepared</strong>
      <span class="toast-detail">Stock deducted from inventory</span>
    </div>
  </div>
  <button class="toast-action" (click)="undo()" aria-label="Undo preparation">
    UNDO
  </button>
  <button class="toast-close" (click)="dismiss()" aria-label="Dismiss notification">
    <app-icon name="x"></app-icon>
  </button>
</div>
```

**Animation:**
- **Entrance**: Slide up from bottom 20px
- **Exit**: Slide down + fade out
- **Duration**: 5 seconds auto-dismiss, 15 seconds if contains undo
- **Stacking**: Multiple toasts stack upward

### Error Toast
```html
<div class="toast toast-error">
  <app-icon name="alert-circle"></app-icon>
  <div class="toast-message">
    <strong>Network error</strong>
    <span class="toast-detail">Could not update inventory. Check connection.</span>
  </div>
  <button class="toast-action" (click)="retry()">
    RETRY
  </button>
</div>
```

### Network Error Banner
```html
<div class="network-error-banner" role="alert" aria-live="assertive">
  <app-icon name="wifi-off"></app-icon>
  <span>Network connection lost. Please check your internet connection.</span>
</div>
```

## 🎬 Micro-interactions

### Mobile "Tap" States (Touch Feedback)
**Senior Recommendation:** On mobile, there is no `:hover` state. Buttons and cards should react to the `:active` state with visual feedback so users feel they actually tapped the screen.

```css
/* Base tap feedback for all interactive elements */
button,
[role="button"],
.clickable,
.card-tappable {
  transition: transform var(--duration-fast) var(--ease-out),
              opacity var(--duration-fast) var(--ease-out);
}

/* Active state for touch devices */
@media (hover: none) and (pointer: coarse) {
  button:active,
  [role="button"]:active,
  .clickable:active,
  .card-tappable:active {
    transform: scale(0.97);
    opacity: 0.9;
  }
  
  /* Suppress hover effects on touch devices */
  button:hover,
  [role="button"]:hover,
  .clickable:hover,
  .card-tappable:hover {
    transform: none;
    opacity: 1;
  }
}

/* Enhanced tap feedback for primary actions */
.btn-primary:active {
  transform: scale(0.95);
  opacity: 0.85;
}

/* Card tap feedback */
.cocktail-card {
  cursor: pointer;
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}

.cocktail-card:active {
  transform: scale(0.99);
}

/* Disable hover effects on touch devices */
@media (hover: none) {
  .cocktail-card:hover {
    transform: none;
    box-shadow: var(--shadow-card);
  }
}

/* Ripple effect for material-like feedback */
.ripple {
  position: relative;
  overflow: hidden;
}

.ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0;
  border-radius: 100%;
  transform: scale(1, 1) translate(-50%, -50%);
  transform-origin: 50% 50%;
}

.ripple:active::after {
  animation: ripple 0.6s ease-out;
}

@keyframes ripple {
  0% {
    transform: scale(0, 0);
    opacity: 0.5;
  }
  20% {
    transform: scale(25, 25);
    opacity: 0.3;
  }
  100% {
    opacity: 0;
    transform: scale(40, 40);
  }
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  button:active,
  [role="button"]:active,
  .clickable:active {
    transform: none;
  }
  
  .ripple::after {
    animation: none;
  }
}
```

### Button Press
```css
.btn:active {
  transform: scale(0.98);
  transition: transform var(--duration-fast) var(--ease-out);
}
```

### Card Hover
```css
.cocktail-card {
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}

.cocktail-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
}

/* Disable on touch devices */
@media (hover: none) {
  .cocktail-card:hover {
    transform: none;
  }
}
```

### Favorite Toggle
```html
<button class="favorite-btn" (click)="toggleFavorite()" [class.is-favorite]="isFavorite">
  <div class="heart-container">
    <app-icon name="heart-outline" class="heart-outline"></app-icon>
    <app-icon name="heart-filled" class="heart-filled"></app-icon>
  </div>
</button>
```

```css
.heart-container {
  position: relative;
  width: 24px;
  height: 24px;
}

.heart-outline, .heart-filled {
  position: absolute;
  transition: opacity var(--duration-normal) var(--ease-out),
              transform var(--duration-normal) var(--ease-bounce);
}

.heart-outline {
  opacity: 1;
}

.heart-filled {
  opacity: 0;
  transform: scale(0);
}

.is-favorite .heart-outline {
  opacity: 0;
  transform: scale(1.2);
}

.is-favorite .heart-filled {
  opacity: 1;
  transform: scale(1);
}
```

### Quantity Adjuster
```css
.quantity-btn:active {
  transform: scale(0.9);
}

.quantity-btn:active .icon {
  animation: bounce 0.3s var(--ease-bounce);
}

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
```

## 🚦 Component States

### Input States
```css
.form-input {
  /* Default */
  border: 1px solid var(--color-border);
  transition: border-color var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}

.form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(217, 119, 54, 0.2);
  outline: none;
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-input.error {
  border-color: var(--color-error);
}

.form-input.error:focus {
  box-shadow: 0 0 0 2px rgba(244, 67, 54, 0.2);
}
```

### Button States
```css
.btn {
  /* Base */
  transition: background-color var(--duration-normal) var(--ease-out),
              border-color var(--duration-normal) var(--ease-out),
              transform var(--duration-fast) var(--ease-out);
}

.btn:hover:not(:disabled) {
  /* Hover state */
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.loading {
  position: relative;
  color: transparent;
}

.btn.loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-radius: 50%;
  border-right-color: transparent;
  animation: spin 0.8s linear infinite;
}
```

### Selection States
```css
.ingredient-item.selected {
  background-color: rgba(217, 119, 54, 0.1);
  border-left: 3px solid var(--color-primary);
}

.ingredient-item:focus-within {
  box-shadow: 0 0 0 2px var(--color-primary);
}
```

## 🎪 Page Transitions

### Route Transitions
```css
/* Angular router outlet wrapper */
.router-outlet-wrapper {
  position: relative;
}

.route-container {
  position: absolute;
  width: 100%;
}

/* Slide animation */
.slide-in-right {
  animation: slideInRight var(--duration-normal) var(--ease-out);
}

.slide-out-left {
  animation: slideOutLeft var(--duration-normal) var(--ease-out);
}

@keyframes slideInRight {
  from {
    transform: translateX(20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutLeft {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-20px);
    opacity: 0;
  }
}
```

### Modal & Sheet Animations
```css
/* Bottom sheet */
.bottom-sheet {
  transform: translateY(100%);
  transition: transform var(--duration-normal) var(--ease-out);
}

.bottom-sheet.open {
  transform: translateY(0);
}

/* Modal backdrop */
.modal-backdrop {
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modal-backdrop.open {
  opacity: 1;
}

.modal-content {
  transform: scale(0.9);
  opacity: 0;
  transition: transform var(--duration-normal) var(--ease-out),
              opacity var(--duration-normal) var(--ease-out);
}

.modal-content.open {
  transform: scale(1);
  opacity: 1;
}
```

## ♿ Accessibility Considerations

### Reduced Motion
```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .skeleton-card::after {
    animation: none;
  }
}
```

### Focus Management
- **Modal focus trap**: Focus moves to modal, can't escape
- **Return focus**: After modal closes, focus returns to trigger
- **Live announcements**: Use `LiveAnnouncer` for dynamic updates
- **Focus indicators**: Visible focus rings for keyboard users

### Screen Reader Announcements
```typescript
// Angular LiveAnnouncer examples
this.liveAnnouncer.announce('Ingredient added to inventory');
this.liveAnnouncer.announce('Cocktail preparation completed');
this.liveAnnouncer.announce('AI recipe generated successfully');
```

## 🧪 Performance Guidelines

### Animation Performance
- **Use transforms and opacity**: These properties don't trigger layout/paint
- **Avoid animating width/height**: Use scale transform instead
- **Use will-change sparingly**: Only on elements currently animating
- **Test on low-end devices**: Ensure 60fps on budget phones

### Loading Strategy
- **Lazy load below-fold images**: `loading="lazy"`
- **Progressive image loading**: Blur-up technique
- **Critical CSS inlined**: Above-fold styles loaded immediately
- **Code splitting**: Lazy load non-critical components

---

*Last updated: April 9, 2026*