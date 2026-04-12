# ADR 0013: Optimistic Concurrency for Rating Updates (DEPRECATED)

## Status
**DEPRECATED** - Concurrency features removed for MVP simplification

## Context
This ADR described complex optimistic concurrency control for rating updates to prevent contention during GDPR deletions. For MVP simplification, all concurrency protection has been removed.

## Decision
**No optimistic concurrency control will be implemented for ratings.** We accept that:
- Concurrent rating updates may cause minor inaccuracies
- No retry logic or exponential backoff is needed
- No complex atomic SQL updates with boundary enforcement
- Ratings are best-effort and minor inconsistencies are acceptable

## Simplified Approach
- Basic rating updates without locking
- No `SELECT FOR UPDATE` or optimistic retry loops
- No GDPR bulk processing (ratings remain when users delete accounts)
- Simple average calculation without boundary enforcement

## Related Decisions
- ADR 0015: Accept Precision Drift in Atomic Ratings (DEPRECATED)
- All concurrency features removed for MVP