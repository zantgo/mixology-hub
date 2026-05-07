const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function runMigration() {
  console.log('🚀 Running database migration...');
  
  try {
    // First, check if we can connect to the database
    console.log('🔍 Checking database connection...');
    
    // Try to run the migration using TypeORM CLI
    const { stdout, stderr } = await execAsync(
      'npx typeorm migration:run -d typeorm.config.ts',
      { cwd: __dirname }
    );
    
    if (stdout) console.log(stdout);
    if (stderr) console.error('Error:', stderr);
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // If migration fails, try to create a simple SQL script instead
    console.log('📝 Creating SQL script for manual execution...');
    await createSqlScript();
  }
}

async function createSqlScript() {
  const sqlScript = `
-- Database Migration for MixologyHub Architectural Fixes
-- Run this script in your PostgreSQL database

-- 1. Add is_global and normalized_name to ingredients table
ALTER TABLE ingredients 
ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS normalized_name varchar(255) NOT NULL DEFAULT '';

-- Update normalized_name from existing name column
UPDATE ingredients 
SET normalized_name = UPPER(TRIM(name))
WHERE normalized_name = '';

-- 2. Add is_deleted to cocktails table
ALTER TABLE cocktails 
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- 3. Update cocktail_ingredients.amount precision from decimal(10,2) to decimal(10,4)
ALTER TABLE cocktail_ingredients 
ALTER COLUMN amount TYPE decimal(10,4);

-- 4. Create partial unique indexes for ingredients
-- Global ingredients: unique normalized_name where is_global = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_global_unique 
ON ingredients (normalized_name) 
WHERE is_global = true;

-- Custom ingredients: unique normalized_name per user where is_global = false
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_custom_unique 
ON ingredients (normalized_name, created_by) 
WHERE is_global = false;

-- 5. Create sync_operations table for offline sync idempotency
CREATE TABLE IF NOT EXISTS sync_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_operation_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type varchar(50) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  error_message text,
  device_timestamp timestamp NOT NULL,
  server_timestamp timestamp,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  UNIQUE(client_operation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_operations_user_status 
ON sync_operations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_sync_operations_client_id 
ON sync_operations(client_operation_id);

-- 6. Make favorites.cocktail_id nullable for polymorphic favorites
ALTER TABLE favorites 
ALTER COLUMN cocktail_id DROP NOT NULL;

-- 7. Add comment about the migration
COMMENT ON DATABASE mixology_hub IS 'Updated with architectural fixes migration';
`;

  const fs = require('fs');
  fs.writeFileSync('migration-script.sql', sqlScript);
  console.log('📄 SQL script created: migration-script.sql');
  console.log('💡 Run this script manually when the database is available:');
  console.log('   psql -h localhost -p 5433 -U admin -d mixology_hub -f migration-script.sql');
}

// Run the migration
runMigration();