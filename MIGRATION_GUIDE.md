# Database Migration Guide for Architectural Fixes

This guide explains how to apply the database schema changes for the architectural fixes implemented in MixologyHub.

## 📋 Migration Summary

The migration includes the following changes:

1. **Add `is_global` and `normalized_name` to ingredients table** - For multi-tenant ingredient naming
2. **Add `is_deleted` to cocktails table** - Soft delete support
3. **Update `cocktail_ingredients.amount` precision** - From `decimal(10,2)` to `decimal(10,4)` for fractional accuracy
4. **Create partial unique indexes for ingredients** - Prevent naming conflicts between users
 5. **Create `unified_idempotency` table** - For unified idempotency system
6. **Make `favorites.cocktail_id` nullable** - For polymorphic favorites

## 🚀 Migration Methods

### Method 1: Using TypeORM Migration (Recommended)

When the database is running:

```bash
cd backend
npx typeorm migration:run -d typeorm.config.ts
```

### Method 2: Manual SQL Execution

If TypeORM migration fails, run the SQL script manually:

```bash
# When PostgreSQL is running on port 5433 (Docker default)
psql -h localhost -p 5433 -U admin -d mixology_hub -f backend/migration-script.sql

# You'll be prompted for the password: secretpassword
```

### Method 3: Docker Compose Automatic

When starting the application with Docker Compose, TypeORM will synchronize most schema changes automatically (`synchronize: true` is enabled). However, you still need to run the migration for:

1. Partial unique indexes
2. Column precision changes
3. Table creation for unified_idempotency

## 🔧 Database Connection Details

**Docker Configuration:**
- Host: `localhost` (from host) or `postgres` (from within Docker)
- Port: `5433` (mapped from container port 5432)
- Database: `mixology_hub`
- Username: `admin`
- Password: `secretpassword`

**Environment Variables (in `.env` file):**
```
DB_HOST=postgres
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=secretpassword
DB_NAME=mixology_hub
```

## 📊 Verification Steps

After running the migration, verify the changes:

### 1. Check New Columns Exist
```sql
-- Check ingredients table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ingredients' 
AND column_name IN ('is_global', 'normalized_name');

-- Check cocktails table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cocktails' 
AND column_name = 'is_deleted';
```

### 2. Check Column Precision
```sql
-- Check cocktail_ingredients.amount precision
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns 
WHERE table_name = 'cocktail_ingredients' 
AND column_name = 'amount';
-- Should show: precision=10, scale=4
```

### 3. Check Indexes Created
```sql
-- Check partial unique indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ingredients' 
AND indexname LIKE 'idx_ingredients_%';
```

### 4. Check New Table
```sql
-- Check unified_idempotency table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'unified_idempotency';
```

## 🐛 Troubleshooting

### Issue: "Password authentication failed"
**Solution:** Ensure you're using the correct password (`secretpassword`) and the database is running.

### Issue: "Database does not exist"
**Solution:** The database needs to be created first:
```bash
# Connect to PostgreSQL and create database
psql -h localhost -p 5433 -U admin -d postgres -c "CREATE DATABASE mixology_hub;"
```

### Issue: "Connection refused"
**Solution:** Ensure PostgreSQL is running:
```bash
# Check if Docker container is running
docker compose ps

# If not running, start it
docker compose up -d postgres

# Wait for it to be healthy
docker compose logs --tail=10 postgres
```

### Issue: TypeORM migration fails
**Solution:** Use the manual SQL script:
```bash
# Copy the SQL script to a location psql can access
cp backend/migration-script.sql .

# Run it manually
psql -h localhost -p 5433 -U admin -d mixology_hub -f migration-script.sql
```

## 🔄 Rollback Procedure

If you need to rollback the migration:

### Using TypeORM:
```bash
cd backend
npx typeorm migration:revert -d typeorm.config.ts
```

### Manual Rollback SQL:
```sql
-- Drop indexes
DROP INDEX IF EXISTS idx_ingredients_global_unique;
DROP INDEX IF EXISTS idx_ingredients_custom_unique;
-- Note: sync_operations table was removed as part of Online-Only Mandate

-- Revert cocktail_ingredients.amount precision
ALTER TABLE cocktail_ingredients 
ALTER COLUMN amount TYPE decimal(10,2);

-- Remove columns
ALTER TABLE ingredients 
DROP COLUMN IF EXISTS is_global,
DROP COLUMN IF EXISTS normalized_name;

ALTER TABLE cocktails 
DROP COLUMN IF EXISTS is_deleted;

-- Revert favorites.cocktail_id to NOT NULL
ALTER TABLE favorites 
ALTER COLUMN cocktail_id SET NOT NULL;
```

## 📝 Migration Files

1. **TypeORM Migration:** `backend/src/migrations/1733702400000-fix-architectural-inconsistencies.ts`
2. **SQL Script:** `backend/migration-script.sql`
3. **TypeORM Config:** `backend/typeorm.config.ts`
4. **Migration Runner:** `backend/run-migration.js`

## ⏰ Timing Considerations

- **Migration duration:** ~1-2 seconds for empty database, ~5-10 seconds for populated database
- **Downtime required:** Minimal (ALTER TABLE operations are fast)
- **Best time to run:** During low-usage periods
- **Backup recommended:** Always backup database before migration

## ✅ Success Criteria

The migration is successful when:

1. All new columns exist with correct data types
2. Partial unique indexes are created
3. `unified_idempotency` table exists with correct constraints
4. `cocktail_ingredients.amount` has precision 10,4
5. Application starts without database errors
6. New features (soft delete, multi-tenant ingredients) work correctly

## 🆘 Getting Help

If migration issues persist:

1. Check Docker logs: `docker compose logs postgres`
2. Check application logs: `docker compose logs backend`
3. Verify database connection: `nc -z localhost 5433`
4. Check PostgreSQL is accepting connections: `pg_isready -h localhost -p 5433`

Contact the development team if you need assistance with the migration process.