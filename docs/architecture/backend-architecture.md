# Backend Architecture & Design Patterns

  

The MixologyHub backend is built with **NestJS**, a progressive Node.js framework that heavily enforces structure, dependency injection, and strict typing via TypeScript.

  

The application is designed as a **Modular Monolith**. It separates business domains into isolated modules while running in a single process, providing the development speed of a monolith with the structural readiness to be split into microservices if needed.

  

---

  

## 📂 Domain-Driven Structure

  

The codebase is organized by feature domains rather than technical roles (e.g., not grouping all controllers together). This ensures high cohesion and low coupling.

  

```text

src/

├── ai/ # LLM integration and recipe generation

├── cocktails/ # Recipe CRUD, Aggregation, and Preparation logic

├── favorites/ # User favorite mapping (Local + External IDs)

├── ingredients/ # Global ingredient catalog and base units

├── users/ # User profiles and Inventory management

├── external/ # 3rd-party API HTTP clients (TheCocktailDB, LLMs)

├── common/ # Shared DTOs (e.g., PaginationQueryDto)

├── utils/ # Pure business logic (e.g., UnitConverterService)

└── app.module.ts # Root module orchestrating imports

```

  

---

  

## 📐 Core Architectural Patterns

  

### 1. The Aggregator Pattern (Search Unification)

The frontend requires a seamless search experience, unaware of whether a cocktail comes from our local database or an external API.

  

We implement a `CocktailAggregatorService` that acts as an API Gateway/Aggregator:

1. Receives the search query.

2. Queries the local PostgreSQL database via TypeORM.

3. Queries `TheCocktailDbService` via Axios.

4. Uses an **Adapter/Mapper** function to transform the external, flat JSON structure (`strIngredient1`, `strMeasure1`) into our strict internal relational shape (`Cocktail`, `CocktailIngredient`).

5. Concatenates, paginates, and returns a unified response.

  

### 2. The Adapter Pattern (Provider-Agnostic AI)

To prevent vendor lock-in with AI providers (OpenAI, DeepSeek, Anthropic), the application relies on an interface (`IAiProvider`).

  

The concrete implementation injects environment variables (`AI_API_URL`, `AI_API_KEY`) to make standard REST calls.

- **The Prompt Engineering:** The backend constructs a strict system prompt demanding *only* a JSON output.

- **The Fallback:** The service implements a retry mechanism (up to 3 times) to handle cases where the LLM occasionally outputs markdown backticks instead of raw JSON, ensuring application stability.

  

### 3. Smart Inventory & Unit Conversion

To determine if a user can make a cocktail, the system cannot rely on simple string matching (e.g., "1 oz" vs "30 ml").

- We use a dedicated `UnitConverterService` containing mathematical conversion factors relative to a base unit (ml, grams).

- **Makeable Algorithm:** When querying `GET /user-inventory/makeable`, the database uses a complex SQL `HAVING` clause to filter cocktails where *all* required ingredients exist in the user's inventory. Then, in memory, the `UnitConverterService` mathematically verifies that the *quantities* are sufficient.

  

---

  

## 🗄️ Data Integrity & Transactions

  

When dealing with user inventory, data integrity is paramount. We utilize **TypeORM Database Transactions** to ensure ACID compliance.

  

**Example: The `prepare()` Method**

When a user prepares a cocktail, their inventory must be depleted.

```typescript

return await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {

// 1. Verify inventory holds sufficient quantities (Unit Converted)

// 2. Subtract required amounts from user stock

// 3. Save updated inventory rows

// If ANY step fails (e.g., concurrent request depletes stock first),

// the entire transaction rolls back, preventing negative inventory.

});

```

  

---

  

## ⚡ Caching Strategy (Redis)

  

External API calls are expensive and subject to rate-limiting. We utilize **Redis** via NestJS's `CacheManager`.

  

**Flow for External Data (`TheCocktailDbService`):**

1. Check Redis for key: `cocktail_search_{query}`.

2. **Cache Hit:** Return data immediately (0 network latency).

3. **Cache Miss:**

- Execute HTTP GET to external API.

- Store response in Redis with a TTL (Time-To-Live) of 6 hours.

- Return response.

  

---

  

## 🛡️ Validation & Security

  

- **Global Pipes:** All incoming requests pass through a global `ValidationPipe`.

- **DTOs:** Data Transfer Objects leverage `class-validator` to strictly type-check incoming JSON bodies. Requests with extra, unmapped fields are automatically stripped (`whitelist: true`) or rejected (`forbidNonWhitelisted: true`) to prevent mass-assignment vulnerabilities.
