-- Migration to add title field to attachments table
-- This should be run against the database to add the new title column

ALTER TABLE attachments 
ADD COLUMN title TEXT;

-- Add a comment to document the purpose of the new column
COMMENT ON COLUMN attachments.title IS 'User-provided title for the attachment, defaults to fileName if not provided';

-- Update existing records to use fileName as title if title is null
-- This ensures backward compatibility with existing attachments
UPDATE attachments 
SET title = file_name 
WHERE title IS NULL OR title = '';