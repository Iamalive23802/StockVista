-- Migration: Add unique constraint on phone number column
-- This migration handles existing duplicates and adds a unique constraint

-- Step 1: Handle existing duplicate phone numbers
-- Keep the oldest lead (by date, then by id) for each phone number
-- Set phone to NULL for duplicate entries to preserve data

DO $$
DECLARE
    dup_record RECORD;
    keep_id UUID;
BEGIN
    -- Find all duplicate phone numbers
    FOR dup_record IN 
        SELECT phone, COUNT(*) as count
        FROM leads
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY phone
        HAVING COUNT(*) > 1
    LOOP
        -- Find the ID of the lead to keep (oldest by date, then by id)
        SELECT id INTO keep_id
        FROM leads
        WHERE phone = dup_record.phone
        ORDER BY date ASC NULLS LAST, id ASC
        LIMIT 1;
        
        -- Set phone to NULL for all other leads with this phone number
        UPDATE leads
        SET phone = NULL
        WHERE phone = dup_record.phone
        AND id != keep_id;
        
        RAISE NOTICE 'Handled duplicates for phone %: kept lead %, set % duplicates to NULL', 
            dup_record.phone, keep_id, dup_record.count - 1;
    END LOOP;
END $$;

-- Step 2: Add unique constraint on phone column
-- This allows NULL values (multiple NULLs are allowed in unique constraints)
ALTER TABLE leads 
ADD CONSTRAINT leads_phone_unique UNIQUE (phone);

-- Add a comment
COMMENT ON CONSTRAINT leads_phone_unique ON leads IS 'Ensures phone numbers are unique across all leads (NULL values are allowed)';
