# Backend Architecture & Design Patterns

> **B2B SINGLE-BAR ARCHITECTURE:** MixologyHub is now a Point-of-Sale/Inventory system for a SINGLE physical bar. All bartenders share one global `bar_inventory`. Concurrency is actively managed via Redis-backed BullMQ with serialized queue processing (see ADR 0017).

  

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

├── utils/ # Pure business logic (e.g., UnitConverterService, MeasureParserService)

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

**Architectural Decision: Exclusion of Asset Ingestion on Rating Actions**
**Explicit Trade-off:** Actions like "Save" or "Prepare" trigger the heavy Sharp library to download and localize external images. To maintain high performance for rapid user voting, the Rate action will NOT trigger local asset ingestion. We explicitly accept that rating an external cocktail will generate an EXTERNAL_COCKTAIL_RATINGS row but will leave the cocktail's images as null in the system. We trade visual asset completeness for high-throughput, low-latency user engagement.

  

### 2. The Adapter Pattern (Provider-Agnostic AI)

To prevent vendor lock-in with AI providers (OpenAI, DeepSeek, Anthropic), the application relies on an interface (`IAiProvider`).

  

The concrete implementation injects environment variables (`AI_API_URL`, `AI_API_KEY`) to make standard REST calls.

- **The Prompt Engineering:** The backend constructs a strict system prompt demanding *only* a JSON output.

- **The Fallback:** The service implements a retry mechanism (up to 3 times) to handle cases where the LLM occasionally outputs markdown backticks instead of raw JSON, ensuring application stability.

  

### 3. Smart Inventory & Unit Conversion

To determine if a cocktail is makeable against the bar's shared inventory, the system cannot rely on simple string matching (e.g., "1 oz" vs "30 ml").

- We use a dedicated `UnitConverterService` containing mathematical conversion factors relative to a base unit (ml, grams).
- **Makeable Algorithm:** When querying `GET /bar-inventory/makeable`, the database uses a complex SQL `HAVING` clause to filter cocktails where *all* required ingredients exist in the shared `bar_inventory`. Then, in memory, the `UnitConverterService` mathematically verifies that the *quantities* are sufficient.
- All bartenders see the same "Makeable" list calculated against the single `bar_inventory`.

#### 📐 Human-Readable Measure Parsing

The `cocktail_ingredients` table stores both a human-readable `measure` string (e.g., "1 1/2 oz", "a splash") and separate `amount` (decimal) and `unit` (string) fields for mathematical operations.

**Parsing Strategy:**
1. **Fraction & Decimal Detection:** Regex patterns convert "1 1/2" → 1.5, "0.5" → 0.5
2. **Unit Extraction:** Separate numeric amount from unit string ("2 oz" → amount: 2, unit: "oz")
3. **Special Cases:** Handle "a pinch", "dash", "splash" as qualitative measures with null/0 amount
4. **Validation:** Ensure parsed values are valid for `UnitConverterService`

**Implementation Example:**
```typescript
export class MeasureParserService {
  parseMeasure(measure: string): { amount: number | null; unit: string } {
    // Handle special qualitative measures
    const qualitativeMeasures = ['pinch', 'dash', 'splash', 'to taste'];
    for (const qual of qualitativeMeasures) {
      if (measure.toLowerCase().includes(qual)) {
        return { amount: null, unit: qual };
      }
    }
    
    // Extract numeric part (supports fractions: "1 1/2", "3/4", "2.5")
    const match = measure.match(/(\d+(?:\s+\d+\/\d+|\/\d+)?(?:\.\d+)?)/);
    if (!match) {
      throw new Error(`Invalid measure format: ${measure}`);
    }
    
    const numericStr = match[1];
    const amount = this.parseFraction(numericStr);
    
    // Extract unit (everything after the number)
    const unit = measure.replace(numericStr, '').trim() || 'unit';
    
    return { amount, unit };
  }
  
  private parseFraction(str: string): number {
    // Handle mixed numbers: "1 1/2"
    const mixedMatch = str.match(/(\d+)\s+(\d+)\/(\d+)/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1]);
      const numerator = parseInt(mixedMatch[2]);
      const denominator = parseInt(mixedMatch[3]);
      return whole + (numerator / denominator);
    }
    
    // Handle simple fractions: "3/4"
    const fractionMatch = str.match(/(\d+)\/(\d+)/);
    if (fractionMatch) {
      const numerator = parseInt(fractionMatch[1]);
      const denominator = parseInt(fractionMatch[2]);
      return numerator / denominator;
    }
    
    // Handle decimals: "2.5"
    return parseFloat(str);
  }
}

**Critical Edge Case: Recurring Decimals & Database Precision**
- Fractions like "1/3 oz" produce recurring decimals (0.333333...)
- Database uses `decimal(10,4)` - 4 decimal places stored for fractional measurements
- **Solution**: Round to 4 decimal places before database insertion
- **TDD Test Required**: Ensure "1/3 oz" → 0.3333 (rounded), not 0.333333...
- **Business Impact**: Precision loss acceptable for cocktail measurements (±0.0001 oz ≈ 0.003 ml with 4 decimal places)
```

