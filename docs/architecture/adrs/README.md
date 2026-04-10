# Architecture Decision Records (ADRs)

## Overview
This directory contains Architecture Decision Records (ADRs) for the MixologyHub project. ADRs document important architectural decisions made during the development of the system, including the context, alternatives considered, and consequences of each decision.

## What are ADRs?
Architecture Decision Records are lightweight documents that capture:
- **Context**: The situation that led to the decision
- **Decision**: What was decided
- **Consequences**: The results of the decision, both positive and negative
- **Alternatives**: Other options that were considered and why they weren't chosen

## ADR Format
Each ADR follows this structure:
1. **Title**: Short, descriptive title
2. **Status**: Proposed, Accepted, Superseded, Deprecated
3. **Context**: The problem or opportunity being addressed
4. **Decision**: The chosen solution
5. **Consequences**: Outcomes of the decision
6. **Alternatives**: Other options considered
7. **Related Decisions**: Links to other relevant ADRs

## Current ADRs

### [ADR 0001: Use PostgreSQL for Inventory Management](./0001-use-postgresql-for-inventory.md)
**Status**: Accepted  
**Summary**: Decision to use PostgreSQL with TypeORM for relational data storage, emphasizing ACID compliance for inventory management.

### [ADR 0002: Agnostic LLM Integration via Dependency Inversion](./0002-agnostic-llm-integration.md)
**Status**: Accepted  
**Summary**: Implementation of Dependency Inversion Principle for AI provider integration, allowing configuration-based switching between LLM providers.

### [ADR 0003: Mock Authentication for MVP Development](./0003-mock-authentication-for-mvp.md)
**Status**: Accepted (Temporary)  
**Summary**: Temporary mock authentication strategy using a SeederService to simplify development while satisfying Foreign Key constraints.

### [ADR 0004: Accept In-Memory Math Overhead for MVP Makeability Calculations](./0004-in-memory-makeability-dos-vulnerability.md)
**Status**: Accepted  
**Summary**: Decision to accept O(N) CPU-bound in-memory math for makeability validation in MVP, with plans to migrate to PostgreSQL stored functions in Phase 4.

### [ADR 0005: Rate Limiter Failure State Strategy (Redis Degradation)](./0005-rate-limiter-failure-state-strategy.md)
**Status**: Accepted  
**Summary**: Hybrid fail-safe strategy for Redis degradation: in-memory fallback for rate limiting, fail-closed for AI quotas, fail-open for idempotency and sessions.

### [ADR 0006: Last Write Wins vs. Delta-Only Sync for Offline Operations](./0006-last-write-wins-vs-delta-only-sync.md)
**Status**: Deprecated  
**Summary**: **DEPRECATED** - Offline functionality removed as part of Online-Only Mandate. This ADR documented delta-only sync for offline inventory operations.

### [ADR 0007: SSRF Prevention vs. Image Link Rot Validation Trade-off](./0007-ssrf-prevention-vs-image-link-rot-validation.md)
**Status**: Superseded by ADR 0011  
**Summary**: Decision to prioritize SSRF prevention over link validation - backend validates URL format only, frontend handles broken images at runtime.

### [ADR 0008: O(N×Page) DoS Risk in Makeability Pagination](./0008-makeability-pagination-dos-risk.md)
**Status**: Accepted  
**Summary**: Decision to implement strict pagination caps (max page=10, offset=100) for makeability sorting to prevent DoS attacks from deep pagination.

### [ADR 0009: Idempotency "Fail-Open" Double Deduction Risk](./0009-idempotency-fail-open-double-deduction-risk.md)
**Status**: Superseded by ADR 0012  
**Summary**: Decision to accept double-deduction risk during Redis outages with user undo recovery, rather than implementing complex database fallback.

### [ADR 0010: Offline Logout Impeding JWT Revocation Gap](./0010-offline-logout-jwt-revocation-gap.md)
**Status**: Deprecated  
**Summary**: **DEPRECATED** - Offline functionality removed as part of Online-Only Mandate. This ADR documented security gap where offline logout didn't revoke server-side tokens.

### [ADR 0011: Client IP Leakage via External Images Despite SSRF Prevention](./0011-client-ip-leakage-external-images.md)
**Status**: Accepted  
**Summary**: Decision to implement secure image proxy for all external cocktail images to prevent client IP leakage while maintaining SSRF protection.

### [ADR 0012: Unified Idempotency System to Prevent Redis-PostgreSQL Clash](./0012-unified-idempotency-system.md)
**Status**: Accepted  
**Summary**: Decision to implement unified hybrid idempotency system with PostgreSQL as source of truth to prevent double deductions from clashing Redis/PostgreSQL idempotency systems.

### [ADR 0013: Optimistic Concurrency for Rating Updates to Prevent GDPR Contention](./0013-optimistic-rating-concurrency.md)
**Status**: Accepted  
**Summary**: Decision to replace `SELECT FOR UPDATE` with optimistic concurrency control using atomic SQL updates to prevent database contention during GDPR bulk rating recalculations.

### [ADR 0014: Composite Cursor Pagination Cache Jitter](./0014-composite-cursor-pagination-cache-jitter.md)
**Status**: Accepted  
**Summary**: Decision to accept pagination jitter when external API cache expires during deep pagination, with UI warnings and graceful restart.

### [ADR 0015: Accept Precision Drift in Atomic Ratings](./0015-accept-precision-drift-in-atomic-ratings.md)
**Status**: Accepted  
**Summary**: Decision to accept minor decimal precision drift in atomic rating calculations (O(1) performance) with nightly cron job correction, trading mathematical accuracy for update performance.

## How to Create a New ADR

1. **Determine if an ADR is needed**: 
   - Is this a significant architectural decision?
   - Will future developers need to understand why this decision was made?
   - Does the decision have long-term consequences?

2. **Create the ADR file**:
   ```bash
   # Navigate to the adrs directory
   cd docs/architecture/adrs
   
   # Create a new ADR with the next sequential number
   # Format: 0004-short-descriptive-title.md
   ```

3. **Follow the template**:
   - Use one of the existing ADRs as a template
   - Be concise but thorough
   - Include all relevant context
   - Document alternatives considered

4. **Update this README**:
   - Add the new ADR to the list above
   - Include status and brief summary

## ADR Lifecycle
1. **Proposed**: Decision is under discussion
2. **Accepted**: Decision has been approved and implemented
3. **Superseded**: Decision has been replaced by a newer ADR
4. **Deprecated**: Decision is no longer relevant but kept for historical context

## When to Create an ADR
Create an ADR when:
- Choosing a new technology or framework
- Making significant design pattern decisions
- Establishing data storage strategies
- Defining integration patterns with external systems
- Making security-related architecture decisions
- Establishing deployment or operational patterns

## When NOT to Create an ADR
- Implementation details (use code comments)
- Temporary workarounds (use TODO comments)
- Minor refactorings
- Bug fixes
- Feature additions without architectural impact

## Review Process
1. **Draft**: Author creates initial ADR
2. **Review**: Team reviews and provides feedback
3. **Revision**: Author incorporates feedback
4. **Approval**: Team agrees on final version
5. **Implementation**: Decision is implemented in code
6. **Maintenance**: ADR is updated if decision changes

## Related Documentation
- [Deployment Strategy](../deployment-and-cicd.md)
- [Observability Strategy](../observability.md)
- [Project README](../../../README.md)