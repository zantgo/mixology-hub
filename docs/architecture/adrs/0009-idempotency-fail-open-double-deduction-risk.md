# ADR 0009: Idempotency "Fail-Open" Double Deduction Risk (DEPRECATED)

## Status
**DEPRECATED** - Concurrency features removed for MVP simplification

## Context
This ADR described idempotency failure modes during Redis outages. For MVP simplification, all idempotency systems have been removed.

## Decision
**No idempotency system will be implemented.** We accept that:
- Redis outages won't affect idempotency (because there is no idempotency)
- Double-clicks may cause duplicate operations anytime
- Users must use the undo feature or manually correct duplicates

## Simplified Approach
- No Redis-based idempotency checks
- No fail-open/fail-closed decisions needed
- No monitoring or alerts for idempotency bypass
- Basic database transactions only

## Related Decisions
- ADR 0012: Unified Idempotency System (DEPRECATED)
- All concurrency features removed for MVP