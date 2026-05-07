-- Migration 0016: Local Image Processing via Sharp
-- Drops the old URL-based image column and adds local file path columns

-- Drop the old image_url column
ALTER TABLE "cocktails" DROP COLUMN "image_url";

-- Add new columns for local image paths
ALTER TABLE "cocktails" ADD COLUMN "image_full" VARCHAR(255) DEFAULT NULL;
ALTER TABLE "cocktails" ADD COLUMN "image_thumb" VARCHAR(255) DEFAULT NULL;

-- Create index for faster queries on image columns (optional)
CREATE INDEX "idx_cocktails_image_full" ON "cocktails" ("image_full") WHERE "image_full" IS NOT NULL;
CREATE INDEX "idx_cocktails_image_thumb" ON "cocktails" ("image_thumb") WHERE "image_thumb" IS NOT NULL;

-- Migration complete
COMMENT ON COLUMN "cocktails"."image_full" IS 'Path to full-size cocktail image (1024x1024 WebP format)';
COMMENT ON COLUMN "cocktails"."image_thumb" IS 'Path to thumbnail cocktail image (300x300 WebP format)';