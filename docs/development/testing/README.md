# Testing Documentation

This directory contains Test-Driven Development (TDD) examples organized by domain for the MixologyHub application.

## 📋 Organization

Test examples are split into domain-specific files corresponding to the use cases:

| File | Domain | Corresponding Use Cases | Description |
|------|--------|------------------------|-------------|
| [inventory-management-tests.md](./inventory-management-tests.md) | Inventory Management | UC 1.1-1.10 | Measure parsing, zero inventory, base unit normalization, name normalization |
| [cocktail-discovery-tests.md](./cocktail-discovery-tests.md) | Cocktail Discovery | UC 2.1-2.9 | Unified pagination, Redis caching, dangling favorites |
| [makeable-intelligence-tests.md](./makeable-intelligence-tests.md) | Makeable Intelligence | UC 3.1-3.7 | Incompatible units, optional ingredients, almost makeable, serving scaling |
| [cocktail-preparation-tests.md](./cocktail-preparation-tests.md) | Cocktail Preparation | UC 4.1-4.5 | Race conditions, undo logic, batch preparation |
| [ai-bartender-tests.md](./ai-bartender-tests.md) | AI Bartender | UC 5.1-5.8 | Prompt injection, retry exhaustion, rate limiting, timeout handling |
| [favorites-management-tests.md](./favorites-management-tests.md) | Favorites Management | UC 6.1-6.5 | Idempotent operations, removal, dangling favorites |
| [frontend-ui-tests.md](./frontend-ui-tests.md) | Frontend UI | UC 7.1-7.8 | RxJS debouncing, Angular signals, error interceptors, measurement conversion, route guards |
| [authentication-tests.md](./authentication-tests.md) | Authentication | UC 9.1-9.11 | Multi-tenant isolation, password hashing, login validation, user preferences |
| [data-integrity-tests.md](./data-integrity-tests.md) | Data Integrity | UC 10.1-10.3 | Synonym resolution, edge case handling |
| [performance-tests.md](./performance-tests.md) | Performance | UC 11.1-11.4 | Query optimization, cache invalidation, Redis degradation |
| [security-tests.md](./security-tests.md) | Security | UC 13.1-13.4 | XSS prevention, input sanitization, CSRF protection |
| [system-tests.md](./system-tests.md) | System & Operations | UC 15.1-15.4 | Database migrations, health checks, reconnection strategy |
| [architectural-fixes-tests.md](./architectural-fixes-tests.md) | Architectural Fixes | UC 2.6, UC 2.30, UC 3.12 | Database schema, pagination, rating, token salt |
| [tdd-examples.md](./tdd-examples.md) | TDD Patterns | General | Basic TDD workflow examples |
| [e2e-tests.md](./e2e-tests.md) | E2E Tests | Cross-domain | Playwright tests for critical user journeys |

## 🎯 Purpose

These test examples demonstrate:

1. **TDD Workflow**: Red-Green-Refactor cycle with concrete examples
2. **Test Structure**: How to organize tests by domain and functionality
3. **Mocking Strategies**: How to mock dependencies (repositories, HTTP clients, etc.)
4. **Edge Case Coverage**: Handling of failure modes, race conditions, and error scenarios
5. **Best Practices**: Naming conventions, assertion patterns, and test organization

## 🔗 Related Documentation

- **Use Cases**: Corresponding BDD scenarios are in [`../../product/use-cases/`](../../product/use-cases/)
- **Testing Strategy**: Overall approach in [`../testing-strategy.md`](../testing-strategy.md)
- **Coding Standards**: Development guidelines in [`../coding-standards.md`](../coding-standards.md)

## 🧪 Using These Examples

### For Development
1. **Start with a use case** from the corresponding domain file
2. **Write a failing test** following the TDD pattern shown
3. **Implement minimal code** to make the test pass
4. **Refactor** while keeping tests green

### For Test Implementation
```typescript
// Follow the pattern: it('should [expected behavior] when [condition]', () => { ... })
it('should convert 2 oz to approximately 59.15 ml', () => {
  const result = converter.convert(2, 'oz', 'ml');
  expect(result).toBeCloseTo(59.15, 2);
});
```

### For Mocking Dependencies
```typescript
// Mock repositories
const mockRepo = {
  findOne: jest.fn().mockResolvedValue({ id: 'vodka-123', name: 'Vodka' })
};

// Mock HTTP clients
const mockHttp = {
  get: jest.fn().mockResolvedValue({ data: { drinks: [] } })
};

// Mock external services
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true)
};
```

## 📊 Coverage Expectations

Each domain has specific coverage targets (see [`../testing-strategy.md`](../testing-strategy.md)):

- **Core business logic** (UnitConverterService, MeasureParserService): 100%
- **Service layers** (Inventory, Cocktail, AI services): >80%
- **Frontend components**: >60% for critical user flows
- **Security-critical code**: 100% for authentication and input validation

## 🚀 Getting Started

1. Review the **testing strategy** for overall approach
2. Find the relevant **domain test file** for your feature
3. Follow the **TDD examples** for implementation patterns
4. Check **coverage expectations** for your domain
5. Run tests frequently using the project's test commands