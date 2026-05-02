# Product Use Cases

> **Behavior-Driven Development (BDD)** — `Given / When / Then` scenarios driving test-driven development across every domain of MixologyHub.

MixologyHub follows a rigorous BDD/TDD methodology. Every feature is derived from user-facing scenarios that serve as the single source of truth for implementation, testing, and verification. Each use case maps directly to acceptance tests and implementation specifications.

---

## Core Domains

| Domain | File | Use Cases | Summary |
|--------|------|-----------|---------|
| **Inventory Management** | [use-cases/inventory-management.md](./use-cases/inventory-management.md) | UC 1.1–1.11 | CRUD operations, measure parsing, input validation, custom ingredient scoping, zero-quantity handling |
| **Cocktail Discovery** | [use-cases/cocktail-discovery.md](./use-cases/cocktail-discovery.md) | UC 2.1–2.10 | Unified local + external search, TheCocktailDB integration, Redis caching, privacy scoping, dangling favorites |
| **Makeable Intelligence** | [use-cases/makeable-intelligence.md](./use-cases/makeable-intelligence.md) | UC 3.1–3.7 | Real-time makeability calculation, unit conversion, optional ingredients, serving-size scaling |
| **Cocktail Preparation** | [use-cases/cocktail-preparation.md](./use-cases/cocktail-preparation.md) | UC 4.1–4.5 | ACID transactions for inventory depletion, undo logic, batch preparation |
| **AI Bartender** | [use-cases/ai-bartender.md](./use-cases/ai-bartender.md) | UC 5.1–5.8 | LLM recipe generation, prompt injection defense, rate limiting, retry exhaustion, inventory-aware prompts |

---

## Platform & Experience

| Domain | File | Use Cases | Summary |
|--------|------|-----------|---------|
| **Favorites Management** | [use-cases/favorites-management.md](./use-cases/favorites-management.md) | UC 6.1–6.5 | Polymorphic favorites (local + external), idempotent operations, hydration |
| **Frontend UI** | [use-cases/frontend-ui.md](./use-cases/frontend-ui.md) | UC 7.1–7.8 | Angular Signals reactivity, RxJS debouncing, error interceptors, measurement localization, route guards |
| **Authentication** | [use-cases/authentication.md](./use-cases/authentication.md) | UC 9.1–9.11 | JWT auth, password hashing, refresh-token rotation, brute-force protection, GDPR deletion, user preferences |

---

## Non-Functional Requirements

| Domain | File | Use Cases | Summary |
|--------|------|-----------|---------|
| **Data Integrity** | [use-cases/data-integrity.md](./use-cases/data-integrity.md) | UC 10.1–10.3 | Decimal.js precision, unit conversion edge cases, synonym resolution |
| **Performance & Scalability** | [use-cases/performance-scalability.md](./use-cases/performance-scalability.md) | UC 11.1–11.4 | Query optimization, Redis caching strategies, fallback handling, graceful degradation |
| **Security & Compliance** | [use-cases/security-compliance.md](./use-cases/security-compliance.md) | UC 13.1–13.4 | XSS prevention, SQL injection defense, rate limiting, CSRF protection |
| **Analytics & Monitoring** | [use-cases/analytics-monitoring.md](./use-cases/analytics-monitoring.md) | UC 14.1–14.3 | Usage tracking, error monitoring, performance metrics |

---

## Operations

| Domain | File | Use Cases | Summary |
|--------|------|-----------|---------|
| **Development & Operations** | [use-cases/development-operations.md](./use-cases/development-operations.md) | UC 15.1–15.4 | Database migrations, environment configuration, health checks, reconnection strategy |
| **System & Environment** | [use-cases/system-environment.md](./use-cases/system-environment.md) | UC 8.1 | Local development setup, Docker-first workflow |

---

## BDD Format

Every use case follows the **Given / When / Then** structure:

```gherkin
Feature: Inventory Management
  Scenario: User adds ingredient to inventory
    Given the user has no vodka in their inventory
    When they add "500 ml" of vodka
    Then their inventory should show "500 ml" of vodka
    And they should be able to make cocktails requiring vodka
```

These scenarios:
- **Drive TDD tests** — each `Given / When / Then` maps to a Jest/Vitest test case
- **Cover edge cases** — failure modes, race conditions, and error handling
- **Span all layers** — from database transactions to frontend reactivity
- **Define acceptance criteria** — the definition of "done" for each feature

---

## Cross-References

- **Testing Examples** — corresponding test implementations in [`/docs/development/testing/`](../development/testing/)
- **Architecture Decisions** — ADRs explaining trade-offs in [`/docs/architecture/adrs/`](../architecture/adrs/)
- **API Specification** — REST endpoint documentation in [`/docs/api/`](../api/)
- **Database Schema** — entity-relationship diagrams in [`/docs/database/database-schema.md`](../database/database-schema.md)

---

*Total: 50+ scenarios covering every aspect of the MixologyHub application.*
