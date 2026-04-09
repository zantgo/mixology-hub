# 🖼️ Asset Management

This document defines the standards for images, icons, logos, and other visual assets in MixologyHub. Proper asset management ensures consistent quality, performance, and user experience.

## 🎨 Iconography

### Icon Set: Lucide Icons with AppIcon Wrapper
MixologyHub uses **Lucide Icons** for its clean, consistent, and open-source design. We wrap Lucide icons in a custom `<app-icon>` component for consistency and future-proofing.

**Installation:**
```bash
npm install lucide-angular
```

**AppIcon Wrapper Component (Day 1 Implementation):**
```typescript
// app-icon.component.ts
import { Component, Input } from '@angular/core';
import { LucideIconData, icons } from 'lucide-angular';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <lucide-icon 
      [name]="name" 
      [size]="size" 
      [color]="color" 
      [strokeWidth]="strokeWidth"
      [class]="className"
      [attr.aria-label]="ariaLabel"
      [attr.aria-hidden]="ariaHidden">
    </lucide-icon>
  `
})
export class AppIconComponent {
  @Input() name!: keyof typeof icons;
  @Input() size: number | string = 24;
  @Input() color: string = 'currentColor';
  @Input() strokeWidth: number = 2;
  @Input() className: string = '';
  @Input() ariaLabel?: string;
  @Input() ariaHidden: boolean | string = true;
  
  // Optional: Add fill property for specific icons
  @Input() fill?: string;
}

// app.module.ts or standalone component imports
import { LucideAngularModule } from 'lucide-angular';
import { AppIconComponent } from './shared/components/app-icon.component';

// Register all needed icons
@NgModule({
  imports: [
    LucideAngularModule.pick(icons) // Import all Lucide icons
  ],
  declarations: [AppIconComponent],
  exports: [AppIconComponent]
})
export class SharedModule {}
```

**Usage in Angular Components:**
```html
<app-icon name="cocktail" size="24" color="currentColor"></app-icon>
<app-icon name="heart" [fill]="isFavorite ? 'red' : 'none'"></app-icon>
<app-icon name="search" size="20" aria-label="Search cocktails"></app-icon>
```

**Component Usage:**
```html
<app-icon name="cocktail" size="24" color="currentColor"></app-icon>
<app-icon name="heart" [fill]="isFavorite ? 'red' : 'none'"></app-icon>
```

### Icon Specifications
| Size | Use Case | CSS Variable |
|------|----------|--------------|
| 16px | Small buttons, inline icons | `--icon-size-xs` |
| 20px | Form inputs, list items | `--icon-size-sm` |
| 24px | Standard buttons, navigation | `--icon-size-md` |
| 32px | Large buttons, feature icons | `--icon-size-lg` |
| 48px | Empty states, hero icons | `--icon-size-xl` |
| 64px | Marketing, illustrations | `--icon-size-2xl` |

**Stroke Width:** 2px (Lucide default)
**Color:** Inherit from parent (`currentColor`) or use semantic colors

### Custom Icons
For icons not available in Lucide, create SVG components:

```html
<!-- src/app/shared/icons/makeability-icon.component.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
</svg>
```

```typescript
// makeability-icon.component.ts
@Component({
  selector: 'app-makeability-icon',
  standalone: true,
  template: `<!-- SVG content -->`
})
export class MakeabilityIconComponent {
  @Input() size: number = 24;
  @Input() color: string = 'currentColor';
  @Input() status: 'makeable' | 'almost' | 'unmakeable' = 'makeable';
}
```

## 🖼️ Image Management

### Cocktail Images
**Source Priority:**
1. User-uploaded images (custom recipes)
2. TheCocktailDB API images
3. Placeholder images (fallback)

**Image Specifications:**
- **Aspect Ratio:** 16:9 for cards, 4:3 for details
- **Quality:** WebP format with JPEG fallback
- **Size:** Max 800px width for mobile, 1200px for desktop
- **Compression:** 80% quality for WebP, 85% for JPEG

### Image Loading Strategy
```html
<!-- Progressive image loading -->
<div class="image-container">
  <img [src]="imageUrl"
       [alt]="altText"
       loading="lazy"
       (error)="onImageError($event)"
       [class.loaded]="isLoaded"
       (load)="isLoaded = true">
  
  <!-- Low-quality image placeholder (LQIP) -->
  <img [src]="lqipUrl"
       [alt]=""
       aria-hidden="true"
       class="lqip"
       *ngIf="!isLoaded">
