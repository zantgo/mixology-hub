# API Documentation & Testing

This directory contains API documentation and testing resources for MixologyHub.

## 📚 API Specification

- [REST API Specification](./api-spec.md) - Complete API documentation with examples
- [Pagination Implementation](./api-spec.md#-pagination-implementation-guide) - Page-based pagination details
- [Error Response Reference](./api-spec.md#-global-error-response-reference) - Standard error formats

## 🧪 Testing Resources

### Postman Collection
- [MixologyHub Postman Collection](./mixologyhub.postman_collection.json) - Complete API test collection

### Importing the Collection

1. **Open Postman**
2. Click **Import** → **File** → **Upload Files**
3. Select `mixologyhub.postman_collection.json`
4. Click **Import**

### Environment Setup

1. **Create Environment** in Postman:
   - Name: `MixologyHub Local`
   - Add variable: `base_url` = `http://localhost:3000`

2. **Set Environment Variables** in `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start Services**:
   ```bash
   make start
   ```

### Collection Structure

The Postman collection is organized by API resource:

#### 1. **Cocktails**
- `GET /cocktails` - Search cocktails with pagination
- `POST /cocktails/:id/prepare` - Enqueue preparation order (202 Accepted)
- `GET /cocktails/preparations/:logId/status` - Poll preparation status

#### 2. **Bar Inventory (Admin-Only Mutations)**
- `GET /bar-inventory` - View shared bar inventory (all roles)
- `GET /bar-inventory/makeable` - Get makeable cocktails
- `POST /bar-inventory` - Add stock (admin only)
- `DELETE /bar-inventory/:id` - Remove stock (admin only)

#### 3. **AI Recipe Generation**
- `POST /ai` - Generate recipe from ingredients
- `POST /ai/:id/save-as-cocktail` - Save AI recipe as permanent

#### 4. **Ingredients & Favorites**
- `GET /ingredients` - Global ingredient catalog
- `POST /favorites` - Save cocktail to favorites

### Testing Scenarios

#### Happy Path Testing
1. Search for cocktails
2. Add ingredients to inventory
3. Check makeable cocktails
4. Prepare a cocktail
5. Generate AI recipe
6. Save AI recipe

#### Error Testing
1. Prepare cocktail without ingredients (400)
2. AI prompt injection attempt (400)
3. Invalid pagination page number (400)

#### Performance Testing
1. Large result sets with pagination
2. Concurrent inventory updates
3. AI response time monitoring

## 🔧 API Development

### Local Development
```bash
# Start backend in development mode
cd src/backend
npm run start:dev

# API will be available at http://localhost:3000
```

### Swagger UI
Access interactive API documentation at:
- **Local**: http://localhost:3000/api-docs
- **Features**:
  - Interactive endpoint testing
  - Request/response schemas
  - Authentication testing
  - Model definitions

### API Standards

#### Request Headers
```http
Content-Type: application/json
Accept: application/json
```

#### Response Format
**Success (200 OK):**
```json
{
  "data": { ... },
  "meta": {
    "currentPage": 1,
    "nextPage": 2,
    "itemsPerPage": 10,
    "totalItems": 150,
    "totalPages": 15
  }
}
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Descriptive error message",
  "error": "Bad Request",
  "timestamp": "2026-04-08T10:30:00.000Z",
  "path": "/api/endpoint"
}
```

#### Pagination
- **Page-based**: `?limit=10&page=1`
- **Default limit**: 10 items
- **Max limit**: 100 items
- **Max page**: 100 (prevents deep pagination DoS)
- **Ordering**: `created_at DESC, id DESC`

## 🧪 Automated Testing

### Running API Tests
```bash
# Backend E2E tests
cd src/backend
npm run test:e2e

# Test coverage
npm run test:cov
```

### Test Coverage
- **Unit Tests**: Service layer with mocked dependencies
- **Integration Tests**: Database interactions
- **E2E Tests**: Full HTTP request/response cycle

### Test Data
Tests use the mock user: `mock@test.com`
- Automatically seeded on application start
- Satisfies foreign key constraints
- No authentication required for MVP

## 🔍 Debugging

### Common Issues

#### 1. **Connection Refused**
```bash
# Check if services are running
docker ps

# Start services
make start

# Check logs
make logs
```

#### 2. **Database Errors**
```bash
# Reset database
make clean
make start

# Check database connection
docker exec -it mixology_db psql -U admin -d mixology_hub
```

#### 3. **AI Integration Failures**
- Verify `.env` has valid API keys
- Check AI provider status
- Review rate limits and quotas

#### 4. **CORS Issues**
- Frontend: http://localhost:4200 (dev) or http://localhost:8080 (Docker)
- Backend: http://localhost:3000
- Configured in NestJS CORS settings to allow both development ports
- Production: Restricted to https://mixologyhub.com

### Logging
```bash
# View all logs
make logs

# View specific service
docker compose logs -f backend

# Debug level logging
# Set LOG_LEVEL=debug in .env
```

## 📊 Monitoring

### Health Checks
```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-08T10:30:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "ai_provider": "configured"
  }
}
```

### Metrics
- Request count by endpoint
- Response time percentiles
- Error rate by endpoint
- AI usage and costs

## 🔗 Related Documentation

- [Database Schema](../database/database-schema.md) - Entity relationships and design
- [Backend Architecture](../architecture/backend-architecture.md) - Implementation patterns
- [Coding Standards](../development/coding-standards.md) - Development guidelines
- [Testing Strategy](../development/testing.md) - TDD approach and coverage

## 🚀 Production API

### Deployment
- **API URL**: `https://api.mixologyhub.com`
- **Documentation**: `https://api.mixologyhub.com/api-docs`
- **Health Check**: `https://api.mixologyhub.com/health`

### Security
- JWT authentication (Phase 1+)
- Rate limiting per endpoint
- Input validation and sanitization
- LLM prompt injection protection

### Scaling
- Single-VM Vertical Scaling (utilizing Node.js cluster module across CPU cores)
- Database connection pooling
- Redis caching layer
- CDN for static assets