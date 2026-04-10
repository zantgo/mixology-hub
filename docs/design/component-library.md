# 🧩 Component Library

This document defines the reusable UI components for MixologyHub. All components are built as Angular standalone components in `src/app/shared/components/`. Follow these specifications exactly.

## 🎯 Component Design Principles

1. **Standalone Components**: All components are standalone (no NgModules)
2. **Signals-Based**: Use Angular Signals for reactive state
3. **Accessible**: Follow WCAG AA standards
4. **Responsive**: Work across all breakpoints
5. **Consistent**: Use design system tokens exclusively

## 🎨 Button Components

### Primary Button
```html
<button class="btn btn-primary" [disabled]="isDisabled">
  <span class="btn-content">
    <app-icon *ngIf="icon" [name]="icon"></app-icon>
    {{ label }}
  </span>
</button>
```

**Specifications:**
- **Background**: `var(--color-primary)`
- **Text Color**: White
- **Padding**: `var(--space-3) var(--space-6)`
- **Border Radius**: `var(--border-radius-md)`
- **Font**: `var(--font-family-body)`, `var(--font-weight-medium)`
- **Hover**: Darken background 15% (`var(--color-primary-dark)`)
- **Active**: Lighten background 10% (`var(--color-primary-light)`)
- **Disabled**: 40% opacity, no hover effects
- **Focus**: 2px outline `var(--color-primary)` with `var(--space-1)` offset

**Variants:**
- **Secondary**: `btn-secondary` - Uses `var(--color-secondary)`
- **Outline**: `btn-outline` - Transparent background, colored border
- **Ghost**: `btn-ghost` - Transparent, colored text only
- **Icon Only**: Square aspect ratio, centered icon

### FAB (Floating Action Button)
Used for primary actions like "Prepare Drink"
```html
<button class="fab fab-primary" aria-label="Prepare cocktail">
  <app-icon name="cocktail"></app-icon>
</button>
```

**Specifications:**
- **Size**: 56px × 56px
- **Position**: Fixed bottom-right with `var(--space-6)` margin
- **Shadow**: `var(--shadow-fab)`
- **Hover**: Scale 1.05, elevate shadow
- **Active**: Scale 0.95

## 🃏 Card Components

### Cocktail Card
```html
<article class="cocktail-card">
  <div class="card-image">
    <!-- Local thumbnail rendered directly from backend uploads -->
    <img [src]="cocktail.imageThumb || '/assets/images/cocktail-placeholder.jpg'" [alt]="cocktail.name" (error)="onImageError($event)">
    <button class="favorite-btn" (click)="toggleFavorite()" aria-label="Toggle favorite">
      <app-icon [name]="isFavorite ? 'heart-filled' : 'heart-outline'"></app-icon>
    </button>
    <span class="makeability-badge" [class]="makeabilityClass">
      {{ makeabilityLabel }}
    </span>
  </div>
  <div class="card-content">
    <h3 class="card-title">{{ cocktail.name }}</h3>
    <div class="card-meta">
      <span class="rating">
        <app-icon name="star"></app-icon>
        {{ cocktail.rating }}
      </span>
      <span class="ai-badge" *ngIf="cocktail.isAiGenerated">
        <app-icon name="robot"></app-icon>
        AI Generated
      </span>
    </div>
  </div>
</article>
```

**Specifications:**
- **Container**: `var(--color-bg-secondary)`, `var(--border-radius-lg)`
- **Shadow**: `var(--shadow-card)`
- **Hover**: `var(--shadow-card-hover)`, translateY(-2px)
- **Image**: 1:1 aspect ratio (square), object-fit cover
- **Favorite Button**: Positioned top-right, 40px × 40px
- **Makeability Badge**: Positioned top-left with color coding:
  - 🟢 Makeable: `var(--color-makeable)`
  - 🟡 Almost: `var(--color-almost)`
  - 🔴 Unmakeable: `var(--color-unmakeable)`
- **AI Badge**: `var(--color-info)` background, robot icon

