-- Migration: Update leads_status_check constraint to include all frontend status values
-- This fixes the issue where updates fail with status constraint violation

-- Drop the existing constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Add the updated constraint with all status values from the frontend
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
CHECK (status = ANY (ARRAY[
  'New'::text,
  'Busy'::text,
  'Call Back With Presentation'::text,
  'Call Back Without Presentation'::text,
  'Call Disconnected'::text,
  'Counselling Call'::text,
  'Disconnected Call'::text,
  'Do Not disturb'::text,
  'Equity trader'::text,
  'Follow Up'::text,
  'Follow Up-No Response'::text,
  'Follow Up (No Response)'::text,
  'Free Trial'::text,
  'Free Trial – Follow Up'::text,
  'Incoming Calls Not Allowed'::text,
  'Invalid Number'::text,
  'Language Barrier'::text,
  'Less Funds'::text,
  'Loss Client'::text,
  'Low Capital'::text,
  'No Capital'::text,
  'No DMAT'::text,
  'No Response'::text,
  'Non Trader'::text,
  'Not Connected'::text,
  'Not Interested'::text,
  'Not Reachable'::text,
  'Out Of Service'::text,
  'Paid Client'::text,
  'Promise To Pay'::text,
  'Ringing'::text,
  'Summarization Call'::text,
  'Switched Off'::text,
  'Wrong No'::text,
  'Won'::text
]));

-- Add a comment
COMMENT ON CONSTRAINT leads_status_check ON leads IS 'Status values allowed for leads - updated to match frontend options';
