# MixologyHub - Agent Instructions

## Project Structure
- **Monorepo layout**: `backend/` (NestJS), `frontend/` (Angular), `docs/`
- **Containerized**: Full Docker Compose stack (PostgreSQL, Redis, Backend, Frontend)
- **AI Integration**: Provider-agnostic LLM via environment variables (DeepSeek/OpenAI/Anthropic)

## Development Commands
### Full Stack (Docker)
```bash
make start          # Start all services (frontend:8080, backend:3000, Swagger:3000/api-docs)
make stop           # Stop services
make clean          # Stop + remove volumes (hard reset)
make rebuild        # Rebuild and restart
make logs           # Follow logs
```

### Hybrid Development (Hot-reload)
```bash
# 1. Start infrastructure only
docker compose up -d postgres redis

# 2. Backend (update .env: DB_HOST=localhost, REDIS_HOST=localhost)
cd backend && npm run start:dev  # Port 3000

# 3. Frontend
cd frontend && npm start         # Port 4200
```

### Testing
```bash
make test            # Run all tests
make test-backend    # Backend Jest tests
make test-frontend   # Frontend Vitest tests
```

## Key Architecture Notes
- **Backend**: NestJS with TypeORM, Redis caching, external API aggregation (TheCocktailDB)
- **Frontend**: Angular 18+ with Signals, Standalone Components, Zoneless Change Detection
- **Database**: PostgreSQL with automatic seeding (mock user: `mock@test.com`)
- **Unit Conversion**: Mathematical base-unit conversions in `UnitConverterService`

## Environment Configuration
- **Required**: `.env` file in `backend/` directory
- **Critical variables**: `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` for LLM integration
- **Database/Redis**: Match docker-compose.yml defaults

## Code Standards
- **Backend**: Strict TypeScript, class-validator DTOs, Dependency Injection
- **Frontend**: Signals for state, Standalone components only, no NgModules
- **Git**: Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)
- **Linting**: ESLint + Prettier configured in both projects

## Testing Strategy
- **Backend**: Jest unit tests (mock repositories) + E2E tests (supertest)
- **Frontend**: Vitest for component testing
- **Database**: Seeder creates mock user for FK constraints

## Port Mapping
- Frontend: 8080 (Docker) / 4200 (dev)
- Backend: 3000
- PostgreSQL: 5433 → 5432
- Redis: 6379

## Gotchas
1. **AI Integration**: Must configure `.env` with valid API credentials
2. **Database**: Uses port 5433 (not standard 5432) to avoid conflicts
3. **Hot-reload**: Requires `.env` host changes for hybrid development
4. **Angular**: No NgModules - all components are standalone
5. **State Management**: Use Signals, not BehaviorSubjects for simple state