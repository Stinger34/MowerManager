# Database Migrations

This directory contains database migration files managed by Drizzle ORM.

## Fresh Start Setup

### Clean Migration State

The migration system has been reset to a clean state, ready for fresh installations and new builds. The migration journal is empty and ready to track future schema changes.

### Database Schema

The current database schema is defined in `/shared/schema.ts` and includes these core tables:

- **mowers** - Equipment inventory and basic information
- **service_records** - Maintenance and repair history  
- **attachments** - File attachments linked to mowers, components, or parts
- **tasks** - Work items and maintenance tasks
- **components** - Equipment components and sub-assemblies
- **parts** - Parts inventory and catalog
- **asset_parts** - Junction table linking parts to assets (mowers/components)
- **notifications** - System notifications and alerts

### Migration Journal

The migration system uses a journal file (`_journal.json`) to track which migrations have been applied. The journal starts empty for fresh installations.

### Managing Database Changes

All database schema changes should be managed through Drizzle ORM:

1. **Modify the schema**: Update `/shared/schema.ts` with your changes
2. **Generate migration**: Run `npm run db:generate` to create migration files
3. **Apply migration**: Run `npm run db:migrate` to apply changes to the database

### Fresh Installations

For new team members or fresh database installations:

1. The schema will be created from `/shared/schema.ts` via Drizzle ORM
2. Future migrations will build incrementally on the generated schema
3. This ensures reproducible database state across all environments

### Legacy Migrations

Previous migration files have been moved to `/migrations-old/` for historical reference. The current migration system starts with a clean slate for better maintainability.