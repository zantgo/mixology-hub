# ADR 0015: Accept Precision Drift in Atomic Ratings (DEPRECATED)

## Status
**DEPRECATED** - Concurrency features removed for MVP simplification

## Context
This ADR described accepting precision drift in ratings to enable O(1) performance with atomic updates. For MVP simplification, all complex rating systems have been simplified.

## Decision
**No precision drift management needed.** We accept that:
- Ratings are simple averages without complex atomic updates
- No nightly recalibration cron job is needed
- Minor inaccuracies in ratings are acceptable for MVP
- No monitoring or alerting for drift magnitude

## Simplified Approach
- Basic rating calculation without performance optimization
- No O(1) vs O(n) trade-off analysis needed
- Simple average calculation from pivot table
- No complex drift correction systems

## Related Decisions
- ADR 0013: Optimistic Concurrency for Rating Updates (DEPRECATED)
- All concurrency features removed for MVP

### Architectural Decision: Uncorrected Rating Average Drift
**Explicit Trade-off:** Because we have deprecated optimistic concurrency control and atomic SQL updates for MVP, the cached rating column on the COCKTAILS table is updated via a simple read-calculate-write pattern. We explicitly accept that concurrent user ratings will cause race conditions, resulting in the cached average permanently drifting from the true mathematical average of the COCKTAIL_RATINGS pivot rows. We trade strict mathematical data integrity for O(1) database write simplicity, accepting minor UI rating inaccuracies.