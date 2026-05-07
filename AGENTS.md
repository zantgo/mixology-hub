# MixologyHub - Agent Instructions

## Project Structure
- **Monorepo layout**: `src/backend/` (NestJS), `src/frontend/` (Angular 21), `docs/`
- **Containerized**: Full Docker Compose stack (PostgreSQL 15, Redis 7, Backend, Frontend)
- **AI Integration**: Provider-agnostic LLM via environment variables (DeepSeek/OpenAI/Anthropic)

## Development Commands
### Full Stack (Docker)
```bash
make start             # Start all services (frontend:8080, backend:3000, Swagger:3000/api-docs)
make stop              # Stop services
make clean             # Stop + remove volumes (hard reset)
make rebuild           # Rebuild and restart
make logs              # Follow logs
```

### First-Time Setup
```bash
cp .env.example .env   # Then edit with actual API keys
make setup             # Install dependencies in both packages
```

### Hybrid Development (Hot-reload)
```bash
# 1. Start infrastructure only
docker compose up -d postgres redis

# 2. Backend (update .env: DB_HOST=localhost, REDIS_HOST=localhost)
cd src/backend && npm run start:dev  # Port 3000

# 3. Frontend
cd src/frontend && npm start         # Port 4200
```

### Per-Package Commands
```bash
# Backend
cd src/backend && npm run build      # NestJS build
cd src/backend && npm run lint       # ESLint + Prettier (flat config)
cd src/backend && npm run format     # Prettier write

# Frontend (has lint/format scripts)
cd src/frontend && npm run build     # ng build (production)
cd src/frontend && npm start         # ng serve
cd src/frontend && npm run format    # Prettier write
cd src/frontend && npm run lint      # Prettier check
```

### Testing
```bash
make test            # Backend unit (10 suites, 174 tests) + Frontend unit (7 files, 21 tests)
make test-backend    # Backend Jest unit tests only
make test-frontend   # Frontend Vitest via Angular unit-test builder
make test-e2e        # Backend E2E tests (Supertest, 8 scenarios)

# Backend coverage
cd src/backend && npm run test:cov
```

**Recommended verification order**: `lint → build → test` for both packages

## Key Architecture Notes
- **Backend**: NestJS with TypeORM, Redis caching, external API aggregation (TheCocktailDB)
- **Frontend**: Angular 21 with Signals, Standalone Components, Zoneless Change Detection, SCSS styles
- **Database**: PostgreSQL with `synchronize: true` — **schema auto-syncs from entities on boot** (2 migrations exist: architectural fixes + pg_trgm extension)
- **Health Check**: `GET /health` returns `{ status, checks: { db, redis } }`
- **Unit Conversion**: Mathematical base-unit conversions in `UnitConverterService` (13 units, mass↔volume via density)
- **Online-Only Mandate**: No offline sync — application requires persistent internet connection
- **Multi-Session Auth**: Up to 5 concurrent refresh token sessions per user (stored in `refresh_tokens` table)
- **Preparation Queue**: BullMQ `bar-orders` queue with `concurrency: 1` for serialized inventory mutations

## Environment Configuration
- **Required**: `.env` file in root directory (copy from `.env.example`)
- **Critical variables**: `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` for LLM integration
- **Database/Redis**: Match docker-compose.yml defaults
- **Setup**: Run `cp .env.example .env` and edit with actual API keys

## Code Standards
- **Backend**: Strict TypeScript, class-validator DTOs, Dependency Injection
  - `module: nodenext` / `moduleResolution: nodenext` — imports do NOT use `.js` extensions despite what the config suggests; this works under NestJS/ts-jest but may break under raw `tsc`
- **Frontend**: Signals for state, Standalone components only, no NgModules, SCSS for styles
- **Git**: Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)
- **Linting**: ESLint (flat config v9+) + Prettier in backend only. Frontend has `.prettierrc` but no lint/format npm scripts

## Backend-Specific Lint Rules
- **`decimal.js` arithmetic**: All `+`, `-`, `*`, `/` binary operators trigger a **warning** — use `decimal.js` methods (`.plus()`, `.minus()`, `.times()`, `.div()`) for inventory/math code to avoid IEEE 754 floating-point errors

## Port Mapping
| Service    | Docker | Dev   |
|------------|--------|-------|
| Frontend   | 8080   | 4200  |
| Backend    | 3000   | 3000  |
| PostgreSQL | 5433→5432 | 5433 |
| Redis      | 6379   | 6379  |

## Documentation Routing (Read before acting)

Depending on the task assigned by the user, consult the exact document:

- **UI/Components (Buttons, Cards, Forms):** Read `docs/design/component-library.md` and `docs/design/design-system.md`.
- **New view or flow (e.g., Inventory screen):** Read `docs/design/ui-ux-flows.md`.
- **Accessibility or semantic HTML:** Read `docs/design/accessibility-a11y.md`.
- **Backend logic (Services, Controllers):** Review `docs/architecture/backend-architecture.md` and the specific use case in `docs/product/use-cases/`.
- **Database changes:** Read `docs/database/database-schema.md`.

_Strict rule:_ DO NOT assume the design. Always verify CSS variables and structure in the `/docs/design/` files before creating a component.

## Gotchas
1. **AI Integration**: Must configure `.env` with valid API credentials or AI features will fail
2. **Database**: Uses port 5433 (not standard 5432) to avoid host conflicts. `synchronize: true` means changing `@Entity()` classes auto-modifies the DB schema on restart
3. **Hybrid dev**: Requires `.env` host changes (`DB_HOST=localhost`, `REDIS_HOST=localhost`)
4. **Angular**: No NgModules — all components are standalone. Use Signals over BehaviorSubjects
5. **State Management**: Use Signals for simple state, RxJS for async streams
6. **Backend imports**: `nodenext` module resolution is set but imports do NOT use `.js` extensions — this works under NestJS/ts-jest but raw `tsc` may fail
7. **Arithmetic**: The custom ESLint rule warns on native operators (see Backend-Specific Lint Rules above)
8. **Frontend lint**: Frontend has `lint` and `format` npm scripts using Prettier. No ESLint configured for frontend
9. **Test framework**: Frontend tests use Vitest via `@angular/build:unit-test` — the test script is `ng test`, NOT `vitest` directly
10. **Zoneless testing**: Frontend cannot use `fakeAsync`/`tick` — use async/await with Promise-based patterns instead
