# ADR 0012: Unified Idempotency System (DEPRECATED)

## Status
**DEPRECATED** - Concurrency features removed for MVP simplification

## Context
This ADR described a complex unified idempotency system to prevent double-deduction risks from duplicate requests. For MVP simplification, all concurrency protection has been removed.

## Decision
**No idempotency system will be implemented for MVP.** We accept that:
- Double-clicks may cause duplicate operations
- Users can manually fix duplicate deductions via UI
- Network retries may cause duplicate state changes

## Simplified Architecture
- Basic database transactions (all-or-nothing) only
- No Redis caching for idempotency
- No global interceptors or request hashing
- No idempotency headers or keys

## Consequences
### Positive
- **Simplified implementation**: No complex distributed systems
- **Faster development**: No need for Redis-PostgreSQL coordination
- **Reduced complexity**: No race condition mitigation code

### Negative
- **Potential duplicate operations**: Users may experience double deductions
- **Manual correction required**: Users must fix duplicate operations manually
- **No network retry protection**: Failed requests that retry may cause duplicates

## Related Decisions
- ADR 0009: Idempotency "Fail-Open" Double Deduction Risk (DEPRECATED)
- UC 4.21: Idempotency Keys for State-Mutating Operations (SIMPLIFIED)
- All concurrency features removed for MVP