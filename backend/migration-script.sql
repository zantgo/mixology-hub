
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

-- 5. sync_operations table removed as part of Online-Only Mandate
-- Offline sync functionality is no longer supported

-- 6. Make favorites.cocktail_id nullable for polymorphic favorites
ALTER TABLE favorites 
ALTER COLUMN cocktail_id DROP NOT NULL;

-- 7. Add comment about the migration
COMMENT ON DATABASE mixology_hub IS 'Updated with architectural fixes migration';
