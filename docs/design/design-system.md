# 🎨 Design System

This document defines the visual foundation of MixologyHub - the design tokens (CSS variables) that create our "Modern Speakeasy" aesthetic. All UI components must reference these variables.

## 🎨 Color Palette

### CSS Variables (Design Tokens)
```css
/* Primary Colors - Modern Speakeasy Theme */
--color-primary: #D97736;      /* Copper/Amber - Primary actions */
--color-primary-dark: #B3591F; /* Darker copper for hover states */
--color-primary-light: #F0A76C; /* Lighter copper for active states */

/* Secondary Colors */
--color-secondary: #2E7D32;    /* Mint Green - Success, Makeable states */
--color-secondary-dark: #1B5E20;
--color-secondary-light: #4CAF50;

/* Neutral Colors - Dynamic via Angular Signals */
/* Dark Mode (Default) */
--color-bg-primary: #121212;   /* Deep charcoal background */
--color-bg-secondary: #1E1E1E; /* Elevated cards */
--color-bg-tertiary: #2D2D2D;  /* Input backgrounds */
--color-text-primary: #FFFFFF; /* Primary text */
--color-text-secondary: #B3B3B3; /* Secondary text */
--color-text-tertiary: #808080; /* Disabled text */
--color-border: #404040;       /* Borders and dividers */

/* Light Mode */
--color-bg-primary-light: #F9F9F9; /* Off-white background */
--color-bg-secondary-light: #FFFFFF; /* Crisp white cards */
--color-bg-tertiary-light: #F0F0F0; /* Input backgrounds */
--color-text-primary-light: #333333; /* Slate text */
--color-text-secondary-light: #666666;
--color-text-tertiary-light: #999999;
--color-border-light: #E0E0E0;

/* Semantic Colors */
--color-success: #2E7D32;      /* Green - Success states */
--color-warning: #FF9800;      /* Orange - Warning states */
--color-error: #F44336;        /* Red - Error states */
--color-info: #2196F3;         /* Blue - Informational states */

/* Makeability Status Colors */
--color-makeable: #2E7D32;     /* 🟢 Makeable */
--color-almost: #FF9800;       /* 🟡 Missing 1 ingredient */
--color-unmakeable: #F44336;   /* 🔴 Unmakeable */

/* Data Visualization Colors (Colorblind-friendly) */
--color-chart-1: #4E79A7;      /* Blue - Primary metric */
--color-chart-2: #F28E2C;      /* Orange - Secondary metric */
--color-chart-3: #E15759;      /* Red - Negative metric */
--color-chart-4: #76B7B2;      /* Teal - Tertiary metric */
--color-chart-5: #59A14F;      /* Green - Positive metric */
--color-chart-6: #EDC949;      /* Yellow - Warning metric */
--color-chart-7: #AF7AA1;      /* Purple - Additional category */
--color-chart-8: #FF9DA7;      /* Pink - Additional category */
--color-chart-9: #9C755F;      /* Brown - Additional category */
--color-chart-10: #BAB0AB;     /* Gray - Neutral/Other */

/* Chart gradients for area charts */
--gradient-chart-1: linear-gradient(180deg, #4E79A7 0%, #2C4A7A 100%);
--gradient-chart-2: linear-gradient(180deg, #F28E2C 0%, #D2691E 100%);
--gradient-chart-3: linear-gradient(180deg, #E15759 0%, #B22222 100%);
```

### Usage Guidelines
- **Primary Color**: Use for primary buttons, active states, and key CTAs
- **Secondary Color**: Use for success states, makeable badges, and positive actions
- **Background Colors**: Use `--color-bg-primary` for main background, `--color-bg-secondary` for cards
- **Text Colors**: Maintain minimum 4.5:1 contrast ratio (WCAG AA)
- **Chart Colors**: Use sequential order (chart-1, chart-2, etc.) for categorical data. Ensure sufficient contrast between adjacent colors.

### Data Visualization Guidelines
**Colorblind-Friendly Palette**: The chart colors are selected to be distinguishable for common types of color blindness (protanopia, deuteranopia, tritanopia).

**Usage Patterns:**
- **Bar/Column Charts**: Use solid colors (`--color-chart-1` to `--color-chart-10`)
- **Area Charts**: Use gradients (`--gradient-chart-1` to `--gradient-chart-3`)
- **Pie/Donut Charts**: Use sequential colors, avoid adjacent similar hues
- **Line Charts**: Use solid colors with different dash patterns for accessibility

**Admin Dashboard Examples:**
- `--color-chart-1`: New Users
- `--color-chart-2`: Active Recipes
- `--color-chart-3`: API Errors
- `--color-chart-4`: Pending Ingredients
- `--color-chart-5`: Successful Preparations

## 🔤 Typography

