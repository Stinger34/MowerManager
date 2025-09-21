# Legacy Migration Files

This folder contains legacy migration files and metadata that were moved from the previous migrations folder.

## Contents

- **SQL Files**: Legacy database migration files
  - `0000_smart_millenium_guard.sql`
  - `add-component-part-attachments.sql`
  - `add-title-to-attachments.sql`

- **Meta Folder**: Migration metadata from the previous system
  - Contains snapshot and journal files from legacy migrations

## Important Note

**Future migrations will be managed via Drizzle ORM and the `schema.ts` file.**

The main `migrations` directory is now reserved for Drizzle-generated migration files. This legacy content has been preserved for historical reference but should not be used for new database changes.

For database schema changes, modify `/shared/schema.ts` and use the following Drizzle commands:
- `npm run db:generate` - Generate new migration files
- `npm run db:push` - Push schema changes directly to database
- `npm run db:migrate` - Apply generated migrations