**Why This Matters:**
- UI captures human-friendly input ("1 1/2 oz")
- Backend needs precise decimals (1.5) for mathematical operations
- `UnitConverterService` requires `amount` and `unit` separately
- Database stores both formats for display (`measure`) and calculation (`amount`, `unit`)

#### 🚀 Performance Optimization (Future Consideration)

For production-scale deployments with large ingredient catalogs, the current two-step approach (SQL filter + in-memory math) could become a bottleneck, potentially exceeding the 100ms response time requirement (UC 11.1) for users with highly restricted inventories. Two database-centric optimizations are available:

1. **PostgreSQL Materialized Views:** Pre-compute unit-converted inventory quantities in a materialized view that refreshes on inventory changes. This moves the math to the database layer.

2. **Custom PostgreSQL Functions:** Implement unit conversion logic as PostgreSQL stored functions, allowing the database to handle both filtering AND quantity validation in a single query.

**Example PostgreSQL function concept:**
```sql
CREATE OR REPLACE FUNCTION can_make_cocktail(
  cocktail_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  ingredient RECORD;
  bar_quantity DECIMAL;
  required_quantity DECIMAL;
BEGIN
  FOR ingredient IN 
    SELECT ci.amount, ci.unit, i.base_unit
    FROM cocktail_ingredients ci
    JOIN ingredients i ON ci.ingredient_id = i.id
    WHERE ci.cocktail_id = $1
  LOOP
    -- Convert required amount to base unit
    required_quantity := convert_to_base_unit(ingredient.amount, ingredient.unit, ingredient.base_unit);
    
    -- Get bar's inventory in base units
    SELECT bi.quantity INTO bar_quantity
    FROM bar_inventory bi
    WHERE bi.ingredient_id = ingredient.ingredient_id;
    
    IF bar_quantity IS NULL OR bar_quantity < required_quantity THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

  

---

  

---

## 🔄 Order Processing & Queue-Based Concurrency

When multiple bartenders press "Prepare Drink" simultaneously, concurrent PostgreSQL transactions on the shared `bar_inventory` table would cause race conditions, double-deductions, and deadlocks. We eliminate this problem entirely by serializing all inventory mutations through a single-threaded Redis-backed BullMQ worker.

### Architecture Flow

1. **HTTP Endpoint `POST /cocktails/:id/prepare`:**
   - Validates auth/role and cocktail existence.
   - Creates a `PREPARATION_LOGS` record with `status = 'queued'`.
   - Pushes a job to the Redis `bar-orders` BullMQ queue.
   - Returns `202 Accepted` with `{ jobId, statusUrl }` immediately — NO database deduction occurs in the HTTP request lifecycle.

2. **BullMQ Worker (`concurrency: 1`):**
   - A single worker process pops jobs from `bar-orders` sequentially.
   - Opens a PostgreSQL ACID transaction.
   - Validates `bar_inventory` sufficiency (including unit conversion and synonym resolution).
   - If sufficient: deducts ingredients, updates `PREPARATION_LOGS` to `status = 'completed'`.
   - If insufficient: rolls back, updates `PREPARATION_LOGS` to `status = 'failed_insufficient_stock'`.
   - On infrastructure error: logs `status = 'failed_other'` for debugging.

3. **Status Polling / WebSockets:**
   - Frontend polls `GET /preparations/:logId/status` or subscribes via WebSocket/SSE.
   - When status transitions from `queued` to `completed` or `failed_*`, the UI updates accordingly.
   - This replaces the old "Optimistic UI Update" pattern which is fundamentally incompatible with async queue processing.

### NestJS Integration

```typescript
// Queue definition
@Injectable()
export class BarOrdersQueue {
  constructor(@InjectQueue('bar-orders') private readonly queue: Queue) {}

