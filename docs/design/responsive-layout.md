# 📱 Responsive Layout

This document defines the responsive behavior and breakpoints for MixologyHub. The app follows a **mobile-first** approach since users will likely be standing at their home bar with their phones.

## 📐 Breakpoint System

### Standard Breakpoints (CSS Custom Properties)
```css
/* Mobile-first breakpoints (min-width) */
--breakpoint-sm: 640px;   /* Small tablets */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large screens */

/* Usage in media queries */
@media (min-width: var(--breakpoint-md)) {
  /* Tablet styles */
}
```

### Container Widths
```css
/* Container max-widths */
--container-sm: 100%;
--container-md: 720px;
--container-lg: 960px;
--container-xl: 1140px;
--container-2xl: 1320px;

/* Container padding */
--container-padding-mobile: var(--space-4);  /* 16px */
--container-padding-desktop: var(--space-6); /* 24px */
```

## 📱 Mobile Layout (Default)

### Navigation
- **Bottom Navigation Bar**: Fixed at bottom with 5 icons
- **Icons**: Home, Search, My Bar, AI Bartender, Profile
- **Height**: 56px (including safe area insets)
- **Active State**: Colored icon + subtle underline

### Content Layout
```html
<!-- Mobile container -->
<div class="container-mobile">
  <header class="mobile-header">
    <!-- Back button, title, actions -->
  </header>
  
  <main class="mobile-content">
    <!-- Scrollable content -->
  </main>
  
  <nav class="bottom-nav">
    <!-- Navigation icons -->
  </nav>
</div>
```

### Grid Behavior
- **Cocktail Cards**: 1 column, full width
- **Inventory List**: Full width, stacked vertically
- **Forms**: Full width inputs
- **Spacing**: `var(--space-4)` between sections

## 📟 Tablet Layout (≥ 768px)

### Navigation Transition
- **Bottom Nav Becomes Sidebar**: Collapsible left sidebar
- **Sidebar Width**: 240px when expanded, 72px when collapsed
- **Hamburger Menu**: Replaces bottom nav, appears in header

### Content Layout
```html
<!-- Tablet container -->
<div class="container-tablet">
  <aside class="sidebar">
    <!-- Navigation items -->
  </aside>
  
  <main class="tablet-content">
    <header class="tablet-header">
      <!-- Page title, search, user menu -->
    </header>
    
    <div class="content-grid">
      <!-- 2-column grid content -->
    </div>
  </main>
</div>
```

### Grid Behavior
- **Cocktail Cards**: 2 columns
- **Inventory**: 2-column grid for ingredient cards
- **Dashboard**: 2-column layout for metrics
- **Forms**: Side-by-side labels and inputs where appropriate

## 🖥️ Desktop Layout (≥ 1024px)

### Navigation
- **Persistent Sidebar**: Always visible, 240px width
- **Top Navigation**: Additional actions in header
- **Breadcrumbs**: For deep navigation paths

### Content Layout
```html
<!-- Desktop container -->
<div class="container-desktop">
  <aside class="sidebar-desktop">
    <!-- Logo, main nav, footer -->
  </aside>
  
  <div class="desktop-main">
    <header class="desktop-header">
      <!-- Breadcrumbs, search, notifications, user menu -->
    </header>
    
    <main class="desktop-content">
      <div class="desktop-grid">
        <!-- Responsive grid content -->
      </div>
    </main>
  </div>
</div>
```

### Grid Behavior
- **Cocktail Cards**: 3-4 columns depending on screen width
- **Inventory**: 3-4 column grid
- **Dashboard**: Multi-column card layout
- **Admin Interface**: Data tables with side-by-side panels

## 🍸 Cocktail Grid System

### Card Grid Specifications
```scss
.cocktail-grid {
  display: grid;
  gap: var(--space-4);
  
  /* Mobile */
  grid-template-columns: repeat(1, 1fr);
  
  /* Tablet */
  @media (min-width: var(--breakpoint-md)) {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-6);
  }
  
  /* Desktop */
  @media (min-width: var(--breakpoint-lg)) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  /* Large Desktop */
  @media (min-width: var(--breakpoint-xl)) {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### Card Aspect Ratios
- **Cocktail Cards**: 16:9 (image) + variable content height
- **Inventory Cards**: Square (1:1) or 4:3
- **Metric Cards**: 1:1 or 2:1 for dashboard

## 📊 Admin Dashboard Layout

### Desktop-Optimized (Primary)
```html
<!-- Admin layout -->
<div class="admin-layout">
  <aside class="admin-sidebar">
    <!-- Admin-specific navigation -->
  </aside>
  
  <main class="admin-main">
    <div class="admin-header">
      <!-- Page title, filters, export buttons -->
    </div>
    
    <div class="admin-content">
      <!-- Data tables, charts, moderation queues -->
    </div>
  </main>