### Inventory Card (My Bar)
```html
<div class="inventory-card">
  <div class="ingredient-header">
    <h4>{{ ingredient.name }}</h4>
    <span class="category-badge">{{ ingredient.category }}</span>
  </div>
  <div class="quantity-controls">
    <button class="quantity-btn" (click)="decrement()" aria-label="Decrease quantity">
      <app-icon name="minus"></app-icon>
    </button>
    <div class="quantity-display">
      <span class="amount">{{ currentQuantity }}</span>
      <span class="unit">{{ ingredient.unit }}</span>
    </div>
    <button class="quantity-btn" (click)="increment()" aria-label="Increase quantity">
      <app-icon name="plus"></app-icon>
    </button>
  </div>
  <div class="progress-bar">
    <div class="progress-fill" [style.width.%]="percentageRemaining"></div>
  </div>
</div>
```

## 📝 Form Components

### Text Input
```html
<div class="form-group">
  <label [for]="inputId" class="form-label">{{ label }}</label>
  <input
    [id]="inputId"
    type="text"
    class="form-input"
    [placeholder]="placeholder"
    [formControl]="control"
    [attr.aria-invalid]="control.invalid && control.touched"
    [attr.aria-describedby]="errorId"
  />
  <div *ngIf="control.invalid && control.touched" class="form-error">
    <app-icon name="alert-circle"></app-icon>
    {{ getErrorMessage() }}
  </div>
</div>
```

**Specifications:**
- **Height**: 48px
- **Padding**: `var(--space-3) var(--space-4)`
- **Background**: `var(--color-bg-tertiary)`
- **Border**: 1px solid `var(--color-border)`
- **Border Radius**: `var(--border-radius-md)`
- **Focus**: 2px outline `var(--color-primary)`
- **Error State**: Red border `var(--color-error)`, red text

### Unit Select Dropdown
For ml/oz selection in inventory management
```html
<select class="unit-select" [formControl]="unitControl">
  <option value="ml">Milliliters (ml)</option>
  <option value="oz">Ounces (oz)</option>
  <option value="count">Count</option>
  <option value="g">Grams (g)</option>
</select>
```

### Dynamic FormArray Row (Recipe Creation)
```html
<div class="form-array-row" [formGroup]="ingredientForm">
  <div class="row-content">
    <app-autocomplete-input
      formControlName="name"
      [suggestions]="ingredientSuggestions"
      placeholder="Search ingredient..."
    ></app-autocomplete-input>
    <input
      type="text"
      class="measure-input"
      formControlName="measure"
      placeholder="1 1/2 oz"
      aria-label="Measurement"
    />
  </div>
  <button
    type="button"
    class="remove-row-btn"
    (click)="remove.emit()"
    aria-label="Remove ingredient"
  >
    <app-icon name="trash"></app-icon>
  </button>
</div>
```

## 🏷️ Badge & Tag Components

### Status Badge
```html
<span class="status-badge" [class]="status">
  <app-icon [name]="statusIcon"></app-icon>
  {{ statusText }}
</span>
```

**Status Types:**
- **Makeable**: Green background, check icon
- **Almost**: Orange background, alert icon
- **Unmakeable**: Red background, x icon
- **AI Generated**: Blue background, robot icon
- **Custom**: Purple background, edit icon

### Category Tag
```html
<span class="category-tag" [style.background]="categoryColor">
  {{ categoryName }}
</span>
```

**Categories & Colors:**
- **Spirits**: Deep amber `#8B4513`
- **Mixers**: Light green `#90EE90`
- **Garnishes**: Bright red `#FF6B6B`
- **Bitters**: Dark brown `#654321`
- **Syrups**: Golden `#FFD700`

## 📊 Progress & Status Components

### Progress Bar
```html
<div class="progress-container">
  <div class="progress-bar">
    <div class="progress-fill" [style.width.%]="percentage"></div>
  </div>
  <div class="progress-labels">
    <span class="current">{{ current }}/{{ total }} {{ unit }}</span>
    <span class="percentage">{{ percentage }}%</span>
  </div>
</div>
```

### Skeleton Loader
Used during AI generation and API calls
```html
<div class="skeleton-loader" [style.width]="width" [style.height]="height">
  <div class="shimmer"></div>
</div>
```

**Specifications:**
- **Background**: `var(--color-bg-tertiary)`
- **Shimmer**: Linear gradient animation
- **Duration**: 1.5s infinite
- **Types**: Card, text, circle, rectangle

## 🍸 Specialized Components

