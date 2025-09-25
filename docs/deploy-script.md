# Enhanced Deploy Script Documentation

The `deploy.sh` script has been significantly enhanced to provide a robust, safe, and feature-rich deployment process for the MowerManager application.

## Features

### 1. Dry-Run Capability
- **Option**: `--dry-run`
- Simulates the entire deployment process without making any actual changes
- Shows exactly what commands would be executed
- Prompts user for confirmation before and after dry-run
- Perfect for testing deployment changes safely

### 2. Schema-Aware Migrations
- Automatically detects schema changes by analyzing migration files
- Identifies:
  - New tables (`CREATE TABLE` statements)
  - New columns (`ALTER TABLE ... ADD COLUMN` statements)
  - Column modifications (`ALTER TABLE ... ALTER COLUMN` statements)
- Executes specific actions based on detected changes:
  - Suggests seeding data for new tables
  - Offers to populate new columns with default values
  - Validates data integrity after schema changes

### 3. Dynamic User Prompts
- Interactive confirmation at key deployment stages
- 30-second timeout for automated environments
- Can be bypassed with `--auto-confirm` for fully automated deployments

### 4. Enhanced Error Handling
- Specific exit codes for different types of failures:
  - `1`: General error
  - `2`: Git pull failure
  - `3`: Dependency installation failure
  - `4`: Build failure
  - `5`: Migration/database failure
  - `6`: Service restart failure
  - `7`: User abort
- Graceful cleanup of temporary files
- Signal handling for user interruption (Ctrl+C)

### 5. Comprehensive Logging
- Detailed logs written to `deploy.log`
- Color-coded console output for better readability
- Progress indicators showing completion percentage
- Verbose mode available with `--verbose` flag

## Usage

### Basic Deployment
```bash
./deploy.sh
```

### Dry Run (Recommended for testing)
```bash
./deploy.sh --dry-run
```

### Automated Deployment (CI/CD)
```bash
./deploy.sh --auto-confirm --verbose
```

### Skip Git Pull (for local testing)
```bash
./deploy.sh --skip-git-pull --dry-run
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Simulate deployment without making changes |
| `--auto-confirm` | Skip confirmation prompts (for automation) |
| `--verbose` | Enable detailed logging output |
| `--skip-git-pull` | Skip the git pull step |
| `--help` | Show comprehensive help message |

## Migration Workflow

The enhanced script uses a comprehensive migration workflow with automated validation:

1. **Automated Migration Validation**: Validates migration files and detects issues
   - Checks for missing migration files and gaps in sequence  
   - Validates migration journal against database state
   - Detects orphaned migration files not tracked in journal
   - Attempts automatic recovery of missing files from backups

2. **Generate Migration**: Uses `drizzle-kit generate` to create migration files based on schema changes

3. **Migration Analysis**: Parses migration files to detect specific schema modifications

4. **User Confirmation**: Prompts for confirmation before applying database changes

5. **Apply Migration**: Uses `drizzle-kit migrate` to apply changes to the database with error handling

6. **Post-Migration Validation**: Verifies migration was applied correctly

7. **Schema Actions**: Executes conditional actions based on detected changes

8. **Fallback Strategies**: Falls back to `drizzle-kit push` if migration fails, with comprehensive error guidance

### Automated Migration Checks

The deployment script now includes comprehensive migration validation:

```bash
# Run migration validation only (no database required)
npm run db:validate

# Strict validation for CI/CD (treats warnings as errors)  
npm run db:validate:strict

# Full deployment with automated migration checks
./deploy.sh --dry-run --verbose
```

For detailed information about the migration automation system, see [Migration Automation Documentation](migration-automation.md).

## Schema Detection Examples

The script can detect and respond to various schema changes:

```sql
-- New Table Detection
CREATE TABLE "new_table" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
-- → Suggests seeding with default data

-- New Column Detection  
ALTER TABLE "attachments" ADD COLUMN "new_field" text;
-- → Offers to populate existing records

-- Column Modification Detection
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
-- → Warns about data integrity verification
```

## Safety Features

- **Dry-run simulation** before actual deployment
- **User confirmation** at critical stages
- **Automatic fallback** when advanced features fail
- **Comprehensive logging** for troubleshooting
- **Signal handling** for graceful interruption
- **Temporary file cleanup** on exit

## Example Output

```
=== DRY RUN MODE ===
[INFO] Starting MowerManager deployment
[ 14%] Pulling latest changes from dev branch...
[DRY-RUN] Would execute: git pull origin dev
[ 28%] Installing dependencies...
[DRY-RUN] Would execute: npm install
[ 42%] Building application...
[DRY-RUN] Would execute: npm run build
[ 57%] Processing database schema changes...
[INFO] Detected new column: page_count in table attachments
[ 71%] Restarting mower-app service...
[DRY-RUN] Would execute: systemctl restart mower-app
[SUCCESS] Dry run completed successfully in 0s
```

## Integration with CI/CD

For automated deployments, use:
```bash
./deploy.sh --auto-confirm --verbose > deployment.log 2>&1
```

This provides full automation while maintaining detailed logging for troubleshooting.