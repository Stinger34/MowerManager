-- Migration to add title field to attachments table
-- This should be run against the database to add the new title column

ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Add a comment to document the purpose of the new column
COMMENT ON COLUMN attachments.title IS 'User-provided title for the attachment, null if not provided';