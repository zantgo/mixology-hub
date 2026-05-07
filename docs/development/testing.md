# Testing Documentation

> **Test-Driven Development (TDD)** — Red-Green-Refactor cycle backed by concrete examples for every domain in MixologyHub.

MixologyHub follows a strict TDD approach. The BDD scenarios in [`/docs/product/use-cases/`](../product/use-cases/) serve as the specification source; the files in this directory provide concrete test implementations, mocking strategies, and coverage targets for each domain.

---

## Testing Strategy Overview

Refer to the complete strategy document for the testing pyramid, coverage expectations, and CI/CD integration:

- **[Testing Strategy & Guidelines](./testing-strategy.md)** — Pyramid structure (70% unit / 20% integration / 10% E2E), Red-Green-Refactor cycle, mocking strategies, coverage targets, CI pipeline

---

## Core Domain Tests

| Domain | File | Covers Use Cases | Focus Areas |
|--------|------|------------------|-------------|
| **Inventory Management** | [testing/inventory-management-tests.md](./testing/inventory-management-tests.md) | UC 1.1–1.10 | Measure parsing, zero inventory, base-unit normalization, name normalization |
| **Cocktail Discovery** | [testing/cocktail-discovery-tests.md](./testing/cocktail-discovery-tests.md) | UC 2.1–2.9 | Unified pagination, Redis caching, dangling favorites, external API normalization |
| **Makeable Intelligence** | [testing/makeable-intelligence-tests.md](./testing/makeable-intelligence-tests.md) | UC 3.1–3.7 | Incompatible units, optional ingredients, almost-makeable detection, serving scaling |
| **Cocktail Preparation** | [testing/cocktail-preparation-tests.md](./testing/cocktail-preparation-tests.md) | UC 4.1–4.5 | Transactional race conditions, undo logic, batch preparation, inventory depletion |
| **AI Bartender** | [testing/ai-bartender-tests.md](./testing/ai-bartender-tests.md) | UC 5.1–5.8 | Prompt injection defense, retry exhaustion, rate limiting, timeout handling, JSON parsing |
| **Favorites Management** | [testing/favorites-management-tests.md](./testing/favorites-management-tests.md) | UC 6.1–6.5 | Idempotent operations, removal, dangling external favorites, polymorphic hydration |

---

## Platform & Experience Tests

| Domain | File | Covers Use Cases | Focus Areas |
|--------|------|------------------|-------------|
| **Frontend UI** | [testing/frontend-ui-tests.md](./testing/frontend-ui-tests.md) | UC 7.1–7.8 | RxJS debouncing, Angular Signals reactivity, error interceptors, measurement localization, route guards |
| **Authentication** | [testing/authentication-tests.md](./testing/authentication-tests.md) | UC 9.1–9.11 | Multi-tenant isolation, password hashing, login validation, brute-force protection, user preferences |

---

## Data Integrity & Performance Tests

| Domain | File | Covers Use Cases | Focus Areas |
|--------|------|------------------|-------------|
| **Data Integrity** | [testing/data-integrity-tests.md](./testing/data-integrity-tests.md) | UC 10.1–10.3 | Synonym resolution, decimal precision, edge-case handling |
| **Density Conversion** | [testing/density-conversion-tests.md](./testing/density-conversion-tests.md) | UC 10.x | Mass-to-volume conversions, density-aware unit transformations |
| **Performance** | [testing/performance-tests.md](./testing/performance-tests.md) | UC 11.1–11.4 | Query optimization, cache invalidation, Redis degradation, pagination DoS protection |

---

## Security & Operations Tests

| Domain | File | Covers Use Cases | Focus Areas |
|--------|------|------------------|-------------|
| **Security** | [testing/security-tests.md](./testing/security-tests.md) | UC 13.1–13.4 | XSS prevention, input sanitization, CSRF protection, SSRF prevention |
| **System & Operations** | [testing/system-tests.md](./testing/system-tests.md) | UC 15.1–15.4 | Database migrations, health checks, environment configuration, reconnection strategy |
| **Architectural Fixes** | [testing/architectural-fixes-tests.md](./testing/architectural-fixes-tests.md) | UC 2.6, UC 2.30 | Schema validation, pagination enforcement, rating logic, token hardening |

---

## Cross-Cutting Test Documentation

| Document | Purpose |
|----------|---------|
| [E2E Tests](./testing/e2e-tests.md) | Full-system Playwright/Supertest tests covering critical user journeys |
| [TDD Examples](./testing/tdd-examples.md) | Concrete Red-Green-Refactor examples and patterns for new developers |
| [Analytics & Monitoring Tests](./testing/analytics-monitoring-tests.md) | Usage tracking, error monitoring, performance metrics testing |

---

## Test Naming Convention

All tests follow a consistent pattern derived from BDD scenarios:

```typescript
// Pattern: it('should [expected behavior] when [condition]', () => { ... })

it('should convert 2 oz to approximately 59.15 ml', () => {
  const result = converter.convert(2, 'oz', 'ml');
  expect(result).toBeCloseTo(59.15, 2);
});

it('should reject a negative quantity when adding to inventory', () => {
  const dto = { ingredientId: '123', quantity: -5, unit: 'ml' };
  expect(() => service.addToInventory('user-1', dto)).toThrow(BadRequestException);
});
```

## Mocking Patterns

```typescript
// Repository mock
const mockRepo = {
  findOne: jest.fn().mockResolvedValue({ id: 'vodka-123', name: 'Vodka' }),
  findAndCount: jest.fn().mockResolvedValue([mockData, 42]),
};

// HTTP client mock
const mockHttp = {
  get: jest.fn().mockResolvedValue({ data: { drinks: [] } }),
};

// Cache mock
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
};
```

## Running Tests

```bash
# All suites
make test

# Backend only (Jest)
make test-backend
cd src/backend && npm run test

cd src/backend && npm run test:e2e

cd src/backend && npm run test:cov

# Frontend only (Vitest)
make test-frontend
cd src/frontend && npm run test
```

---

## Cross-References

- **Use Cases (BDD Source)** — [`/docs/product/use-cases/`](../product/use-cases/)
- **Testing Strategy** — [`testing-strategy.md`](./testing-strategy.md)
- **Coding Standards** — [`coding-standards.md`](./coding-standards.md)
- **TypeORM Decimal Transformers** — [`typeorm-decimal-transformers.md`](./typeorm-decimal-transformers.md)

---

*All test files are organized by domain and directly correspond to the BDD use cases. Use these as a reference for writing new tests and maintaining coverage.*