  async enqueue(cocktailId: string, bartenderId: string, servings: number, options?: PrepareOptions) {
    const job = await this.queue.add('prepare-cocktail', {
      cocktailId,
      bartenderId,
      servings,
      ...options,
    }, {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 1, // No automatic retries — stock is deterministic
    });
    return { jobId: job.id };
  }
}

// Worker (concurrency: 1 = sequential execution)
@Processor('bar-orders')
export class BarOrdersWorker extends WorkerHost {
  constructor(private readonly preparationService: PreparationService) {
    super();
  }

  @Process('prepare-cocktail')
  async handlePrepare(job: Job<PrepareJobPayload>) {
    return await this.preparationService.execute(job.data);
  }
}
```

### Why Not HTTP-Controller Transactions?

Holding a PostgreSQL transaction open inside an HTTP request lifecycle is dangerous under concurrency:
- **Row-level locks** on popular ingredients (e.g., "Vodka") cascade into connection pool exhaustion as other bartenders queue up waiting for the lock.
- **HTTP timeouts**: if a transaction takes 5+ seconds due to lock contention, the reverse proxy returns 504 while the DB transaction is still running.
- **Client retries**: a timed-out client that retries creates a SECOND concurrent transaction, compounding the lock issue.

By moving inventory mutations OUT of HTTP controllers and into a serialized worker, we solve all three problems simultaneously.

---

## 🗄️ Data Integrity & Transactions

Inventory mutations occur inside a single-threaded BullMQ Worker context, not in the HTTP controller. Each job execution wraps all operations in a single **TypeORM Database Transaction** to ensure ACID compliance.

**Example: The Worker `execute()` Method**

```typescript
return await this.dataSource.transaction(async (transactionalEntityManager) => {
  // 1. Load current bar_inventory rows for required ingredients
  // 2. Verify quantities are sufficient (via UnitConverterService + synonym resolution)
  // 3. Subtract required amounts from bar stock
  // 4. Save updated inventory rows
  // 5. Update PREPARATION_LOGS status to 'completed'
  //
  // If ANY step fails, the entire transaction rolls back,
  // preventing negative inventory or partial deductions.
});
```

Because the worker processes jobs with `concurrency: 1`, we are mathematically guaranteed that no two transactions ever touch the same `bar_inventory` row simultaneously. This eliminates the need for `SELECT FOR UPDATE`, advisory locks, or retry loops.



  

---

  

## ⚡ Caching Strategy (Redis)

  

External API calls are expensive and subject to rate-limiting. We utilize **Redis** via NestJS's `CacheManager`.

  

**Flow for External Data (`TheCocktailDbService`):**

1. Check Redis for key: `cocktail_search_{query}`.

2. **Cache Hit:** Return data immediately (0 network latency).

3. **Cache Miss:**

- Execute HTTP GET to external API.

- Store response in Redis with a TTL (Time-To-Live) of 5 minutes (300 seconds) to support the unified cache-slicing pagination strategy.

- Return response.

  

---

  

## 🛡️ Validation & Security

  

- **Global Pipes:** All incoming requests pass through a global `ValidationPipe`.

- **DTOs:** Data Transfer Objects leverage `class-validator` to strictly type-check incoming JSON bodies. Requests with extra, unmapped fields are automatically stripped (`whitelist: true`) or rejected (`forbidNonWhitelisted: true`) to prevent mass-assignment vulnerabilities.

### 🚦 Rate Limiting (Production Consideration)

In a production environment, public endpoints—especially the AI generation endpoint (`POST /ai`)—will be protected by a `ThrottlerModule` (NestJS rate limiter). This prevents abuse, controls costs associated with third-party LLM APIs, and ensures fair usage across users. The roadmap (Phase 1) includes configuring per-user and global request limits.

### 👑 Role-Based Access Control (RBAC)

The system implements a comprehensive RBAC system with the following components:

#### 1. Database Schema
- **`users.role` column:** Stores user role (`'bartender'` or `'admin'`) with default value `'bartender'`
- **Admin-only operations:** Inventory management, ingredient taxonomy, and system configuration require admin privileges

#### 2. Authorization Guards
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user; // JWT payload
    
    return requiredRoles.includes(user.role);
  }
}
```

#### 3. Role Decorators
```typescript
// Controller usage
@Controller('admin/inventory')
@UseGuards(RolesGuard)
export class AdminInventoryController {
  @Post('add')
  @Roles('admin') // Only admins can add stock
  async addStock(@Body() dto: AddStockDto) {
    // Admin-only logic
  }
}
```