### Makeability Indicator
Visual indicator showing what ingredients are missing
```html
<div class="makeability-indicator">
  <div class="ingredient-list">
    <div *ngFor="let ingredient of ingredients" class="ingredient-item">
      <app-icon
        [name]="ingredient.inStock ? 'check-circle' : 'x-circle'"
        [class.in-stock]="ingredient.inStock"
        [class.missing]="!ingredient.inStock"
      ></app-icon>
      <span class="ingredient-name">{{ ingredient.name }}</span>
      <span class="quantity" *ngIf="ingredient.inStock">
        ({{ ingredient.have }}/{{ ingredient.need }} {{ ingredient.unit }})
      </span>
    </div>
  </div>
  <div class="summary">
    <span class="status-badge" [class]="overallStatus">
      {{ missingCount === 0 ? 'Makeable' : `Missing ${missingCount}` }}
    </span>
  </div>
</div>
```

### Unit Converter Display
Shows both metric and imperial units
```html
<div class="unit-converter">
  <span class="primary-unit">{{ primaryValue }} {{ primaryUnit }}</span>
  <span class="conversion">≈ {{ convertedValue }} {{ convertedUnit }}</span>
</div>
```

## 📝 Text Truncation & Long Data Handling

### Utility Classes for Text Truncation
```css
/* Text truncation utilities */
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-clamp-1 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.line-clamp-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.line-clamp-3 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

/* Usage in components */
.cocktail-card .card-title {
  @apply line-clamp-2; /* Maximum 2 lines for cocktail names */
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-2);
}

.ingredient-name {
  @apply text-truncate; /* Single line with ellipsis */
  max-width: 200px;
}

.recipe-description {
  @apply line-clamp-3; /* Maximum 3 lines for descriptions */
  color: var(--color-text-secondary);
}
```

### Component-Specific Truncation Rules
| Component | Field | Truncation Rule | Max Characters |
|-----------|-------|----------------|----------------|
| Cocktail Card | Title | line-clamp-2 | 50 chars visible |
| Cocktail Card | Description | line-clamp-3 | 150 chars visible |
| Inventory Item | Name | text-truncate | 30 chars |
| Search Result | Author | text-truncate | 25 chars |
| Admin Table | User Email | text-truncate | 40 chars |

### Tooltip for Truncated Text
```html
<!-- Show full text on hover/focus -->
<span class="truncated-text" 
      [title]="fullText"
      [attr.aria-label]="fullText">
  {{ truncatedText }}
</span>
```

```typescript
// Truncation service
@Injectable({ providedIn: 'root' })
export class TextTruncationService {
  truncate(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  needsTruncation(text: string, maxLength: number): boolean {
    return text && text.length > maxLength;
  }
}
```

## ✅ Form Validation Strategy

### Validation Timing & User Experience
**Senior Recommendation:** Validate OnBlur for regular fields, and OnSubmit for the entire form. Show success state (green border) when field is valid.

**Validation States Flow:**
1. **Pristine**: User hasn't interacted yet → Show neutral styling
2. **Touched + Valid**: User left field and it's valid → Show success state
3. **Touched + Invalid**: User left field and it's invalid → Show error immediately
4. **Submitted + Invalid**: Form submitted with errors → Show all errors

**CSS Implementation:**
```css
/* Form Validation States */
.form-input {
  /* Base state */
  border: 1px solid var(--color-border);
  transition: all var(--duration-normal) var(--ease-out);
}

.form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(217, 119, 54, 0.2);
}

.form-input.valid {
  /* Success state - green border when valid */
  border-color: var(--color-success);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232E7D32'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-3) center;
  background-size: 16px;
  padding-right: calc(var(--space-3) * 2 + 16px);
}

.form-input.invalid {
  /* Error state - red border when invalid */
  border-color: var(--color-error);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23F44336'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-3) center;
  background-size: 16px;
  padding-right: calc(var(--space-3) * 2 + 16px);
}

/* Error message animations */
.form-error {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: all var(--duration-normal) var(--ease-out);
}

.form-error.show {
  max-height: 100px;
  opacity: 1;
  margin-top: var(--space-2);
}
```

