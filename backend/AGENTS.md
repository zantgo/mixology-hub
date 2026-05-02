# MixologyHub Backend - Agent Instructions

## Architecture
- **NestJS** backend with **TypeORM**, **PostgreSQL**, **Redis** (cache + BullMQ queue)
- **B2B Single-Bar**: Shared `bar_inventory` table — all bartenders see the same stock
- **RBAC**: `admin` (Bar Manager) and `bartender` (staff) roles
- **Queue-Based Concurrency**: BullMQ `bar-orders` queue with `concurrency: 1` for serialized inventory mutations

## Key Commands
```bash
npm run build        # Build (NestJS)
npm run start:dev    # Development with hot-reload
npm run lint         # ESLint + Prettier
npm run format       # Prettier write
npm run test         # Jest unit tests
npm run test:cov     # Tests with coverage
```

## Architecture Notes
- **Inventory**: Admin-only mutations via `POST/PUT/DELETE /bar-inventory`. All users read via `GET /bar-inventory`.
- **Preparation**: `POST /cocktails/:id/prepare` enqueues to BullMQ → returns `202 Accepted`. Worker (`BarOrdersProcessor`) processes sequentially with `pessimistic_write` locks.
- **Status Polling**: `GET /cocktails/preparations/:logId/status` returns current job status.
- **Entities**: `BarInventory` (global, no user_id), `PreparationLog` (bartender_id + status enum), `User` (role default `'bartender'`).
- **Module Resolution**: `nodenext` — imports do NOT use `.js` extensions (works under NestJS/ts-jest).
- **Decimal Precision**: All arithmetic uses `decimal.js` methods (`.plus()`, `.minus()`, `.times()`, `.div()`). ESLint warns on native operators.

## Module Structure
```
src/
  inventory/     # BarInventory entity, service, controller
  queue/         # BullMQ module, BarOrdersProcessor worker
  cocktails/     # Cocktail CRUD, PreparationLog entity, prepare + status endpoints
  users/         # User entity (role=bartender), auth, GDPR
  auth/          # JWT strategy, AdminGuard, JwtAuthGuard
  ingredients/   # Ingredient catalog, hierarchical resolution
  ai/            # LLM integration
  utils/         # UnitConverterService, ColumnNumericTransformer
```

## Critical Dependencies
- `@nestjs/bullmq` + `bullmq` — Queue infrastructure
- Redis must be available (configured via `REDIS_HOST`, `REDIS_PORT` in `.env`)
- `docker-compose.yml` includes Redis with healthcheck
