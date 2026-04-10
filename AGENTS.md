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
make test-e2e        # Backend E2E tests (Supertest)
```

## Key Architecture Notes
- **Backend**: NestJS with TypeORM, Redis caching, external API aggregation (TheCocktailDB)
- **Frontend**: Angular 18+ with Signals, Standalone Components, Zoneless Change Detection
- **Database**: PostgreSQL with automatic seeding (mock user: `mock@test.com`)
- **Unit Conversion**: Mathematical base-unit conversions in `UnitConverterService`
- **Online-Only Mandate**: Application requires persistent internet connection; all offline sync functionality has been removed

## Environment Configuration
- **Required**: `.env` file in root directory (copy from `.env.example`)
- **Critical variables**: `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` for LLM integration
- **Database/Redis**: Match docker-compose.yml defaults
- **Setup**: Run `cp .env.example .env` and edit with actual API keys

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

## 🧭 Documentation Routing (Read before acting)

Depending on the task assigned by the user, use your file reading tool (`read_file`) to consult the exact document:

- 🎨 **If you are going to create or modify UI/Components (Buttons, Cards, Forms):** Read `docs/design/component-library.md` and `docs/design/design-system.md`.
- 📱 **If you are going to create a new view or flow (e.g., the Inventory screen):** Read `docs/design/ui-ux-flows.md`.
- ♿ **If you are going to work on accessibility or semantic HTML:** Read `docs/design/accessibility-a11y.md`.
- ⚙️ **If you are going to create Backend logic (Services, Controllers):** Review `docs/architecture/backend-architecture.md` and the specific use case in `docs/product/use-cases/`.
- 🗄️ **If you are going to modify the database:** Read `docs/database/database-schema.md`.

_Strict rule:_ DO NOT assume the design. Always verify CSS variables and structure in the `/docs/design/` files before creating a component.

## Gotchas
1. **AI Integration**: Must configure `.env` with valid API credentials
2. **Database**: Uses port 5433 (not standard 5432) to avoid conflicts
3. **Hot-reload**: Requires `.env` host changes for hybrid development
4. **Angular**: No NgModules - all components are standalone
5. **State Management**: Use Signals, not BehaviorSubjects for simple state