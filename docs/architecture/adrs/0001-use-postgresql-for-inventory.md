# ADR 0001: Use PostgreSQL for Inventory Management

## Status
**Deprecated (Superseded by [ADR 0017](./0017-b2b-shared-inventory-bullmq-concurrency.md))**

> **Note:** This ADR's original decision to use PostgreSQL as the primary database remains valid. However, the "Acceptance of Race Conditions via READ COMMITTED" trade-off documented below is **DEPRECATED and replaced by ADR 0017**. The system no longer accepts race conditions as a trade-off; concurrency is now actively managed via single-threaded BullMQ queue processing.

## Context
MixologyHub needs to store highly relational data including:
- Cocktails with their ingredients and measurements
- User favorites and inventory
- Mathematical unit conversions for inventory depletion
- Strict inventory tracking to prevent negative quantities

The system requires ACID compliance for operations like:
- Deducting inventory when cocktails are made
- Ensuring ingredient quantities don't go negative
- Maintaining data consistency across related entities

## Decision
Use PostgreSQL with TypeORM as the primary database.

## Consequences

### Positive
- **ACID Compliance**: PostgreSQL provides full ACID guarantees out of the box, essential for inventory management
- **Relational Integrity**: Foreign key constraints ensure data consistency between cocktails, ingredients, and users
- **Architectural Decision: Acceptance of Race Conditions via READ COMMITTED**
  - **Explicit Trade-off:** We explicitly retract the use of SELECT FOR UPDATE row-level database locking for inventory deductions. To adhere to the "No Concurrency" mandate, the database will rely strictly on default READ COMMITTED isolation and standard CHECK (quantity >= 0) constraints. We trade absolute concurrent transaction safety for maximum database throughput and the total elimination of transaction deadlocks. We accept that rapid double-clicks may result in standard 500 Server Errors when hitting the CHECK boundary.
- **Complex Queries**: Support for `HAVING` clauses and window functions for inventory analytics
- **TypeORM Integration**: Excellent TypeScript support with repository pattern and query builder

### Negative
- **Operational Overhead**: Requires more maintenance than serverless options
- **Vertical Scaling**: More complex to scale horizontally compared to NoSQL databases
- **Learning Curve**: Developers need to understand relational modeling and SQL

### Alternatives Considered
1. **MongoDB (NoSQL)**: 
   - ❌ Lacks native ACID compliance for multi-document transactions
   - ❌ No built-in referential integrity
   - ❌ Would require application-level validation for inventory constraints

2. **SQLite**:
   - ❌ Not suitable for concurrent web applications
   - ❌ Limited scalability
   - ❌ Poor performance with multiple connections

3. **Firestore/Cloud Firestore**:
   - ❌ Eventual consistency model unsuitable for inventory
   - ❌ No native support for complex joins
   - ❌ Vendor lock-in with Google Cloud

## Implementation Notes
- Use TypeORM migrations for schema versioning
- Implement database-level constraints for minimum inventory levels
- Use transaction isolation levels for inventory updates
- Consider connection pooling for performance optimization

## Related Decisions
- [ADR 0003: Mock Authentication for MVP](./0003-mock-authentication-for-mvp.md) - Uses PostgreSQL foreign keys for user relationships