### Font Families
```css
--font-family-heading: 'Playfair Display', serif;    /* Premium, classic menu feel */
--font-family-body: 'Inter', sans-serif;             /* Clean, highly legible UI */
--font-family-mono: 'Roboto Mono', monospace;        /* Code, measurements */
```

### Font Scale (4px Baseline)
```css
/* Headings */
--font-size-h1: 2.5rem;    /* 40px - Page titles */
--font-size-h2: 2rem;      /* 32px - Section headers */
--font-size-h3: 1.5rem;    /* 24px - Card titles */
--font-size-h4: 1.25rem;   /* 20px - Subheaders */
--font-size-h5: 1.125rem;  /* 18px - Small headers */
--font-size-h6: 1rem;      /* 16px - Tiny headers */

/* Body Text */
--font-size-body-large: 1.125rem;  /* 18px - Large body */
--font-size-body: 1rem;            /* 16px - Standard body */
--font-size-body-small: 0.875rem;  /* 14px - Small body */
--font-size-caption: 0.75rem;      /* 12px - Captions, labels */

/* Line Heights */
--line-height-tight: 1.2;      /* Headings */
--line-height-normal: 1.5;     /* Body text */
--line-height-loose: 1.8;      /* Long-form content */

/* Font Weights */
--font-weight-light: 300;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Usage Guidelines
- **Headings**: Use Playfair Display for cocktail names and premium titles
- **Body Text**: Use Inter for all UI text, instructions, and data
- **Measurements**: Use Roboto Mono for precise quantities (ml, oz)
- **Line Height**: Maintain 1.5 for readability, 1.2 for compact displays

## 📏 Spacing & Grid System

### Spacing Scale (4px Increments)
```css
--space-0: 0;       /* 0px */
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem;  /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem;    /* 16px */
--space-5: 1.25rem; /* 20px */
--space-6: 1.5rem;  /* 24px */
--space-8: 2rem;    /* 32px */
--space-10: 2.5rem; /* 40px */
--space-12: 3rem;   /* 48px */
--space-16: 4rem;   /* 64px */
--space-20: 5rem;   /* 80px */
```

### Grid System
- **Base Unit**: 4px (0.25rem)
- **Container Padding**: `--space-4` (16px) on mobile, `--space-6` (24px) on desktop
- **Gutters**: `--space-4` between grid items
- **Section Spacing**: `--space-8` between major sections

## 🟦 Border Radius

```css
--border-radius-none: 0;
--border-radius-sm: 0.25rem;   /* 4px - Small elements */
--border-radius-md: 0.5rem;    /* 8px - Standard buttons, inputs */
--border-radius-lg: 0.75rem;   /* 12px - Cards, modals */
--border-radius-xl: 1rem;      /* 16px - Large containers */
--border-radius-full: 9999px;  /* Pill shapes, avatars */
```

## 🌓 Shadows & Elevation

### Shadow System (Material Design inspired)
```css
/* Elevation Levels */
--shadow-0: none;
--shadow-1: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
--shadow-2: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
--shadow-3: 0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23);
--shadow-4: 0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22);
--shadow-5: 0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22);

/* Usage by Component */
--shadow-card: var(--shadow-1);
--shadow-card-hover: var(--shadow-2);
--shadow-modal: var(--shadow-3);
--shadow-toast: var(--shadow-2);
--shadow-fab: var(--shadow-3);
```

### Dark Mode Adjustments
In dark mode, reduce shadow opacity by 30% and increase blur:
```css
/* Dark mode shadows */
--shadow-card-dark: 0 2px 4px rgba(0, 0, 0, 0.3);
--shadow-card-hover-dark: 0 4px 8px rgba(0, 0, 0, 0.35);
```

## 🎭 Transitions & Animation

### Timing Functions
```css
--transition-fast: 150ms ease;
--transition-normal: 250ms ease;
--transition-slow: 350ms ease;
--transition-bounce: 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Animation Durations
```css
--duration-instant: 100ms;
--duration-fast: 200ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-deliberate: 800ms;
```

## 🎯 Z-Index Scale

```css
--z-index-negative: -1;
--z-index-0: 0;
--z-index-1: 10;      /* Dropdowns, tooltips */
--z-index-2: 20;      /* Sticky headers */
--z-index-3: 30;      /* Modals, overlays */
--z-index-4: 40;      /* Toast notifications */
--z-index-5: 50;      /* Loading overlays */
--z-index-max: 9999;  /* Emergency overlay */
```

## 🌓 Theme Switching Implementation

### Theme Options & User Experience
**Senior Recommendation:** Provide three theme options in user profile/settings:
1. **Light Mode** - Crisp white background, slate text
2. **Dark Mode** (Default) - Deep charcoal background, white text  
3. **System Default** - Follows operating system preference