#### 4. Admin Privileges (Bar Manager)
- **Inventory Management:** Add, update, and delete stock in `bar_inventory` (POST/PUT/DELETE)
- **Ingredient Taxonomy:** Create, rename, merge, and hard-delete ingredients in the global catalog
- **Ingredient Relationships:** Manage synonyms (`synonym`) and hierarchy (`is_a`) relationships
- **Audit Logging:** All admin mutations are logged with timestamp and user ID

#### 5. Bartender Access
- Bartenders can browse recipes, search cocktails, and view the global `bar_inventory`
- Bartenders can submit "Prepare" orders via `POST /cocktails/:id/prepare` (which enqueues a BullMQ job)
- Bartenders can view their own preparation history and undo recent preparations (within the 15-minute window)
- Bartenders can manage their own favorites and profile settings

---

## 🤖 MCP Agentic Architecture

MixologyHub exposes itself as an **MCP (Model Context Protocol) Server** to LLM clients. Instead of stuffing entire inventories into prompts (the old "Context Stuffing" pattern), the LLM selectively invokes backend tools through structured MCP tool calls. This reduces token usage by >90% and eliminates the need for prompt truncation.

### Architecture Overview

```
┌─────────┐  SSE/stdio   ┌──────────────┐   Tool Calls   ┌──────────────┐
│  LLM    │─────MCP─────▶│  MCP Server   │──────────────▶│  Backend     │
│ (Client)│◀────MCP──────│  (NestJS)     │◀──────────────│  Services    │
└─────────┘              └──────────────┘               └──────────────┘
                              │
                              ▼
                         ┌──────────┐
                         │ Redis    │
                         │ BullMQ   │──▶ BarOrders Worker
                         └──────────┘     (concurrency: 1)
```

### Available MCP Tools

| Tool Name | Type | Description | Audit |
|-----------|------|-------------|-------|
| `get_bar_inventory` | Read | Returns current bar stock levels | Sampled (10%) |
| `search_cocktails` | Read | Unified search (local + external) | Sampled (10%) |
| `get_cocktail_detail` | Read | Full recipe with ingredients + instructions | Sampled (10%) |
| `convert_units` | Read | Convert between measurement units | No |
| `prepare_cocktail` | Write | Enqueue a preparation order to BullMQ | Always |
| `check_makeability` | Read | Check if a cocktail is makeable against bar stock | Sampled (10%) |

### Transport Layer

**1. SSE (Server-Sent Events) — Web LLMs:**
- Endpoint: `GET /api/mcp/sse`
- The LLM client connects via SSE and receives tool invocation events.
- Tool results are returned via the SSE stream.
- Used by web-based LLM providers (OpenAI, Anthropic, DeepSeek APIs).

**2. stdio — Local LLMs:**
- A standalone entrypoint (`mcp-server.ts`) communicates via stdin/stdout.
- Supports Claude Desktop, Continue.dev, and other local MCP clients.
- Uses the same tool definitions and service layer as the SSE transport.

### Authentication

LLM clients authenticate using a **one-time ticket** system:

1. The frontend (or authenticated proxy) calls `POST /api/mcp/ticket` to generate a short-lived ticket.
2. The ticket is valid for **30 seconds** and is single-use.
3. The LLM client passes the ticket in the MCP handshake to establish a session.
4. All subsequent tool calls in that session are attributed to the authenticated user for audit purposes.

This prevents unauthenticated LLM tool access while avoiding the complexity of long-lived API keys.

### AI Tool Audit (`AI_TOOL_AUDIT`)

All tool invocations are logged for debugging, cost tracking, and abuse detection:
- **Write operations** (`prepare_cocktail`): Logged unconditionally.
- **Read operations** (`get_bar_inventory`, `search_cocktails`, etc.): Logged at a configurable sample rate (default 10%, via `AI_AUDIT_READ_SAMPLE_RATE` env var).
- Each log entry records: tool name, arguments, result status (`success`, `error`), is_write flag, token usage estimate, and the triggering user ID.

### Why Not Prompt Stuffing?

The old approach injected the entire bar inventory (potentially hundreds of ingredients) into every LLM prompt. This caused:
- **Token Bloat**: 100 ingredients × ~20 tokens each = 2,000+ tokens wasted per request
- **Context Window Exhaustion**: Large inventories exceeded model context limits
- **Hallucination Risk**: The LLM couldn't reliably track which ingredients it had already used across a multi-turn conversation
- **Cost**: Every prompt iteration carried the full inventory payload

MCP tool calling solves all four problems simultaneously. The LLM queries only what it needs, when it needs it.