</div>
```

### Mobile Admin Considerations
- **Simplified Views**: Stacked data instead of tables
- **Action Sheets**: Bottom sheets for actions instead of hover menus
- **Touch Targets**: Larger buttons for moderation actions
- **Priority**: Show most critical information first

## 📱 Device-Specific Considerations

### iPhone Notch & Dynamic Island
```css
/* Safe area insets */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);

/* Bottom nav with safe area */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(56px + env(safe-area-inset-bottom));
}
```

### Foldable & Large Screen Devices
```css
/* Span multiple columns on large screens */
@media (min-width: var(--breakpoint-2xl)) {
  .hero-card {
    grid-column: span 2;
  }
  
  .featured-cocktail {
    grid-column: span 3;
  }
}
```

### Touch vs Mouse Interactions
```scss
/* Larger touch targets for mobile */
@media (hover: none) and (pointer: coarse) {
  button, .clickable {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* Increase spacing for fat fingers */
  .form-input {
    padding: var(--space-4);
  }
}
```

## 🎯 Responsive Typography

### Fluid Typography
```css
/* Scale font size with viewport */
h1 {
  font-size: clamp(
    var(--font-size-h2),  /* Minimum */
    4vw,                  /* Fluid scaling */
    var(--font-size-h1)   /* Maximum */
  );
}

/* Responsive line height */
p {
  line-height: clamp(1.5, 5vw, 1.8);
}
```

### Responsive Spacing
```css
/* Fluid spacing based on viewport */
.section {
  padding: clamp(
    var(--space-4),
    5vw,
    var(--space-8)
  );
}
```

## 🔄 Layout Shift Prevention

### Aspect Ratio Boxes
```html
<!-- Prevent layout shift for images -->
<div class="aspect-ratio-box" style="--aspect-ratio: 1/1">
  <img src="cocktail.jpg" alt="Cocktail" loading="lazy" />
</div>
```

```css
.aspect-ratio-box {
  position: relative;
  padding-bottom: calc(100% / var(--aspect-ratio));
}

.aspect-ratio-box img {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Skeleton Loaders
- **Use during**: API calls, image loading, AI generation
- **Match final dimensions**: Prevent layout shift
- **Progressive disclosure**: Load above-fold content first

## 📱 Viewport-Specific Features

### Mobile-Only Features
- **Pull-to-refresh**: For inventory and search
- **Swipe actions**: Swipe to delete in inventory
- **Bottom sheets**: For forms and actions
- **Haptic feedback**: For successful actions

### Desktop-Only Features
- **Hover states**: Additional information on hover
- **Keyboard shortcuts**: For power users
- **Right-click context menus**: For admin actions
- **Drag-and-drop**: For recipe reordering

### Universal Features
- **Pinch-to-zoom**: On cocktail images
- **Text size adjustment**: Respect user preferences
- **Reduced motion**: Respect `prefers-reduced-motion`

## 🧪 Testing Guidelines

### Breakpoint Testing Checklist
- [ ] 320px (Smallest mobile)
- [ ] 375px (iPhone SE)
- [ ] 414px (iPhone Plus)
- [ ] 768px (Tablet portrait)
- [ ] 1024px (Tablet landscape)
- [ ] 1280px (Desktop)
- [ ] 1440px (Large desktop)
- [ ] 1920px (Full HD)

### Orientation Testing
- **Portrait**: Primary mobile experience
- **Landscape**: Cocktail preparation view, recipe reading

### Device Testing
- **Touch devices**: Test with actual touch
- **Mouse devices**: Test hover states
- **Keyboard navigation**: Full tab navigation
- **Screen readers**: VoiceOver, NVDA, JAWS

---

*Last updated: April 9, 2026*