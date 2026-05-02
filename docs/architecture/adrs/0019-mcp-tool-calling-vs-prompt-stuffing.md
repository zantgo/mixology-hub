# ADR 0019: MCP Tool-Calling vs. Prompt Stuffing

## Status
Accepted

## Context
The original AI Bartender architecture used **"Context Stuffing"** — the entire bar inventory (up to 100 ingredients, truncated) was injected into every LLM system prompt. This approach had severe limitations:

1. **Token Bloat**: 100 ingredients × ~20 tokens each consumed 2,000+ tokens per request, multiplied across retries and multi-turn conversations.
2. **Context Window Exhaustion**: Large inventories (200+ ingredients) exceeded standard model context windows, forcing aggressive truncation.
3. **Hallucination Risk**: The LLM couldn't reliably track which ingredients it had already used across a multi-turn conversation when the full list was re-injected each time.
4. **Cost Scaling**: Every prompt iteration carried the full inventory payload, making per-request costs proportional to inventory size rather than recipe complexity.
5. **Prompt Injection Surface**: A 4,000-character "Strict Inventory Mode" input window created an oversized attack surface for prompt injection attempts.

The old architecture also enforced **asymmetric input length bounds** (500 chars for standard prompts, 4,000 chars for strict inventory mode) and a **100-ingredient limit** with priority-based truncation. These were workarounds for the fundamental problem: the LLM couldn't selectively query data.

## Decision
We migrate to **MCP (Model Context Protocol)** tool calling. The NestJS backend exposes itself as an MCP Server with the following tools:

| Tool | Type | Purpose |
|------|------|---------|
| `get_bar_inventory` | Read | Retrieve current bar stock levels |
| `search_cocktails` | Read | Unified search across local + external recipes |
| `get_cocktail_detail` | Read | Full recipe with ingredients and instructions |
| `convert_units` | Read | Convert between measurement units |
| `prepare_cocktail` | Write | Enqueue a preparation order to BullMQ |
| `check_makeability` | Read | Verify a cocktail is makeable against bar stock |

The LLM selectively invokes only the tools it needs for the current user request, receiving precisely the data required — not the entire inventory.

### Transport
- **SSE (Server-Sent Events)**: `GET /api/mcp/sse` for web-based LLMs (OpenAI, Anthropic, DeepSeek APIs).
- **stdio**: Standalone entrypoint for local LLMs (Claude Desktop, Continue.dev).

### Authentication
- One-time tickets via `POST /api/mcp/ticket` with 30-second TTL and single-use enforcement.
- All tool calls attributed to the authenticated user for audit trail purposes.

### Audit Trail
- All tool invocations logged to `AI_TOOL_AUDIT` table.
- Write operations logged unconditionally; read operations sampled at a configurable rate (default 10%).

## Consequences

### Positive
- **90%+ Token Reduction**: A recipe generation request now uses ~200 tokens for tool definitions and responses instead of 2,000+ for full inventory injection.
- **Eliminated Truncation**: No 100-ingredient limit — the LLM queries the database directly and gets exact results.
- **Improved Accuracy**: The LLM receives precise, up-to-date data from the authoritative source (`bar_inventory`) rather than a potentially stale prompt snapshot.
- **Auditability**: Every tool call is logged with arguments, result, and triggering user, enabling cost tracking and abuse detection.
- **Tool Schema as Defense**: Strict JSON schema validation on tool parameters eliminates the large prompt injection surface area of the old 4,000-character input window.
- **Multi-Turn Capability**: The LLM can maintain context across tool calls without re-injecting the full inventory — it remembers what it already queried.

### Negative
- **MCP Protocol Dependency**: The system now depends on MCP-compatible LLM providers or MCP client libraries for the stdio transport.
- **Additional Infrastructure**: SSE endpoint management, ticket generation/validation, and audit logging add operational complexity.
- **LLM Must Understand Tools**: Not all LLM providers have equal tool-calling capabilities. The system prompt must effectively instruct the LLM on which tools are available and how to use them.
- **Session Management**: MCP sessions require tracking state (ticket validity, tool call attribution), adding complexity compared to stateless prompt requests.

## Alternatives Considered

### 1. Keep Prompt Stuffing (Rejected)
- **Pros**: Simpler implementation, works with any LLM regardless of tool-calling support.
- **Cons**: Unsustainable token costs at scale, context window limits, hallucination from stale/truncated data, large injection surface.

### 2. Function Calling with Provider-Specific APIs (Rejected)
- **Pros**: Native support in OpenAI/Anthropic APIs without MCP.
- **Cons**: Vendor lock-in; each provider has a different function-calling API; no standard for local LLMs.

### 3. Hybrid: Prompt Stuffing with Selective Tool Fallback (Rejected)
- **Pros**: Graceful degradation for LLMs that don't support tools.
- **Cons**: Doubles implementation complexity; the prompt-stuffed path still carries all the original problems.

## Related Decisions
- [ADR 0017: B2B Shared Inventory with BullMQ Serialized Concurrency](./0017-b2b-shared-inventory-bullmq-concurrency.md) — The BullMQ worker processes both human and AI-triggered preparations identically.
- [ADR 0002: Agnostic LLM Integration](./0002-agnostic-llm-integration.md) — The provider-agnostic AI adapter pattern enables switching LLM providers without changing the MCP tool definitions.

## Implementation Notes
- MCP tool definitions are declared once and served to both SSE and stdio transports from the same source.
- Tool parameter validation uses the same `class-validator` DTOs used elsewhere in the NestJS backend.
- The `AI_AUDIT_READ_SAMPLE_RATE` env var controls audit sampling (default: `0.1` = 10%).
- Rate limiting on tool calls is per-MCP-session to prevent runaway LLM loops from exhausting resources.
