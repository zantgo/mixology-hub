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
**Status**: Deprecated (Superseded by ADR 0017)  
**Summary**: Decision to use PostgreSQL with TypeORM for relational data storage. The concurrency section ("Acceptance of Race Conditions via READ COMMITTED") is deprecated by ADR 0017. PostgreSQL as the primary database remains in effect.

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
**Status**: Accepted (Amended by ADR 0017)  
**Summary**: Hybrid fail-safe strategy for Redis degradation. Local-only rate limiting remains for ThrottlerGuard. However, Redis is now a critical infrastructure dependency for BullMQ queues (ADR 0017).

### [ADR 0006: Last Write Wins vs. Delta-Only Sync for Offline Operations](./0006-last-write-wins-vs-delta-only-sync.md)
**Status**: Deprecated  
**Summary**: **DEPRECATED** - Offline functionality removed as part of Online-Only Mandate. This ADR documented delta-only sync for offline inventory operations.

### [ADR 0007: SSRF Prevention vs. Image Link Rot Validation Trade-off](./0007-ssrf-prevention-vs-image-link-rot-validation.md)
**Status**: Deprecated (Replaced by Native Uploads - ADR 0016)  
**Summary**: Decision to prioritize SSRF prevention over link validation - backend validates URL format only, frontend handles broken images at runtime.

### [ADR 0008: O(N×Page) DoS Risk in Makeability Pagination](./0008-makeability-pagination-dos-risk.md)
**Status**: Accepted  
**Summary**: Decision to implement strict pagination caps (max page=100 globally, with 200-iteration computation limit for makeability sorting) to prevent DoS attacks from deep pagination.

### [ADR 0010: Offline Logout Impeding JWT Revocation Gap](./0010-offline-logout-jwt-revocation-gap.md)
**Status**: Deprecated  
**Summary**: **DEPRECATED** - Offline functionality removed as part of Online-Only Mandate. This ADR documented security gap where offline logout didn't revoke server-side tokens.

### [ADR 0011: Client IP Leakage via External Images Despite SSRF Prevention](./0011-client-ip-leakage-external-images.md)
**Status**: Deprecated (Replaced by Native Uploads - ADR 0016)  
**Summary**: Decision to implement secure image proxy for all external cocktail images to prevent client IP leakage while maintaining SSRF protection. **DEPRECATED** by ADR 0016 (Local Image Processing via Sharp).

### [ADR 0014: Composite Cursor Pagination Cache Jitter](./0014-composite-cursor-pagination-cache-jitter.md)
**Status**: Deprecated  
**Summary**: Deprecated in favor of standardized offset-based page limits across all endpoints.

### [ADR 0016: Local Image Processing via Sharp](./0016-local-image-processing-via-sharp.md)
**Status**: Accepted  
**Summary**: Decision to replace URL-based image fetching with secure local file upload system using Sharp for image processing, eliminating SSRF and IP leakage risks.

### [ADR 0017: B2B Shared Inventory with BullMQ Serialized Concurrency](./0017-b2b-shared-inventory-bullmq-concurrency.md)
**Status**: Accepted  
**Summary**: Architectural pivot from B2C isolated inventories to B2B single-bar shared inventory. Implements Redis-backed BullMQ with `concurrency: 1` for the `bar-orders` queue to guarantee mathematical elimination of race conditions and deadlocks for cocktail preparation. Supersedes ADR 0001's concurrency trade-off and reinstates Redis as a critical infrastructure dependency.

### [ADR 0019: MCP Tool-Calling vs. Prompt Stuffing](./0019-mcp-tool-calling-vs-prompt-stuffing.md)
**Status**: Accepted  
**Summary**: Migration from Context Stuffing (injecting entire bar inventory into LLM prompts) to MCP tool calling. The backend exposes itself as an MCP Server with 6 tools. Reduces token usage by >90%, eliminates the 100-ingredient truncation limit, and provides auditable tool-call trails via `AI_TOOL_AUDIT`.

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