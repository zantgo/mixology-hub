# ♿ Accessibility (A11Y)

This document defines the accessibility standards and implementation guidelines for MixologyHub. All features must be accessible to users with disabilities, following WCAG 2.1 AA standards.

## 🎯 Accessibility Principles

### Core Requirements
1. **Perceivable**: Information must be presentable to users in ways they can perceive
2. **Operable**: Interface components must be operable by all users
3. **Understandable**: Information and operation must be understandable
4. **Robust**: Content must be robust enough for current and future tools

### Target Standards
- **WCAG 2.1 Level AA**: Minimum compliance standard
- **Screen Readers**: VoiceOver (iOS), TalkBack (Android), NVDA, JAWS
- **Keyboard Navigation**: Full functionality without mouse
- **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text

## 🗣️ Screen Reader Support

### Angular LiveAnnouncer Usage
Screen reader announcements for dynamic content updates:

```typescript
// Import in component
import { LiveAnnouncer } from '@angular/cdk/a11y';

// Announce actions
announceAction(action: string, context?: string) {
  const message = this.getAnnouncementMessage(action, context);
  this.liveAnnouncer.announce(message, 'polite');
}

// Critical announcements use 'assertive' politeness
announceCritical(message: string) {
  this.liveAnnouncer.announce(message, 'assertive');
}
```

### Announcement Scenarios
| Action | Announcement | Politeness |
|--------|-------------|------------|
| Ingredient added | "Vodka added to inventory. Current quantity: 750 milliliters" | polite |
| Cocktail prepared | "Margarita prepared. Stock deducted from inventory. [UNDO]" | polite |
| AI generation complete | "AI recipe generated: Tropical Sunrise" | polite |
| Error occurred | "Error: Network connection lost." | assertive |
| Form validation error | "Error: Quantity must be a positive number" | assertive |
| Search results loaded | "15 cocktails found" | polite |
| Inventory low | "Warning: Vodka running low. 100 milliliters remaining" | polite |

### ARIA Labels & Roles
```html
<!-- Cocktail card with proper semantics -->
<article class="cocktail-card" role="article" aria-labelledby="cocktail-title-123">
  <div class="card-image" role="img" aria-label="Photo of Margarita cocktail">
    <img [src]="imageUrl" alt="Margarita cocktail with salt rim and lime wedge">
    <button class="favorite-btn" 
            [attr.aria-label]="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
            [attr.aria-pressed]="isFavorite">
      <app-icon [name]="isFavorite ? 'heart-filled' : 'heart-outline'"></app-icon>
    </button>
  </div>
  <div class="card-content">
    <h3 id="cocktail-title-123" class="card-title">{{ cocktail.name }}</h3>
    <div class="card-meta" aria-label="Cocktail details">
      <span class="rating" aria-label="Rating: 4.5 out of 5 stars">
        <span class="visually-hidden">Rating:</span>
        <app-icon name="star" aria-hidden="true"></app-icon>
        4.5
      </span>
      <span class="makeability-badge" 
            [attr.aria-label]="makeabilityLabel"
            role="status">
        {{ makeabilityIcon }} {{ makeabilityText }}
      </span>
    </div>
  </div>
</article>
```

## ⌨️ Keyboard Navigation

### Focus Management
```css
/* Visible focus indicator */
:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Remove default outline only when providing custom */
:focus:not(:focus-visible) {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Tab Order & Focus Traps
```html
<!-- Modal with focus trap -->
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal-content">
    <h2 id="modal-title">Add Ingredient</h2>
    
    <!-- Focus starts here -->
    <input type="text" #firstInput>
    
    <!-- Tab sequence continues naturally -->
    <input type="number">
    <select>
      <option>ml</option>
      <option>oz</option>
    </select>
    
    <!-- Focus loops within modal -->
    <div class="modal-actions">
      <button (click)="cancel()">Cancel</button>
      <button (click)="save()">Save</button>
    </div>
    
    <!-- Focus returns to trigger when modal closes -->
  </div>
</div>
```

### Skip Navigation Link
```html
<!-- First focusable element on page -->
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<main id="main-content" tabindex="-1">
  <!-- Page content -->
</main>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-primary);
  color: white;
  padding: var(--space-3);
  z-index: var(--z-index-5);
}

.skip-link:focus {
  top: 0;
}
```

## 🎨 Color & Contrast

### Minimum Contrast Ratios
```css
/* Design system ensures these ratios */
--color-text-primary: #FFFFFF;      /* 15.9:1 on #121212 */
--color-text-secondary: #B3B3B3;   /* 7.1:1 on #121212 */
--color-text-primary-light: #333333; /* 12.6:1 on #F9F9F9 */