</div>
```

```css
.image-container {
  position: relative;
  overflow: hidden;
}

img {
  width: 100%;
  height: auto;
  transition: opacity 0.3s ease;
}

.lqip {
  position: absolute;
  top: 0;
  left: 0;
  filter: blur(20px);
  transform: scale(1.1);
}

img.loaded {
  opacity: 1;
}

img:not(.loaded) {
  opacity: 0;
}
```

### Image Fallback System (UC 7.9 & 2.32)
When external API images fail (404, network error):

```typescript
// image-fallback.service.ts
@Injectable({ providedIn: 'root' })
export class ImageFallbackService {
  private readonly PLACEHOLDER_PATH = '/assets/images/cocktail-placeholder.jpg';
  
  getFallbackImage(category?: string): string {
    const categoryPlaceholders: Record<string, string> = {
      'spirits': '/assets/images/spirit-placeholder.jpg',
      'cocktails': '/assets/images/cocktail-placeholder.jpg',
      'users': '/assets/images/user-placeholder.jpg',
      'default': this.PLACEHOLDER_PATH
    };
    
    return categoryPlaceholders[category || 'default'];
  }
  
  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const category = img.dataset['category'];
    img.src = this.getFallbackImage(category);
    
    // Announce to screen readers
    this.liveAnnouncer.announce('Image failed to load, showing placeholder', 'polite');
  }
}
```

## 🎭 Placeholder Images

### Cocktail Placeholder Design
**File:** `/assets/images/cocktail-placeholder.jpg`

**Design Specifications:**
- **Style:** Minimalist vector illustration
- **Colors:** Use design system colors
- **Content:** Cocktail glass silhouette on gradient background
- **Dimensions:** 800×450px (16:9 aspect ratio)
- **Format:** WebP (primary), JPEG (fallback)

**SVG Alternative:**
```svg
<!-- /assets/images/cocktail-placeholder.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#121212"/>
      <stop offset="100%" stop-color="#1E1E1E"/>
    </linearGradient>
  </defs>
  
  <rect width="800" height="450" fill="url(#gradient)"/>
  
  <!-- Cocktail glass -->
  <path d="M400,200 L450,350 L350,350 Z" 
        fill="none" 
        stroke="#D97736" 
        stroke-width="8"/>
  
  <circle cx="400" cy="180" r="60" 
          fill="none" 
          stroke="#2E7D32" 
          stroke-width="6"/>
  
  <!-- Ice cubes -->
  <rect x="380" y="220" width="20" height="20" 
        fill="rgba(255,255,255,0.2)" 
        rx="4"/>
  <rect x="420" y="240" width="15" height="15" 
        fill="rgba(255,255,255,0.15)" 
        rx="3"/>
