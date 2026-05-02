# ADR 0017: B2B Shared Inventory with BullMQ Serialized Concurrency

## Status
Accepted

## Context
MixologyHub is pivoting from a B2C architecture (where every user had their own isolated inventory) to a B2B Point-of-Sale/Inventory system for a **single physical bar**. In the new architecture:

1. **Single Bar Entity:** The system serves ONE bar location.
2. **Shared Global Inventory:** All bartenders pull from and view the exact same `bar_inventory` table. There is no per-user inventory isolation.
3. **Role-Based Workflows:**
   - `admin` (Bar Manager): The ONLY role permitted to add, update, or delete stock in the inventory, and to manage the ingredient taxonomy.
   - `bartender`: Can browse recipes, check makeability, and submit "Prepare" orders. Cannot manually add/update stock.
4. **Concurrent Bartenders:** Multiple bartenders may press "Prepare Drink" at the exact same millisecond, creating severe race conditions and potential deadlocks on the shared `bar_inventory` rows.

The prior architecture explicitly accepted race conditions via a "No Concurrency Mandate" (documented in ADR 0001, ADR 0005, and `concurrency-removal-summary.md`). That mandate is no longer viable: in a shared-inventory environment, two simultaneous `SELECT` + `UPDATE` operations on the same ingredient row will inevitably cause double-deductions, negative inventory, or PostgreSQL deadlock errors under `READ COMMITTED`.

## Decision
We will implement **Redis-backed BullMQ** with a strict `concurrency: 1` setting for the `bar-orders` queue to serialize all cocktail preparation operations into a single-threaded processing pipeline.

### Architecture
1. **HTTP Endpoint (`POST /cocktails/:id/prepare`):** No longer executes database deductions synchronously. Instead, it:
   - Validates the request (auth, role, cocktail ID).
   - Pushes a job to the Redis `bar-orders` BullMQ queue.
   - Returns `202 Accepted` immediately with a `jobId` for status tracking.

2. **BullMQ Worker (`concurrency: 1`):** A single Node.js worker process pops jobs from the `bar-orders` queue and executes them **sequentially**:
   - Opens a PostgreSQL ACID transaction.
   - Validates inventory sufficiency against `bar_inventory`.
   - If sufficient: deducts ingredients, creates a `PREPARATION_LOGS` entry with `status = 'completed'`.
   - If insufficient: rolls back the transaction, creates a `PREPARATION_LOGS` entry with `status = 'failed_insufficient_stock'`.
   - On unexpected infrastructure failure: logs with `status = 'failed_other'`.

3. **Status Communication:** The frontend polls `GET /preparations/:jobId/status` or subscribes via WebSockets/SSE to receive the final outcome of the queued order.

### Queue Configuration
```typescript
import { Queue } from 'bullmq';

// Queue registration in NestJS
@Injectable()
export class BarOrdersQueue {
  constructor(
    @InjectQueue('bar-orders') private readonly barOrdersQueue: Queue,
  ) {}

  async enqueuePreparation(job: PrepareJobPayload): Promise<{ jobId: string }> {
    const bullJob = await this.barOrdersQueue.add('prepare-cocktail', job, {
      removeOnComplete: 100,   // Keep last 100 completed for auditing
      removeOnFail: 500,       // Keep last 500 failed for debugging
      attempts: 1,             // No retries — stock validation is deterministic
    });
    return { jobId: bullJob.id };
  }
}
```

```typescript
// Worker (concurrency: 1 ensures sequential processing)
@Processor('bar-orders')
export class BarOrdersWorker {
  constructor(
    private readonly preparationService: PreparationService,
  ) {}

  @Process('prepare-cocktail')
  async handlePreparation(job: Job<PrepareJobPayload>) {
    return await this.preparationService.executePreparation(job.data);
  }
}
```

## Consequences

### Positive
- **100% Mathematical Guarantee Against Race Conditions and Deadlocks:** The `concurrency: 1` worker ensures only one inventory deduction transaction executes at any moment. No two bartenders can ever simultaneously read-and-deduct the same ingredient row.
- **Fast API Response Times:** The `/prepare` HTTP endpoint returns `202 Accepted` in milliseconds (no database transaction held open during the HTTP lifecycle). This eliminates HTTP timeout risks for complex multi-ingredient deductions.
- **Clean Error Differentiation:** `failed_insufficient_stock` vs. `failed_other` provides clear separation between business-logic failures and infrastructure failures for administrative auditing.
- **Historical Integrity:** All preparation attempts (successful or failed) are recorded in `PREPARATION_LOGS`, enabling business analytics on total cocktail demand, stockout frequency, and bartender activity.
- **Scalability for Inventory Operations:** The worker pattern naturally extensible — additional queues for batch operations, inventory imports, or taxonomy cascades can follow the same pattern.

