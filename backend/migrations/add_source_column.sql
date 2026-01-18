-- Migration: Rename language column to source in leads table
-- Run this migration to update the database schema

-- First, add the source column if it doesn't exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(255);

-- Copy data from language to source (if language column exists)
UPDATE leads SET source = language WHERE language IS NOT NULL AND source IS NULL;

-- Drop the language column if it exists
ALTER TABLE leads DROP COLUMN IF EXISTS language;

-- Add a comment to the column
COMMENT ON COLUMN leads.source IS 'Source of the lead (e.g., Facebook, Google, Referral)';
