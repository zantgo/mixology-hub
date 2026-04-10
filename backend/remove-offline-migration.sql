-- Database Migration: Remove Offline Sync Functionality
-- Run this script in your PostgreSQL database as part of the Online-Only Mandate

-- 1. Drop sync_operations table (offline sync queue)
DROP TABLE IF EXISTS sync_operations;

-- 2. Remove enable_offline_mode column from user_profiles table
ALTER TABLE user_profiles 
DROP COLUMN IF EXISTS enable_offline_mode;

-- 3. Remove any foreign key constraints referencing sync_operations
-- (Note: sync_operations had no foreign keys pointing to it, only from it)

-- 4. Update unified_idempotency table to remove sync-specific data
-- Delete any idempotency records with 'sync:' prefix (offline operations)
DELETE FROM unified_idempotency 
WHERE key LIKE 'sync:%';

-- 5. Optional: Clean up any orphaned data
-- This would remove any data that might have been related to offline sync
-- but is no longer needed. Since sync_operations was the main table,
-- this is likely not necessary.

-- 6. Add comment about the migration
COMMENT ON DATABASE mixology_hub IS 'Updated with Online-Only Mandate: Offline sync functionality removed';

-- Migration completed successfully