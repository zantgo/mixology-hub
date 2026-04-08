# Coding Standards & Best Practices

  

To ensure long-term maintainability, scalability, and code quality, the MixologyHub codebase adheres to strict engineering standards. These guidelines are enforced through ESLint, Prettier, and consistent architectural patterns.

  

---

  

## 1. Clean Code Principles

- **DRY (Don't Repeat Yourself):** Logic is centralized in `Services`. Controllers are kept "thin"—their only responsibility is handling HTTP routing and delegating logic to the appropriate service.

- **KISS (Keep It Simple, Stupid):** Avoid over-engineering. If a standard TypeORM query works, do not reach for complex custom SQL unless performance profiling dictates it.

- **Single Responsibility Principle (SRP):** Every class (Controller, Service, Entity) has exactly one reason to change.

  

---

  

## 2. TypeScript & NestJS Standards

- **Strict Typing:** Always define explicit types for function parameters and return types. Avoid `any` whenever possible; use `unknown` if the type is truly dynamic, then narrow it down with type guards.

- **DTO Validation:** All incoming request bodies must be validated using `class-validator`. We explicitly forbid non-whitelisted fields to prevent malicious data from entering the database.

- **Dependency Injection:** Every dependency must be injected via the constructor. This facilitates easier unit testing by allowing the injection of mock classes.

- **Asynchronous Flow:** Avoid mixing callbacks with `async/await`. Use `async/await` for readability and error handling via `try/catch`.

  

---

  

## 3. Angular (Frontend) Standards

- **Signals First:** Synchronous UI state must be managed via **Angular Signals** (`signal`, `computed`). Avoid using `BehaviorSubjects` for simple variable state.

- **Immutability:** State updates should be performed using immutable patterns (e.g., `.map()`, `.filter()`, or the spread operator `[...]`) to ensure the Angular change detection mechanism functions optimally.

- **Standalone Everything:** Never use `NgModules`. All components, pipes, and directives must be `standalone: true`.

- **Naming Conventions:**

- Components: `name.component.ts`

- Services: `name.service.ts`

- Models/DTOs: `name.model.ts` or `name.dto.ts`

- Interceptors: `name.interceptor.ts`

  

---

  

## 4. Git & Commit Guidelines

We follow the **Conventional Commits** specification to ensure a clean, searchable, and machine-readable commit history.

  

**Format:** `<type>(<scope>): <description>`

  

- `feat`: A new feature.

- `fix`: A bug fix.

- `docs`: Documentation only changes.

- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc).

- `refactor`: A code change that neither fixes a bug nor adds a feature.

- `test`: Adding or correcting tests.

- `chore`: Changes to build processes or auxiliary tools.

  

*Example:* `feat(ai): integrate DeepSeek LLM via environment variables`

  

---

  

## 5. Testing Strategy

- **Backend (Jest):**

- **Unit Tests:** Must test the business logic inside `Services` in isolation by mocking Repositories.

- **E2E Tests:** Must hit the actual HTTP endpoints (using `supertest`) to ensure the full request-response lifecycle works correctly.

- **Frontend (Vitest):**

- Focus on component interactions and signal updates.

- Test the `UnitConverterService` to ensure inventory math is 100% accurate.

  

---

  

## 6. Security Standards

- **Environment Variables:** Credentials (API Keys, Database Passwords) must **never** be hardcoded. Use the `.env` file and `ConfigModule` for access.

- **Cors Policy:** By default, the API is configured with restricted origin access (in production) to prevent unauthorized domain requests.

- **Sanitization:** All input strings (especially for the AI prompt) are sanitized to prevent injection attacks.