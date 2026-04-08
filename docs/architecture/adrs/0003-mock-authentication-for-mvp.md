# ADR 0003: Mock Authentication for MVP Development

## Status
Accepted (Temporary)

## Context
During MVP development and code review, we need to:
1. Test Foreign Key constraints that require valid user IDs
2. Allow developers to run the application without complex auth setup
3. Enable API testing in tools like Postman/Insomnia without JWT tokens
4. Simplify the onboarding process for new contributors

The database schema has relationships that require valid user references:
- `cocktails.user_id` → `users.id`
- `favorites.user_id` → `users.id`
- `ai_records.user_id` → `users.id`

## Decision
Implement a `SeederService` that automatically creates a mock user on application boot:
- Email: `mock@test.com`
- Automatically used when no authentication context is present
- Satisfies all Foreign Key constraints
- Can be disabled in production via environment variable

## Consequences

### Positive
- **Developer Experience**: Zero-configuration local development
- **Code Review Friendly**: Reviewers can test the app without auth setup
- **Faster Iteration**: No need to implement full auth for MVP
- **Database Integrity**: All constraints are satisfied during development
- **Progressive Enhancement**: Can add real auth later without breaking existing functionality

### Negative
- **Security Risk**: Not suitable for production (must be disabled)
- **Testing Limitations**: Cannot test multi-user scenarios properly
- **Technical Debt**: Temporary solution that must be replaced
- **Misleading Behavior**: May mask auth-related bugs

### Alternatives Considered
1. **Full JWT/OAuth2 Implementation (Deferred)**:
   - ✅ Production-ready
   - ❌ Significant development time for MVP
   - ❌ Complex setup for local development
   - **Decision**: Schedule for next phase

2. **API Keys per Developer**:
   - ✅ Simple to implement
   - ❌ Still requires manual setup
   - ❌ Doesn't solve Foreign Key constraint issue
   - ❌ Hard to manage across team

3. **Disable Foreign Key Constraints**:
   - ❌ Violates data integrity principles
   - ❌ Masks data relationship issues
   - ❌ Poor database design practice

4. **In-Memory User Context**:
   - ✅ No database changes needed
   - ❌ Doesn't satisfy Foreign Key constraints
   - ❌ Limited to request scope only

## Implementation Details

### SeederService
```typescript
@Injectable()
export class SeederService {
  async seedMockUser() {
    const mockUser = await userRepository.findOne({ 
      where: { email: 'mock@test.com' } 
    });
    
    if (!mockUser) {
      await userRepository.save({
        email: 'mock@test.com',
        name: 'Mock User',
        // ... other required fields
      });
    }
  }
}
```

### Environment Configuration
```env
# .env configuration
ENABLE_MOCK_AUTH=true  # Default true for development
MOCK_USER_EMAIL=mock@test.com
```

### Production Safety
```typescript
// In production entry point
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_MOCK_AUTH === 'true') {
  throw new Error('Mock authentication must be disabled in production');
}
```

## Migration Path to Production Auth
1. **Phase 1**: Mock auth for MVP (current)
2. **Phase 2**: Implement JWT-based authentication
3. **Phase 3**: Add OAuth2 providers (Google, GitHub, etc.)
4. **Phase 4**: Implement role-based access control (RBAC)
5. **Phase 5**: Add audit logging and security monitoring

## Rollback Plan
If mock auth causes issues:
1. Disable via `ENABLE_MOCK_AUTH=false`
2. Manually create test users in database
3. Use simple API key authentication for testing

## Related Decisions
- [ADR 0001: Use PostgreSQL for Inventory Management](./0001-use-postgresql-for-inventory.md) - Mock user satisfies Foreign Key constraints
- [ADR 0002: Agnostic LLM Integration](./0002-agnostic-llm-integration.md) - Similar configuration-driven approach