# ADR 0002: Agnostic LLM Integration via Dependency Inversion

## Status
Accepted

## Context
AI providers (OpenAI, Anthropic, DeepSeek, etc.) have:
- Frequently changing pricing models
- Varying availability and regional restrictions
- Different API formats and response structures
- Evolving feature sets and model capabilities

The cocktail recipe generation feature should not be locked to a single provider, as this creates:
- Vendor lock-in
- Business risk if provider changes terms
- Technical debt if API changes
- Limited flexibility for cost optimization

## Decision
Implement the Dependency Inversion Principle (DIP) for AI integration:
1. Define an `IAiProvider` interface that the application depends on
2. Create concrete implementations that adapt to specific providers
3. Use environment variables to select and configure the active provider
4. Design the system to allow zero-code changes when switching providers

## Consequences

### Positive
- **Vendor Independence**: Switch AI providers by changing `.env` variables only
- **Cost Optimization**: Easily compare and switch between providers based on pricing
- **Resilience**: Fallback providers can be implemented for redundancy
- **Testing**: Mock providers can be used for unit and integration tests
- **Standardization**: All providers must conform to the same interface

### Negative
- **Abstraction Overhead**: Additional layer of indirection
- **Provider-Specific Features**: Advanced features unique to one provider may not be accessible through the interface
- **Configuration Complexity**: More environment variables to manage

### Alternatives Considered
1. **Direct Integration (Current Anti-Pattern)**:
   - ❌ Hardcoded to specific AI provider
   - ❌ Requires code changes to switch providers
   - ❌ Creates technical debt

2. **Provider-Specific Modules**:
   - ❌ Still creates coupling at module level
   - ❌ Duplicate code for similar functionality
   - ❌ Complex dependency injection setup

3. **Service Registry Pattern**:
   - ⚠️ Overly complex for current needs
   - ⚠️ Dynamic loading adds runtime complexity
   - ✅ Could be future evolution if needed

## Implementation Details

### Interface Definition
```typescript
export interface IAiProvider {
  generateRecipe(ingredients: string[]): Promise<{
    name: string;
    ingredients: Array<{ name: string; measure: string }>;
    instructions: string;
  }>;
}
```

### Configuration Strategy
```env
# .env configuration
AI_API_URL=https://api.deepseek.com/v1/chat/completions  # or OpenAI/Anthropic URLs
AI_API_KEY=your_api_key_here
AI_MODEL=deepseek-chat  # or 'gpt-4o-mini', 'claude-3-5-sonnet', etc.
```

### Provider Selection Logic
The `AiService` uses a factory method to select the appropriate provider:
1. If `AI_API_URL` is configured → Use `LlmAdapterService` (supports OpenAI-compatible APIs like DeepSeek, OpenAI, Anthropic)
2. Else → Throw configuration error (AI integration requires API configuration)

## Migration Path
1. **Phase 1**: Implement interface and adapter pattern (current)
2. **Phase 2**: Add configuration-based provider selection
3. **Phase 3**: Implement provider health checks and automatic failover
4. **Phase 4**: Add usage metrics and cost tracking per provider

## Related Decisions
- [ADR 0001: Use PostgreSQL for Inventory Management](./0001-use-postgresql-for-inventory.md) - Both decisions emphasize long-term maintainability
- [ADR 0003: Mock Authentication for MVP](./0003-mock-authentication-for-mvp.md) - Similar configuration-driven approach