</svg>
```

### User Avatar Placeholders
```typescript
// avatar.service.ts
generateAvatar(initials: string, userId: number): string {
  // Generate consistent color based on user ID
  const colors = [
    '#D97736', '#2E7D32', '#2196F3', '#9C27B0',
    '#FF9800', '#F44336', '#607D8B', '#795548'
  ];
  const colorIndex = userId % colors.length;
  
  // Create SVG avatar
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" 
          width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="50" fill="${colors[colorIndex]}"/>
          <text x="50" y="55" text-anchor="middle" fill="white" 
                font-family="Inter, sans-serif" font-size="40">
            ${initials}
          </text>
        </svg>`;
}
```

## 🏷️ Logo & Brand Assets

### Primary Logo
**File:** `/assets/logo/logo.svg`

**Usage Guidelines:**
- **Navigation:** 40px height in header
- **Footer:** 32px height
- **Favicon:** 32×32px PNG
- **Print:** Vector EPS for print materials

**Logo Variations:**
- `logo.svg` - Full color
- `logo-white.svg` - White for dark backgrounds
- `logo-mark.svg` - Icon only (cocktail glass)
- `logo-horizontal.svg` - Horizontal layout

### Favicon & App Icons
```html
<!-- index.html -->
<link rel="icon" type="image/svg+xml" href="/assets/logo/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/logo/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/logo/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/logo/apple-touch-icon.png">
<link rel="manifest" href="/assets/logo/site.webmanifest">
```

**Sizes Required:**
- 16×16, 32×32, 48×48 (favicon)
- 180×180 (Apple Touch Icon)
- 192×192, 512×512 (PWA)
- 1024×1024 (App Store)

## 📁 Asset Directory Structure

```
src/
├── assets/
│   ├── icons/              # SVG icons (custom)
│   │   ├── makeability.svg
│   │   ├── ai-bartender.svg
│   │   └── unit-converter.svg
│   ├── images/
│   │   ├── placeholders/
│   │   │   ├── cocktail-placeholder.jpg
│   │   │   ├── spirit-placeholder.jpg
│   │   │   ├── user-placeholder.jpg
│   │   │   └── empty-states/
│   │   │       ├── empty-bar.svg
│   │   │       ├── empty-search.svg
│   │   │       └── empty-favorites.svg
│   │   ├── illustrations/
│   │   │   ├── onboarding-1.svg
│   │   │   ├── onboarding-2.svg
│   │   │   └── ai-generation.svg
│   │   └── backgrounds/
│   │       ├── gradient-speakeasy.jpg
│   │       └── texture-paper.png
│   ├── logo/
│   │   ├── logo.svg
│   │   ├── logo-white.svg
│   │   ├── logo-mark.svg
│   │   ├── favicon.ico
│   │   └── site.webmanifest
│   └── fonts/
│       ├── Inter.woff2
│       ├── Inter-Italic.woff2
│       ├── PlayfairDisplay.woff2
│       └── PlayfairDisplay-Italic.woff2
```

## ⚡ Performance Optimization

### Image Optimization Pipeline
```bash
# Development script for optimizing images
npm run optimize:images

# Script content (package.json):
"scripts": {
  "optimize:images": "sharp-cli optimize ./src/assets/images --output ./src/assets/images/optimized --format webp --quality 80"
}
```

### Lazy Loading Strategy
```typescript
// Intersection Observer for lazy loading
@Directive({
  selector: '[appLazyLoad]',
  standalone: true
})
export class LazyLoadDirective implements AfterViewInit, OnDestroy {
  @Input('appLazyLoad') imageUrl!: string;
  
  private observer!: IntersectionObserver;
  
  ngAfterViewInit() {
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage();
          this.observer.unobserve(entry.target);
        }
      });
    });
    
    this.observer.observe(this.el.nativeElement);
  }
  
  private loadImage() {
    const img = new Image();
    img.src = this.imageUrl;
    img.onload = () => {
      this.el.nativeElement.src = this.imageUrl;
      this.el.nativeElement.classList.add('loaded');
    };
  }
}
```

### Responsive Images
```html
<picture>
  <!-- WebP (modern browsers) -->
  <source type="image/webp" 
          srcset="cocktail-400.webp 400w,
                  cocktail-800.webp 800w,
                  cocktail-1200.webp 1200w"
          sizes="(max-width: 768px) 100vw, 50vw">
  
  <!-- JPEG fallback -->
  <source type="image/jpeg" 
          srcset="cocktail-400.jpg 400w,
                  cocktail-800.jpg 800w,
                  cocktail-1200.jpg 1200w"
          sizes="(max-width: 768px) 100vw, 50vw">
  
  <!-- Default -->
  <img src="cocktail-400.jpg" 
       alt="Margarita cocktail" 
       loading="lazy">
</picture>
```

## 🎨 Asset Creation Guidelines

### Design Tools & Specifications
- **Vector Graphics**: Adobe Illustrator or Figma
- **Export Format**: SVG for icons, WebP for photos
- **Color Mode**: sRGB for web
- **Resolution**: 72 DPI for screen

### Naming Convention
```
{type}-{name}-{size}-{state}.{ext}

Examples:
icon-heart-24-filled.svg
cocktail-margarita-800.jpg
placeholder-empty-bar-400.svg
avatar-user-default-100.png
```

### Accessibility Requirements
- **SVG Icons**: Include `aria-hidden="true"` when decorative
- **Images**: Always provide alt text
- **Complex Images**: Provide long descriptions
- **Color**: Ensure sufficient contrast

## 🔄 Asset Updates & Versioning

### Update Process
1. **Design Approval**: All assets must be approved by design team
2. **Optimization**: Run through optimization pipeline
3. **Testing**: Verify on different devices and browsers
4. **Documentation**: Update this document with changes
5. **Deployment**: Include in next release

### Version Control
- Keep original source files in `/design-source/` directory
- Commit optimized assets to repository
- Use Git LFS for large binary files
- Maintain changelog for major asset updates

---

*Last updated: April 9, 2026*