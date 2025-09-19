-- Add component_id and part_id columns to attachments table
-- Also make mower_id nullable since attachments can now belong to components or parts directly

-- First, make mower_id nullable
ALTER TABLE "attachments" ALTER COLUMN "mower_id" DROP NOT NULL;

-- Add component_id column with foreign key constraint
ALTER TABLE "attachments" ADD COLUMN "component_id" integer;

-- Add part_id column with foreign key constraint  
ALTER TABLE "attachments" ADD COLUMN "part_id" integer;

-- Add page_count column (this was missing from original schema)
ALTER TABLE "attachments" ADD COLUMN "page_count" integer;

-- Add foreign key constraints
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE cascade;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE cascade;

-- Add a check constraint to ensure exactly one of mower_id, component_id, or part_id is not null
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_single_parent_check" 
  CHECK (
    (mower_id IS NOT NULL AND component_id IS NULL AND part_id IS NULL) OR
    (mower_id IS NULL AND component_id IS NOT NULL AND part_id IS NULL) OR
    (mower_id IS NULL AND component_id IS NULL AND part_id IS NOT NULL)
  );