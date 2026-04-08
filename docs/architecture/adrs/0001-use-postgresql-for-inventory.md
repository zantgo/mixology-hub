# ADR 0001: Use PostgreSQL for Inventory Management

## Status
Accepted

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
- **Row-level Locking**: Prevents race conditions when multiple users try to use the same ingredient simultaneously
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