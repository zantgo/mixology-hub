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