**Angular Reactive Forms Implementation:**
```typescript
@Component({
  selector: 'app-cocktail-form',
  standalone: true
})
export class CocktailFormComponent {
  cocktailForm = new FormGroup({
    name: new FormControl('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(100)
    ]),
    description: new FormControl('', [
      Validators.maxLength(500)
    ]),
    servings: new FormControl(1, [
      Validators.required,
      Validators.min(1),
      Validators.max(20)
    ])
  });

  // Track field interaction state
  fieldStates = signal<Record<string, { touched: boolean; blurred: boolean }>>({});

  // Update field state on blur
  onFieldBlur(fieldName: string) {
    this.fieldStates.update(states => ({
      ...states,
      [fieldName]: { ...states[fieldName], blurred: true, touched: true }
    }));
    
    // Validate the field
    const control = this.cocktailForm.get(fieldName);
    if (control) {
      control.updateValueAndValidity({ onlySelf: true });
    }
  }

  // Check if field should show success state
  showSuccess(fieldName: string): boolean {
    const control = this.cocktailForm.get(fieldName);
    const state = this.fieldStates()[fieldName];
    return !!control && control.valid && !!state?.blurred;
  }

  // Check if field should show error state
  showError(fieldName: string): boolean {
    const control = this.cocktailForm.get(fieldName);
    const state = this.fieldStates()[fieldName];
    return !!control && control.invalid && !!state?.blurred;
  }

  onSubmit() {
    // Mark all fields as blurred to show all errors
    Object.keys(this.cocktailForm.controls).forEach(fieldName => {
      this.fieldStates.update(states => ({
        ...states,
        [fieldName]: { ...states[fieldName], blurred: true, touched: true }
      }));
    });

    if (this.cocktailForm.valid) {
      // Submit the form
      console.log('Form submitted:', this.cocktailForm.value);
    }
  }
}
```

**Template Example:**
```html
<form [formGroup]="cocktailForm" (ngSubmit)="onSubmit()">
  <div class="form-group">
    <label for="cocktail-name">Cocktail Name *</label>
    <input id="cocktail-name"
           type="text"
           formControlName="name"
           (blur)="onFieldBlur('name')"
           [class.valid]="showSuccess('name')"
           [class.invalid]="showError('name')"
           aria-describedby="name-error name-help">
    
    <div class="form-error" 
         [class.show]="showError('name')" 
         id="name-error" 
         role="alert">
      <app-icon name="alert-circle"></app-icon>
      <span *ngIf="cocktailForm.get('name')?.errors?.['required']">
        Cocktail name is required
      </span>
      <span *ngIf="cocktailForm.get('name')?.errors?.['minlength']">
        Name must be at least 3 characters
      </span>
      <span *ngIf="cocktailForm.get('name')?.errors?.['maxlength']">
        Name cannot exceed 100 characters
      </span>
    </div>
    
    <div class="help-text" id="name-help">
      Enter a descriptive name for your cocktail (3-100 characters)
    </div>
  </div>
</form>
```

## 🎯 Component Implementation Guidelines

### Angular Signals Pattern
```typescript
@Component({
  selector: 'app-cocktail-card',
  standalone: true,
  templateUrl: './cocktail-card.component.html',
  styleUrls: ['./cocktail-card.component.scss']
})
export class CocktailCardComponent {
  cocktail = input.required<Cocktail>();
  isFavorite = signal(false);
  
  makeabilityClass = computed(() => {
    const status = this.cocktail().makeabilityStatus;
    return `makeability-${status}`;
  });
  
  toggleFavorite() {
    this.isFavorite.update(value => !value);
  }
}
```

### Accessibility Requirements
- **ARIA Labels**: All interactive elements must have descriptive labels
- **Keyboard Navigation**: Full tab navigation support
- **Focus Management**: Logical focus order, visible focus indicators
- **Screen Readers**: Use Angular's `LiveAnnouncer` for dynamic updates
- **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text

### Responsive Behavior
- **Mobile**: Stack vertically, full width
- **Tablet**: 2-column grid where appropriate
- **Desktop**: 4-column grid for cocktail cards
- **Touch Targets**: Minimum 44px × 44px for mobile

### Performance Considerations
- **Lazy Loading**: Images use `loading="lazy"`
- **Virtual Scrolling**: For long lists (inventory, search results)
- **Debounced Inputs**: 300ms delay for search inputs
- **Optimistic Updates**: Immediate UI feedback for actions

---

*Last updated: April 9, 2026*