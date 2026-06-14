# B2B Concurrency Management via BullMQ Serialization

> **STATUS: The "No Concurrency Mandate" is OBSOLETE.**  
> This document previously described the removal of all concurrency controls for MVP simplification (the "Fail-Open / No Concurrency" era).  
> As of the B2B architecture pivot, concurrency is now actively managed via Redis-backed BullMQ with single-threaded (`concurrency: 1`) queue processing.

---

## Historical Context (OBSOLETE)

The original MixologyHub B2C architecture explicitly accepted race conditions:
- No `SELECT FOR UPDATE`, no row-level locking
- Default `READ COMMITTED` isolation only
- No idempotency keys or distributed locks
- "Double-clicks may cause duplicate deductions — users must manually fix via UI"

This was viable in a B2C model where each user had an isolated inventory. Two users clicking "Prepare" simultaneously targeted different `user_inventory` rows, so collisions were rare and low-severity.

## Why the Old Approach Is No Longer Viable

In the new B2B single-bar architecture:
- **All bartenders share one `bar_inventory` table.** Two bartenders pressing "Prepare" simultaneously target the exact same ingredient rows.
- **Severe race conditions:** Without serialization, two concurrent `SELECT` + `UPDATE` operations on "Vodka" produce double-deductions (e.g., both bartenders see 50ml, both deduct 30ml, both write 20ml — actual deduction should be 60ml leaving -10ml or 20ml depending on timing).
- **PostgreSQL deadlocks:** Under `READ COMMITTED`, concurrent updates to the same row can cause deadlock errors that cascade into connection pool exhaustion and HTTP 504 timeouts.

## New Architecture: BullMQ Serialized Queue Processing

All inventory mutations now flow through a single-threaded BullMQ worker:

1. **`POST /cocktails/:id/prepare`** → Enqueues a job → Returns `202 Accepted`
2. **BullMQ Worker (concurrency: 1)** → Pops jobs sequentially → Executes PostgreSQL ACID transaction
3. **`GET /preparations/:logId/status`** → Frontend polls for completion

### Key Architectural Properties

| Property | Old B2C (OBSOLETE) | New B2B (CURRENT) |
|---|---|---|
| Inventory isolation | Per-user (`user_inventory`) | Shared global (`bar_inventory`) |
| Concurrency model | Fail-open (accept races) | Serialized (BullMQ concurrency: 1) |
| Deduction execution | Synchronous in HTTP controller | Async in BullMQ Worker |
| Race condition risk | High (mitigated by user isolation) | Zero (mathematically eliminated) |
| HTTP response | 200/400 immediate result | 202 Accepted + poll for result |
| Redis dependency | Cache-only (graceful degradation) | Critical (queue backbone) |
| UI update pattern | Optimistic instant update | Spinner → Poll → Success/Failure |
| Double-deduction risk | Accepted as trade-off | Impossible by design |

### What Has Been Reintroduced

- **Redis as critical infrastructure:** Redis is no longer optional. If Redis is down, no cocktail preparation is possible (the `bar-orders` queue is unavailable).
- **Strict ordering:** Jobs are processed FIFO within the queue, ensuring fair allocation of scarce inventory.
- **Idempotency by design:** The singleton worker naturally prevents duplicate processing of the same logical operation — no need for complex idempotency keys.

### What Remains Removed

- **Cross-tab sync / BroadcastChannel:** Still not implemented (frontend polls a REST endpoint).
- **Distributed locks / Redis Redlock:** Not needed — `concurrency: 1` is simpler and more reliable.
- **Optimistic concurrency for ratings:** Still simplified; ratings are not inventory-mutating and have lower consistency requirements.

## Trade-Offs Accepted

### 1. Redis as Single Point of Failure for Preparation
- If Redis goes down, bartenders cannot prepare drinks. Monitoring, persistence (AOF), and failover are mandatory operational requirements.

### 2. Asynchronous User Experience
- Bartenders see a spinner/pending state after pressing "Prepare" instead of an instant confirmation. This is a UX regression compared to optimistic UI, but necessary for inventory correctness.

### 3. Throughput Ceiling
- A single worker (`concurrency: 1`) can process approximately one preparation per DB transaction duration (~50-200ms). At 5-20 preparations/second, this is adequate for a single bar. If the bar scales to extreme volume, `concurrency` can be tuned upward with appropriate DB isolation.

## Related Documents
- [ADR 0017: B2B Shared Inventory with BullMQ Serialized Concurrency](./adrs/0017-b2b-shared-inventory-bullmq-concurrency.md)
- [Backend Architecture: Order Processing & Queue-Based Concurrency](./backend-architecture.md)
- [ADR 0001: Use PostgreSQL for Inventory Management](./adrs/0001-use-postgresql-for-inventory.md) (DEPRECATED for concurrency section)
- [ADR 0005: Rate Limiter Failure State Strategy](./adrs/0005-rate-limiter-failure-state-strategy.md) (amended — Redis is now critical)