/* Semantic colors must meet contrast */
--color-success: #2E7D32;          /* 4.6:1 on white */
--color-error: #F44336;            /* 4.5:1 on white */
--color-warning: #FF9800;          /* 3.1:1 on white (large text OK) */
```

### Non-Color Indicators
```html
<!-- Don't rely on color alone -->
<div class="status-indicator">
  <span class="status-icon" [class]="status" aria-hidden="true"></span>
  <span class="status-text">{{ statusText }}</span>
</div>

<!-- Form validation -->
<div class="form-group">
  <label for="email">Email</label>
  <input id="email" type="email" [class.error]="email.invalid">
  <div class="error-message" *ngIf="email.invalid">
    <app-icon name="alert-circle" aria-hidden="true"></app-icon>
    Please enter a valid email address
  </div>
</div>
```

### Image Text Overlays
```css
/* Ensure text remains readable over images */
.cocktail-card .card-title {
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0.4) 50%,
    transparent 100%
  );
  padding: var(--space-3);
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
```

## 📱 Touch & Mobile Accessibility

### Touch Target Sizes
```css
/* Minimum 44px × 44px for touch targets */
button, 
[role="button"],
input[type="submit"],
input[type="button"] {
  min-height: 44px;
  min-width: 44px;
}

/* Larger targets for critical actions */
.btn-primary {
  min-height: 48px;
  padding: var(--space-3) var(--space-6);
}

