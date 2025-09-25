# Automated Database Migration Checks and Fixes

This document describes the automated migration validation system implemented for MowerManager to ensure database migration hygiene and improve developer experience.

## Overview

The migration automation system provides comprehensive checks and automated fixes for common migration issues, helping developers catch and resolve problems before they impact deployment.

## Features

### 🔍 Migration File Validation
- **Gap Detection**: Identifies missing migration files in the sequence
- **Orphaned Files**: Detects migration files not tracked in the journal
- **Journal Integrity**: Validates migration journal format and consistency

### 🗃️ Database State Validation  
- **History Validation**: Compares migration journal against actual database state
- **Fresh Database Detection**: Handles new installations gracefully
- **Mismatch Detection**: Identifies inconsistencies between applied migrations and journal

### 🔧 Automated Recovery
- **Missing File Recovery**: Attempts to restore missing files from backups
- **Catch-up Migrations**: Generates new migrations to synchronize schema
- **Fallback Strategies**: Uses `db:push` when regular migrations fail

### 🛡️ Enhanced Error Handling
- **Clear Messaging**: Provides detailed error descriptions and solutions
- **Manual Intervention Guidance**: Step-by-step troubleshooting when automation fails
- **Non-blocking Warnings**: Distinguishes between critical errors and minor issues

## Usage

### Command Line Scripts

#### Standalone Validation (No Database Required)
```bash
# Basic validation
./validate-migrations.sh

# Strict mode (treat warnings as errors)
./validate-migrations.sh --strict

# Verbose output
./validate-migrations.sh --verbose

# Attempt automatic fixes
./validate-migrations.sh --fix
```

#### NPM Scripts
```bash
# Basic migration validation
npm run db:validate

# Strict validation for CI/CD
npm run db:validate:strict
```

#### Enhanced Deployment with Validation
```bash
# Full deployment with migration checks
./deploy.sh --dry-run --verbose

# Production deployment with automation
./deploy.sh --auto-confirm
```

### Integration with CI/CD

Add migration validation to your CI pipeline:

```yaml
# GitHub Actions example
- name: Validate Database Migrations
  run: npm run db:validate:strict

# For environments with database access
- name: Full Migration Check
  run: ./deploy.sh --dry-run --auto-confirm --skip-git-pull
```

## Validation Checks

### 1. Migration File Structure
- ✅ Migration directory exists
- ✅ Migration journal is present and valid JSON
- ✅ Schema file exists and is readable
- ✅ Drizzle config is properly configured
- ✅ Required npm scripts are defined

### 2. Migration Journal Integrity
- ✅ Valid JSON format
- ✅ Required fields present (version, dialect, entries)
- ✅ Entry format validation (tag, breakpoints)

### 3. File-Journal Consistency
- ✅ All journal entries have corresponding SQL files
- ✅ No orphaned migration files
- ✅ Proper file naming conventions

### 4. Schema Validation
- ✅ TypeScript syntax checking (when available)
- ✅ Drizzle ORM import patterns
- ✅ Table definition presence

### 5. Database State Validation (with database access)
- ✅ Migration table existence
- ✅ Applied migrations match journal entries
- ✅ No missing applied migrations
- ✅ Fresh database detection

## Error Scenarios and Handling

### Missing Migration Files
**Detection**: Journal entry exists but corresponding `.sql` file is missing
**Automated Fix**: 
1. Attempt restoration from `migrations-old` backup
2. Generate catch-up migration if restoration fails
3. Provide manual recovery guidance

### Orphaned Migration Files  
**Detection**: Migration file exists but not tracked in journal
**Automated Fix**:
1. Move to `migrations-old` directory (with `--fix` flag)
2. Log warning but continue deployment
3. In strict mode, treat as error

### Migration History Mismatch
**Detection**: Database state doesn't match journal entries
**Automated Fix**:
1. Log detailed mismatch information
2. Continue with fallback strategy (`db:push`)
3. Provide manual intervention steps

### Database Connectivity Issues
**Detection**: Cannot connect to validate history
**Automated Fix**:
1. Skip database-dependent validations
2. Continue with file-based validation only
3. Provide clear connectivity troubleshooting steps

## Best Practices

### For Developers
1. **Run validation before commits**:
   ```bash
   npm run db:validate
   ```

2. **Use strict mode in CI/CD**:
   ```bash
   npm run db:validate:strict
   ```

3. **Test deployment locally**:
   ```bash
   ./deploy.sh --dry-run --verbose
   ```

### For CI/CD Pipelines
1. **Add validation step** before building
2. **Use strict mode** to catch all issues
3. **Include database connectivity tests** when possible
4. **Store logs** for troubleshooting

### For Production Deployments
1. **Always run dry-run first** in staging
2. **Use automated confirmation** for consistent deployments
3. **Monitor logs** for migration warnings
4. **Have rollback plan** ready

## Troubleshooting

### Common Issues

#### "Migration file validation failed"
- Check for missing `.sql` files in `migrations/` directory
- Verify `migrations/meta/_journal.json` is valid JSON
- Run with `--verbose` for detailed information

#### "Migration history validation found inconsistencies"  
- Check DATABASE_URL connectivity
- Verify database permissions
- Review applied migrations in `__drizzle_migrations` table

#### "Schema file has TypeScript syntax issues"
- Run `npm run check` to identify TypeScript errors
- Fix syntax issues in `shared/schema.ts`
- Use `--strict` mode to treat as errors

### Manual Recovery Steps

If automation fails completely:

1. **Check database connectivity**:
   ```bash
   # Verify DATABASE_URL is set and accessible
   echo $DATABASE_URL
   ```

2. **Manually sync schema**:
   ```bash
   npm run db:push
   ```

3. **Regenerate migrations**:
   ```bash
   npm run db:generate && npm run db:migrate
   ```

4. **Reset migration state** (last resort):
   ```bash
   # Backup first!
   # Then manually reset __drizzle_migrations table
   ```

## Configuration

### Environment Variables
- `DATABASE_URL`: Required for database state validation
- `NODE_ENV`: Affects logging verbosity

### Script Options
- `--strict`: Treat warnings as errors
- `--verbose`: Enable detailed logging  
- `--fix`: Attempt automatic fixes
- `--dry-run`: Simulate without making changes

### Customization
Modify validation rules in `validate-migrations.sh` for project-specific requirements.

## Integration Examples

### GitHub Actions
```yaml
name: Validate Migrations
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run db:validate:strict
```

### Pre-commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit
npm run db:validate || exit 1
```

### Docker Build
```dockerfile
# Add to Dockerfile
COPY validate-migrations.sh ./
RUN chmod +x validate-migrations.sh && ./validate-migrations.sh --strict
```

## Benefits

1. **Early Problem Detection**: Catch migration issues before deployment
2. **Improved Developer Experience**: Clear error messages and automated fixes  
3. **Safer Deployments**: Multiple validation layers and fallback strategies
4. **CI/CD Integration**: Standalone validation without database dependencies
5. **Comprehensive Logging**: Detailed information for troubleshooting
6. **Flexible Configuration**: Strict/normal modes for different environments