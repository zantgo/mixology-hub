# 🎨 Design Documentation

This directory contains the complete design system and UX specifications for MixologyHub. All frontend development must reference these documents to ensure consistency and quality.

## 📚 Documentation Structure

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[design-system.md](./design-system.md)** | Core visual primitives (Colors, Typography, Spacing) | Before creating any UI component |
| **[component-library.md](./component-library.md)** | Reusable UI elements (Buttons, Cards, Forms) | When building Angular components |
| **[ui-ux-flows.md](./ui-ux-flows.md)** | User journeys & screen flows | When implementing new views or features |
| **[responsive-layout.md](./responsive-layout.md)** | Breakpoints, grids, and device-specific rules | When making responsive layouts |
| **[motion-and-states.md](./motion-and-states.md)** | Animations, loading, empty, and error states | When adding interactive elements |
| **[accessibility-a11y.md](./accessibility-a11y.md)** | Screen reader, keyboard navigation, and contrast rules | When implementing accessibility features |
| **[asset-management.md](./asset-management.md)** | Logos, icons, and image fallback strategies | When working with images or icons |

## 🧭 Documentation Routing (Read before acting)

Depending on the task assigned by the user, use your file reading tool (`read_file`) to consult the exact document:

- 🎨 **If you are going to create or modify UI/Components (Buttons, Cards, Forms):** Read `docs/design/component-library.md` and `docs/design/design-system.md`.
- 📱 **If you are going to create a new view or flow (e.g., the Inventory screen):** Read `docs/design/ui-ux-flows.md`.
- ♿ **If you are going to work on accessibility or semantic HTML:** Read `docs/design/accessibility-a11y.md`.
- ⚙️ **If you are going to create Backend logic (Services, Controllers):** Review `docs/architecture/backend-architecture.md` and the specific use case in `docs/product/use-cases/`.
- 🗄️ **If you are going to modify the database:** Read `docs/database/database-schema.md`.

_Strict rule:_ DO NOT assume the design. Always verify CSS variables and structure in the `/docs/design/` files before creating a component.

## 🎯 Design Principles

1. **Modern Speakeasy**: Premium, appetizing aesthetic blending utility with leisure
2. **Mobile-First**: Users will be standing at their home bar with phones
3. **Responsive & Fluid**: Seamless experience across all device sizes
4. **Accessible by Default**: WCAG AA compliance for all users
5. **Performance-Conscious**: Fast loading, smooth animations, skeleton loaders
6. **Delightful Micro-interactions**: Small animations that confirm actions and improve UX

## 🔗 Related Documentation

- [Backend Architecture](../architecture/backend-architecture.md)
- [Database Schema](../database/database-schema.md)
- [Use Cases](../product/use-cases/)
- [API Documentation](../api/)

## 🚀 Getting Started for Developers

1. **Read the design system** to understand visual tokens
2. **Check component library** for existing patterns
3. **Review UX flows** for user journey context
4. **Implement with Angular Signals** for reactive state management
5. **Follow accessibility guidelines** for inclusive design
6. **Test responsive behavior** across breakpoints

---

*Last updated: April 9, 2026*