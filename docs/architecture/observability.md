# Observability Strategy

## Overview
Observability in MixologyHub is designed as a three-pillar approach: **Logs, Metrics, and Traces**. The system is instrumented to provide comprehensive visibility into application health, performance, and business metrics.

### Architectural Decision: Observability Telemetry Exemption from No-Concurrency Mandate
**Explicit Trade-off:** While we strictly ban asynchronous eventing and message queues for business logic, we explicitly exempt standard APM/Observability agents (e.g., OpenTelemetry) from the "No Background Promises" mandate. We accept that these libraries run autonomous background batch-flush loops inside the Node.js process to dispatch metrics. We trade absolute single-threaded purity for essential production visibility and metric aggregation.

## Current Implementation

### 1. Structured Logging
```typescript
// NestJS Logger with structured context
this.logger.log('User favorite added', {
  userId: user.id,
  cocktailId: favorite.cocktailId,
  timestamp: new Date().toISOString()
});

this.logger.error('AI generation failed', {
  error: error.message,
  ingredients: ingredients,
  provider: this.configService.get('AI_PROVIDER')
});
```

**Key Log Categories:**
- **Application**: Startup, shutdown, configuration
- **Business**: User actions, cocktail creations, favorites
- **Performance**: API response times, database queries
- **Errors**: Exceptions, validation failures, external API errors
- **Security**: Authentication attempts, authorization failures

### 2. Global Exception Filter
```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Structured error logging
    this.logger.error('Unhandled exception', {
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      exception: exception instanceof Error ? {
        name: exception.name,
        message: exception.message,
        stack: exception.stack
      } : exception
    });
    
    // Return consistent error format
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url
    });
  }
}
```

## Production Observability Architecture

### Target Stack
```
[ Application ] → [ OpenTelemetry ] → [ Observability Backend ]
      ↓                  ↓                       ↓
   Logs/Metrics      Standardized          Datadog / New Relic /
   Traces            collection            AWS CloudWatch / Grafana
```

### 1. Metrics Collection

#### Application Metrics
```typescript
// Using OpenTelemetry Metrics API
const meter = metrics.getMeter('mixologyhub');
const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total HTTP requests'
});

const responseTimeHistogram = meter.createHistogram('http_response_time_ms', {
  description: 'HTTP response time in milliseconds',
  unit: 'ms'
});
```

**Key Metrics:**
- **Throughput**: Requests per second, by endpoint
- **Latency**: P50, P95, P99 response times
- **Errors**: Error rate by endpoint and type
- **Business**: Cocktails generated, favorites added, users active
- **External APIs**: Success rate, latency for TheCocktailDB, AI providers

#### Database Metrics
- Connection pool utilization
- Query execution time
- Transaction rates
- Lock contention
- Replication lag (if applicable)

#### Cache Metrics
- Hit/miss ratio
- Memory usage
- Eviction rate
- Network I/O

### 2. Monolith Request Tracing

```typescript
// OpenTelemetry tracing
const tracer = trace.getTracer('mixologyhub');

async function generateCocktail(ingredients: string[]) {
  return tracer.startActiveSpan('ai.generateRecipe', async (span) => {
    try {
      span.setAttributes({
        'ingredients.count': ingredients.length,
        'ai.provider': this.configService.get('AI_PROVIDER')
      });
      
      const recipe = await this.aiProvider.generateRecipe(ingredients);
      
      span.setStatus({ code: SpanStatusCode.OK });
      return recipe;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

**Trace Context Propagation:**
- HTTP headers for cross-service tracing
- Database query correlation
- External API call tracing
- Request lifecycle tracing

### 3. Log Aggregation & Analysis

#### Log Structure
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "service": "cocktail-service",
  "environment": "production",
  "trace_id": "abc123def456",
  "span_id": "xyz789",
  "message": "Cocktail created successfully",
  "context": {
    "userId": "user-123",
    "cocktailId": "cocktail-456",
    "source": "ai-generated",
    "ingredientsCount": 5
  }
}
```