### FOUC Prevention (Flash of Unstyled Content)
```typescript
// theme.service.ts - Prevent FOUC
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'mixologyhub-theme';
  private readonly theme = signal<Theme>('system');
  
  constructor() {
    this.initializeTheme();
  }
  
  private initializeTheme() {
    // 1. Check localStorage for user preference
    const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme;
    
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      this.theme.set(savedTheme);
      this.applyTheme(savedTheme);
    } else {
      // 2. Check system preference
      this.detectSystemTheme();
    }
    
    // 3. Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.theme() === 'system') {
        this.applyTheme('system');
      }
    });
  }
  
  private detectSystemTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const systemTheme: Theme = prefersDark ? 'dark' : 'light';
    this.theme.set('system');
    this.applyTheme(systemTheme);
  }
  
  private applyTheme(theme: Theme | 'light' | 'dark') {
    const effectiveTheme = theme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    
    // Update data-theme attribute on html element
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    // Update CSS custom properties
    this.updateCSSVariables(effectiveTheme);
  }
  
  private updateCSSVariables(theme: 'light' | 'dark') {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.style.setProperty('--color-bg-primary', 'var(--color-bg-primary-dark)');
      root.style.setProperty('--color-bg-secondary', 'var(--color-bg-secondary-dark)');
      root.style.setProperty('--color-text-primary', 'var(--color-text-primary-dark)');
      // ... set all dark mode variables
    } else {
      root.style.setProperty('--color-bg-primary', 'var(--color-bg-primary-light)');
      root.style.setProperty('--color-bg-secondary', 'var(--color-bg-secondary-light)');
      root.style.setProperty('--color-text-primary', 'var(--color-text-primary-light)');
      // ... set all light mode variables
    }
  }
  
  setTheme(theme: Theme) {
    this.theme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
    
    // Announce to screen readers
    this.liveAnnouncer.announce(`Theme changed to ${theme} mode`, 'polite');
  }
  
  getTheme() {
    return this.theme();
  }
}

type Theme = 'light' | 'dark' | 'system';
```

### CSS Implementation for Theme Switching
```css
/* Base CSS variables (default to dark mode) */
:root {
  --color-bg-primary: #121212;
  --color-bg-secondary: #1E1E1E;
  --color-text-primary: #FFFFFF;
  /* ... other dark mode variables */
}

/* Light mode override */
[data-theme="light"] {
  --color-bg-primary: #F9F9F9;
  --color-bg-secondary: #FFFFFF;
  --color-text-primary: #333333;
  /* ... other light mode variables */
}

/* Smooth transitions for theme switching */
* {
  transition: background-color var(--duration-normal) var(--ease-out),
              color var(--duration-normal) var(--ease-out),
              border-color var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}

/* Disable transitions during initial page load to prevent FOUC */
.initial-load * {
  transition: none !important;
}
```

### Theme Selector Component
```html
<!-- theme-selector.component.html -->
<div class="theme-selector">
  <h3>Appearance</h3>
  <div class="theme-options">
    <button class="theme-option" 
            [class.active]="themeService.getTheme() === 'light'"
            (click)="themeService.setTheme('light')"
            aria-label="Switch to light mode">
      <div class="theme-preview light">
        <div class="preview-header"></div>
        <div class="preview-content"></div>
      </div>
      <span>Light</span>
    </button>
    
    <button class="theme-option"
            [class.active]="themeService.getTheme() === 'dark'"
            (click)="themeService.setTheme('dark')"
            aria-label="Switch to dark mode">
      <div class="theme-preview dark">
        <div class="preview-header"></div>
        <div class="preview-content"></div>
      </div>
      <span>Dark</span>
    </button>
    
    <button class="theme-option"
            [class.active]="themeService.getTheme() === 'system'"
            (click)="themeService.setTheme('system')"
            aria-label="Use system theme">
      <div class="theme-preview system">
        <div class="preview-header"></div>
        <div class="preview-content"></div>
      </div>
      <span>System</span>
    </button>
  </div>
</div>
```

## 🔧 Implementation Notes

### Angular Signals Integration
Colors dynamically switch via Angular Signals:
```typescript
// Example: Theme switching
const isDarkMode = signal(true);
const backgroundColor = computed(() => 
  isDarkMode() ? 'var(--color-bg-primary)' : 'var(--color-bg-primary-light)'
);
```

### CSS Custom Properties
All design tokens are exposed as CSS custom properties in `:root`. Import the design system in your Angular component:
```scss
:host {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-family-body);
  font-size: var(--font-size-body);
}
```

### Responsive Considerations
- Use `clamp()` for fluid typography
- Use `min()` and `max()` for responsive spacing
- Test color contrast in both light and dark modes

---

*Last updated: April 9, 2026*