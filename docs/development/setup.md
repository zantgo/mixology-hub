# Local Development Setup

  

This guide provides step-by-step instructions for setting up the MixologyHub development environment. The project heavily relies on containerization to ensure parity between development, testing, and production environments, eliminating the "it works on my machine" problem.

  

## 🛠 Prerequisites

  

Before you begin, ensure you have the following installed on your host machine:

  

- **[Docker](https://www.docker.com/products/docker-desktop)** & **Docker Compose** (v2+)

- **[Make](https://www.gnu.org/software/make/)** (Recommended for utilizing the included `Makefile` commands)

- **[Node.js](https://nodejs.org/en/)** (v22+) & **npm** (v11+) *(Only required if you plan to run the Node.js services directly on your host machine for active debugging).*

  

---

  

## ⚙️ Environment Configuration

  

MixologyHub relies on environment variables for database connections, caching, and external integrations.

  

A core architectural feature is the **Provider-Agnostic LLM Integration**. You can plug in any LLM provider (DeepSeek, OpenAI, Anthropic, etc.) by adjusting the environment variables, meaning the system is not hard-coupled to a single AI vendor.

  

Copy the example environment file to create your local configuration:

```bash
cp .env.example .env
```

Then edit `.env` to add your actual API keys (this file is ignored by git). The `.env.example` file contains all required variables including:

```ini
# --- Database Configuration (Matches docker-compose.yml) ---
DB_HOST=postgres
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=secretpassword
DB_NAME=mixology_hub

# --- Redis Configuration ---
REDIS_HOST=redis
REDIS_PORT=6379

# --- AI Provider Configuration (Plug-and-Play) ---
# Example using DeepSeek (Compatible with OpenAI SDKs/Formats)
AI_API_URL=https://api.deepseek.com/v1/chat/completions
AI_API_KEY=your_deepseek_api_key_here
AI_MODEL=deepseek-chat

# Alternative configurations for OpenAI and Anthropic are also provided
```

*(Note: Never commit your actual API keys. The `.env` file should remain local and untracked by git).*

  

---

  

## 🚀 Running the Full Stack (Dockerized)

  

The easiest way to run the entire application—Database, Cache, Backend, and Frontend—is using the provided `Makefile`. This spins up the exact architecture mapped out in `docker-compose.yml`.

  

1. **Start the environment in the background:**

```bash

make start

```

  

2. **Verify services and view logs:**

```bash

make logs

```

*Wait until you see the NestJS backend output `Application is running on: http://[::1]:3000`.*

  

3. **Access the application:**

- **Frontend UI:** [http://localhost:8080](http://localhost:8080)

- **Backend API:** [http://localhost:3000](http://localhost:3000)

- **Swagger OpenAPI Docs:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

  

4. **Stop the environment gracefully:**

```bash

make stop

```

  

5. **Clean volumes & database (Hard Reset):**

```bash

make clean

```

  

---

  

## 💻 Hybrid Development Mode (Hot-Reloading)

  

If you are actively developing code, running the Node.js services inside Docker can sometimes slow down hot-reloading. The recommended workflow for active development is a **Hybrid Mode**: run the infrastructure (Postgres/Redis) in Docker, and the applications locally.

  

### 1. Start Infrastructure Only

```bash

docker compose up -d postgres redis

```

  

### 2. Start the Backend (NestJS)

*Important: Change `DB_HOST` to `localhost` and `DB_PORT` to `5433` in your `.env` so NestJS can reach the Dockerized PostgreSQL from your host machine. Also change `REDIS_HOST` to `localhost`.*

```bash

cd backend

npm install

npm run start:dev

```

*The backend will run on port 3000 with file-watching enabled.*

  

### 3. Start the Frontend (Angular)

```bash

cd frontend

npm install

npm start

```

*The frontend will be available at `http://localhost:4200` with Webpack HMR (Hot Module Replacement).*

**Important:** Because local .webp assets are served statically by the NestJS backend (Port 3000), the Angular development server (`proxy.conf.json`) is configured to proxy all `/uploads/*` requests directly to the backend. This ensures images load correctly during local development without requiring absolute URLs in the database.

  

---

  

## 🧪 Running Tests

  

The repository includes test suites for both the frontend (Vitest) and backend (Jest). You can trigger them using the root Makefile:

  

```bash

# Run all tests sequentially

make test

  

# Run backend unit & e2e tests

make test-backend

  

# Run frontend Vitest suite

make test-frontend

```

  

---

  

## 📝 Database Seeding & Authentication Bypass

  

To streamline local development and testing, MixologyHub includes an automated `SeederService` (`backend/src/database/seeder.service.ts`).

  

**How it works:**

Upon the first initialization of the NestJS module, the seeder automatically checks for and creates a mock user (`mock@test.com`).

  

**Why this matters:**

This ensures that core database relations—such as Foreign Key constraints for `Cocktails`, `Favorites`, and `UserInventory`—function immediately out of the box without requiring the developer to manually register a user or set up a JWT flow for every local test run.

---

## 🗄️ Database Migrations with TypeORM

MixologyHub uses TypeORM migrations to manage database schema changes. All migrations are stored in `backend/src/database/migrations/`.

### Generating a New Migration

When you modify entity classes (add/remove columns, change types, etc.), generate a migration:

```bash
cd backend

# 1. Ensure the database is running
docker compose up -d postgres

# 2. Generate migration (auto-detects schema changes)
npm run typeorm migration:generate -- src/database/migrations/YourMigrationName

# Example:
npm run typeorm migration:generate -- src/database/migrations/AddCocktailRatingColumn
```

### Running Migrations

Migrations run automatically when the backend starts. For manual execution:

```bash
# Run pending migrations
npm run typeorm migration:run

# Revert last migration
npm run typeorm migration:revert

# Show migration status
npm run typeorm migration:show
```

### Migration Best Practices

1. **Always generate migrations from entity changes** - Never write raw SQL migrations manually
2. **Test migrations locally** before committing
3. **Include both `up` and `down` methods** for rollback capability
4. **Use the Docker environment** - Ensure `DB_HOST=postgres` and `DB_PORT=5432` in your `.env`

### Example Migration File

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCocktailRatingColumn1712345678901 implements MigrationInterface {
  name = 'AddCocktailRatingColumn1712345678901';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cocktails" ADD COLUMN "rating" decimal(3,2) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cocktails" DROP COLUMN "rating"`,
    );
  }
}
```

### Troubleshooting

- **"No changes in database schema were found"**: Ensure your entity changes are saved and TypeORM can connect to the database
- **Connection errors**: Verify Docker PostgreSQL is running and `.env` has correct credentials
- **Migration conflicts**: If multiple developers create migrations, coordinate to avoid timestamp collisions