### Negative
- **Redis Becomes a Critical Infrastructure Dependency:** Redis is no longer just a caching layer; it is now the backbone of the order processing pipeline. Redis downtime means NO cocktail preparation is possible. Monitoring, persistence (AOF/RDB), and failover strategies are mandatory.
- **UI Paradigm Shift Away from Optimistic Updates:** The frontend can no longer instantly show "Drink Prepared — Inventory Deducted" on button click. The UI must display a pending/spinner state after receiving `202 Accepted` and transition to success/failure only when the worker completes processing.
- **Async Status Communication Required:** The frontend MUST implement either polling (`GET /preparations/:jobId/status`) or a persistent WebSocket/SSE connection to receive job completion notifications. Without this, bartenders will be left waiting indefinitely after pressing "Prepare."
- **Additional Infrastructure Complexity:** BullMQ introduces new operational concerns: Redis connection management, worker process supervision, queue monitoring, and dead-letter queue handling for persistently failing jobs.
- **Latency from Enqueue to Completion:** Under high load, jobs may sit in the queue briefly (though the `concurrency: 1` worker processes them as fast as PostgreSQL can commit). The total round-trip time from button press to confirmed deduction will be slightly higher than the old synchronous path.

## Alternatives Considered

### 1. Keep Synchronous HTTP + SELECT FOR UPDATE (Rejected)
- **Pros:** No new infrastructure, simpler mental model.
- **Cons:** Holds HTTP connections open during database transactions. Under concurrent bartender load, `SELECT FOR UPDATE` causes row-level locks that cascade into PostgreSQL connection pool exhaustion and HTTP 504 timeouts. Does not gracefully handle the "10 bartenders, 1 bottle of Vodka" scenario.

### 2. PostgreSQL Advisory Locks (Rejected)
- **Pros:** No Redis dependency, pure PostgreSQL.
- **Cons:** Advisory locks are session-scoped, meaning they tie database connections to lock ownership. Connection pooling breaks this model. Error recovery is fragile (locks persist if a connection drops uncleanly). No built-in queuing/retry semantics.

### 3. Application-Level Mutex (in-process) (Rejected)
- **Pros:** No external dependency at all.
- **Cons:** Only works in a single-process deployment. Vertical scaling (multiple Node.js workers) or horizontal scaling (multiple containers) instantly breaks the mutex. This is incompatible with production reliability requirements.

### 4. Optimistic Concurrency with Version Columns (Rejected)
- **Pros:** No external queue dependency, works with connection pooling.
- **Cons:** In high-contention scenarios (multiple bartenders targeting the same popular ingredient concurrently), this devolves into an infinite retry loop, consuming database resources and delivering unpredictable latency to end users.

## Implementation Notes
- The `bar-orders` queue must be backed by a persistent Redis instance (AOF or RDB snapshotting enabled).
- Worker must be deployed as a separate Node.js process or supervised within the NestJS application lifecycle using `@nestjs/bullmq`'s built-in `WorkerHost` pattern.
- The `/prepare` endpoint must return both a `jobId` AND a polling URL or WebSocket channel for the frontend to subscribe to.
- `PREPARATION_LOGS` must include `status` (enum: `queued`, `completed`, `failed_insufficient_stock`, `failed_other`) and `bartender_id` (nullable, `ON DELETE SET NULL`).
- The old `undone` undo mechanism must be updated to work with the new async preparation flow. Undo operations may also be enqueued or remain synchronous (TBD in implementation).

## Related Decisions
- **Deprecates:** [ADR 0001: Use PostgreSQL for Inventory Management](./0001-use-postgresql-for-inventory.md) — The "No Concurrency / READ COMMITTED" trade-off within ADR 0001 is superseded by this ADR.
- **Deprecates:** [concurrency-removal-summary.md](../concurrency-removal-summary.md) — The entire "No Concurrency Mandate" documented there is obsolete.
- **Amends:** [ADR 0005: Rate Limiter Failure State Strategy](./0005-rate-limiter-failure-state-strategy.md) — Redis is now a core infrastructure dependency for BullMQ, though local-only rate limiting remains for the ThrottlerGuard specifically.

## Evolution Plan
1. **Phase 1 (Current):** Implement BullMQ with `concurrency: 1` and polling-based status updates.
2. **Phase 2:** Add WebSocket/SSE support for real-time preparation status notifications.
3. **Phase 3 (Agentic AI):** MCP-triggered preparations — the same `bar-orders` BullMQ worker processes AI-initiated orders alongside bartender-initiated ones. The worker is tool-agnostic; both human bartenders and AI agents enqueue to it identically. See ADR 0019 for the MCP tool-calling architecture.
4. **Phase 4:** Add queue monitoring dashboards and alerting for queue depth anomalies.
5. **Phase 5:** Consider `concurrency` tuning based on real-world latency requirements (e.g., `concurrency: 2` if a single worker becomes a throughput bottleneck, with appropriate PostgreSQL isolation level adjustments).