#### Log Destinations
- **Development**: Console output with pretty formatting
- **Staging**: CloudWatch Logs / Datadog
- **Production**: Centralized log aggregation with retention policies

## Alerting Strategy

### Alert Levels

#### Critical (PagerDuty/SMS)
- Database unavailable > 5 minutes
- Error rate > 10% for 5 minutes
- External API failure rate > 50%
- Memory usage > 90% for 10 minutes

#### Warning (Email/Slack)
- Response time P95 > 2 seconds
- Cache hit rate < 70%
- Database connection pool > 80% utilized
- Disk space < 20% free

#### Informational (Dashboard Only)
- Deployment completed
- Feature flag changes
- User milestone reached (e.g., 1000th cocktail)

### Alert Routing
```
[ Alert ] → [ Routing Rules ] → [ Notification Channels ]
    ↓              ↓                       ↓
  Generated    Environment-based      PagerDuty, Email,
  by system    team-based routing     Slack, SMS
```

## Dashboard Design

### 1. Service Health Dashboard
- **Overall Status**: Green/Yellow/Red indicators
- **Key Metrics**: Error rate, latency, throughput
- **Dependencies**: Database, cache, external APIs status
- **Recent Deployments**: Version, timestamp, health

### 2. Business Metrics Dashboard
- **User Activity**: Daily active users, new registrations
- **Cocktail Operations**: Generated, saved, favorited
- **AI Usage**: Recipes generated, success rate, cost
- **Inventory**: Most used ingredients, depletion rates

### 3. Performance Dashboard
- **API Performance**: Endpoint latency, error rates
- **Database Performance**: Query times, connection pool
- **Cache Performance**: Hit rates, memory usage
- **External APIs**: Response times, success rates

### 4. Infrastructure Dashboard
- **Resource Utilization**: CPU, memory, disk, network
- **Cost Tracking**: Cloud spend by service
- **Capacity Planning**: Trends and forecasts

## Implementation Roadmap

### Phase 1: Basic Instrumentation (Current)
- ✅ Structured logging with NestJS Logger
- ✅ Global exception filter
- ✅ Basic error tracking
- ⬜ Health check endpoints

### Phase 2: Enhanced Metrics
- ⬜ OpenTelemetry integration
- ⬜ Custom business metrics
- ⬜ Database performance metrics
- ⬜ External API monitoring

### Phase 3: Production Observability
- ⬜ Monolithic request tracing
- ⬜ Log aggregation pipeline
- ⬜ Alerting configuration
- ⬜ Dashboard creation

### Phase 4: Advanced Features
- ⬜ Anomaly detection
- ⬜ Predictive alerting
- ⬜ Cost optimization insights
- ⬜ User experience monitoring

## Tools & Technologies

### Recommended Stack
- **Metrics & Tracing**: OpenTelemetry
- **Log Aggregation**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **APM**: Datadog, New Relic, or AWS X-Ray
- **Alerting**: PagerDuty, Opsgenie
- **Visualization**: Grafana, Kibana

### Cloud-Native Options
- **AWS**: CloudWatch, X-Ray, OpenSearch
- **Google Cloud**: Cloud Monitoring, Cloud Trace, Cloud Logging
- **Azure**: Application Insights, Monitor

## Cost Considerations

### Optimization Strategies
1. **Sampling**: Sample traces in high-volume environments
2. **Retention**: Tiered retention based on log importance
3. **Aggregation**: Aggregate metrics to reduce cardinality
4. **Filtering**: Exclude debug logs in production

### Budget Allocation
- **Development**: $0-50/month (basic monitoring)
- **Staging**: $50-200/month (full observability)
- **Production**: $200-1000/month (enterprise features)

## Security & Compliance

### Log Security
- Never log sensitive data (passwords, API keys, PII)
- Implement log redaction for sensitive fields
- Secure log transmission (TLS)
- Access control for log data

### Compliance
- GDPR: User data retention policies
- HIPAA: Healthcare data handling (if applicable)
- PCI DSS: Payment data security (if applicable)
- SOC 2: Security controls documentation