/* Icon buttons */
.icon-btn {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

### Gesture Alternatives
```html
<!-- Swipe actions must have button alternatives -->
<div class="inventory-item">
  <div class="item-content">
    <span class="item-name">{{ ingredient.name }}</span>
    <span class="item-quantity">{{ ingredient.quantity }} {{ ingredient.unit }}</span>
  </div>
  
  <!-- Visible action buttons -->
  <div class="item-actions">
    <button class="action-btn" (click)="edit()" aria-label="Edit {{ ingredient.name }}">
      <app-icon name="edit"></app-icon>
    </button>
    <button class="action-btn" (click)="delete()" aria-label="Delete {{ ingredient.name }}">
      <app-icon name="trash"></app-icon>
    </button>
  </div>
</div>
```

## 🔤 Text & Typography

### Readable Text
```css
/* Minimum font sizes */
body {
  font-size: 16px; /* Base size */
  line-height: 1.5; /* 150% for readability */
}

/* Responsive text scaling */
@media (min-width: 768px) {
  body {
    font-size: 18px;
  }
}

/* Allow user text scaling */
html {
  font-size: 100%; /* Respect browser settings */
}

/* No fixed heights that could clip text */
.btn {
  min-height: 44px;
  /* Not height: 44px; */
}
```

### Text Resizing
Test that all content remains usable when:
- Text is zoomed to 200%
- Browser default font size is increased
- User uses OS-level text scaling

## 🎮 Interactive Elements

### Button States
```html
<button class="btn"
        [disabled]="isLoading"
        [attr.aria-busy]="isLoading"
        [attr.aria-disabled]="isLoading">
  <span class="btn-content" [class.visually-hidden]="isLoading">
    <app-icon name="cocktail"></app-icon>
    Prepare Drink
  </span>
  <span *ngIf="isLoading" class="loading-indicator" aria-hidden="true">
    Preparing...
  </span>
</button>
```

### Form Accessibility
```html
<form (ngSubmit)="onSubmit()" #recipeForm="ngForm">
  <!-- Fieldset for related inputs -->
  <fieldset>
    <legend>Recipe Information</legend>
    
    <!-- Label associated with input -->
    <div class="form-group">
      <label for="recipe-name">Cocktail Name *</label>
      <input id="recipe-name" 
             type="text" 
             required
             [(ngModel)]="recipe.name"
             name="name"
             [attr.aria-required]="true"
             aria-describedby="name-help">
      <div id="name-help" class="help-text">
        Enter a descriptive name for your cocktail
      </div>
    </div>
    
    <!-- Error messages with aria-live -->
    <div *ngIf="recipeForm.submitted && recipeForm.controls.name?.errors"
         class="error-message"
         role="alert"
         aria-live="polite">
      Please enter a cocktail name
    </div>
  </fieldset>
</form>
```

## 🎪 Complex Components

### Dynamic FormArray (Recipe Ingredients)
```html
<div formArrayName="ingredients" role="list" aria-label="Recipe ingredients">
  <div *ngFor="let ingredient of ingredients.controls; let i = index"
       [formGroupName]="i"
       role="listitem"
       class="ingredient-row">
    
    <!-- Ingredient name with autocomplete -->
    <div class="form-group">
      <label [for]="'ingredient-name-' + i" class="visually-hidden">
        Ingredient {{ i + 1 }} name
      </label>
      <input [id]="'ingredient-name-' + i"
             type="text"
             formControlName="name"
             [attr.aria-label]="'Ingredient ' + (i + 1) + ' name'"
             [attr.aria-describedby]="'ingredient-help-' + i">
      <div [id]="'ingredient-help-' + i" class="visually-hidden">
        Type to search ingredients. Press enter to select.
      </div>
    </div>
    
    <!-- Measurement -->
    <div class="form-group">
      <label [for]="'ingredient-measure-' + i" class="visually-hidden">
        Ingredient {{ i + 1 }} measurement
      </label>
      <input [id]="'ingredient-measure-' + i"
             type="text"
             formControlName="measure"
             [attr.aria-label]="'Ingredient ' + (i + 1) + ' measurement'"
             placeholder="1 1/2 oz">
    </div>
    
    <!-- Remove button -->
    <button type="button"
            class="remove-btn"
            (click)="removeIngredient(i)"
            [attr.aria-label]="'Remove ingredient ' + (i + 1)">
      <app-icon name="trash" aria-hidden="true"></app-icon>
    </button>
  </div>
  
  <!-- Add button announces action -->
  <button type="button"
          class="add-btn"
          (click)="addIngredient()"
          aria-label="Add new ingredient row">
    <app-icon name="plus" aria-hidden="true"></app-icon>
    Add Ingredient
  </button>
</div>
```

### Data Tables (Admin)
```html
<table role="grid" aria-label="Pending ingredient submissions">
  <thead>
    <tr>
      <th scope="col" role="columnheader">Ingredient Name</th>
      <th scope="col" role="columnheader">Submitted By</th>
      <th scope="col" role="columnheader">Date</th>
      <th scope="col" role="columnheader">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let item of pendingItems; let i = index"
        role="row"
        [attr.aria-rowindex]="i + 2">
      <td role="gridcell">{{ item.name }}</td>
      <td role="gridcell">{{ item.user }}</td>
      <td role="gridcell">{{ item.date | date }}</td>
      <td role="gridcell">
        <div class="action-buttons">
          <button (click)="approve(item)"
                  aria-label="Approve {{ item.name }}">
            Approve
          </button>
          <button (click)="reject(item)"
                  aria-label="Reject {{ item.name }}">
            Reject
          </button>
        </div>
      </td>
    </tr>
  </tbody>
</table>
```

## 🧪 Testing & Validation

### Automated Testing
```bash
# Run accessibility tests
npm run test:a11y

# Check color contrast
npm run test:contrast

# Validate HTML
npm run test:html
```

### Manual Testing Checklist
- [ ] **Screen Readers**: Navigate entire app with VoiceOver/NVDA
- [ ] **Keyboard Only**: Complete all flows without mouse
- [ ] **Zoom 200%**: All content remains usable
- [ ] **Color Blindness**: Use simulator to check color dependencies
- [ ] **Motion Reduction**: Test with `prefers-reduced-motion`
- [ ] **Focus Order**: Logical tab sequence
- [ ] **Form Labels**: All inputs have associated labels
- [ ] **Error Messages**: Clear, announced to screen readers
- [ ] **Timeouts**: Adjustable or extendable time limits
- [ ] **Audio/Video**: Captions and transcripts available

### Tools & Resources
- **axe DevTools**: Automated accessibility testing
- **Color Contrast Analyzer**: Check contrast ratios
- **Screen Reader**: VoiceOver (macOS/iOS), NVDA (Windows)
- **Keyboard**: Tab through entire application
- **Lighthouse**: Chrome DevTools accessibility audit

## 📚 Documentation & Training

### Developer Guidelines
1. **Semantic HTML**: Use appropriate elements (`<button>`, `<nav>`, `<main>`)
2. **ARIA When Necessary**: Only use ARIA when native HTML isn't sufficient
3. **Test Early**: Test accessibility during development, not after
4. **User Testing**: Include users with disabilities in testing

### Content Guidelines
1. **Alt Text**: Describe images concisely and meaningfully
2. **Link Text**: Use descriptive text, not "click here"
3. **Headings**: Logical hierarchy (h1 → h2 → h3)
4. **Language**: Clear, simple language appropriate for audience

---

*Last updated: April 9, 2026*