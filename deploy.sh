#!/usr/bin/env bash
# deploy.sh — Enhanced deployment script for MowerManager application
# Features: dry-run capability, schema-aware migrations, dynamic prompts, error handling, 
#           automated migration validation, and comprehensive fallback strategies
#
# AUTOMATED MIGRATION VALIDATION FEATURES:
# - Detects missing migration files and gaps in migration sequence
# - Validates migration journal against actual database state  
# - Attempts automatic recovery of missing migration files from backups
# - Provides comprehensive error messaging and manual intervention guidance
# - Supports both fresh database setup and existing database validation
# - Implements multiple fallback strategies when automation fails
#
# IDEMPOTENCY FEATURES:
# - Checks for existing database tables before attempting to create them
# - Converts CREATE TABLE statements to CREATE TABLE IF NOT EXISTS for safety
# - Gracefully handles migration failures due to existing database objects
# - Provides comprehensive logging for skipped operations due to idempotency
# - Uses fallback verification methods when migrations encounter existing objects
# - Ensures deployment continues even when migrations are skipped due to existing schema
#
# DATABASE MIGRATION WORKFLOW WITH AUTOMATED VALIDATION:
# 1. Comprehensive migration file validation (detect gaps, missing files)
# 2. Migration history validation against actual database state
# 3. Automated recovery attempts for missing migration files
# 4. Query existing database tables for idempotency checks
# 5. Generate migration files using Drizzle ORM with validation
# 6. Analyze migration files and modify them for idempotency (IF NOT EXISTS)
# 7. Detect which operations can be skipped due to existing objects
# 8. Apply migrations with graceful error handling for existing objects
# 9. Post-migration validation to ensure consistency
# 10. Use fallback methods (db:push) if migrations fail
# 11. Provide detailed guidance for manual intervention when needed
#
# ERROR HANDLING FOR MIGRATION AUTOMATION:
# - Migration file validation failures trigger automatic recovery attempts
# - Migration history mismatches are logged but don't prevent deployment
# - Database connectivity issues are clearly reported with troubleshooting steps
# - Migration failures due to existing tables/objects are treated as warnings
# - Fallback schema verification ensures deployment can continue safely
# - Comprehensive logging helps distinguish between real errors and expected issues

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/deploy.log"
MIGRATION_DIR="${SCRIPT_DIR}/migrations"
TEMP_MIGRATION_FILE=""

# Default settings
DRY_RUN=false
AUTO_CONFIRM=false
VERBOSE=false
SKIP_GIT_PULL=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Exit codes
EXIT_SUCCESS=0
EXIT_ERROR_GENERAL=1
EXIT_ERROR_GIT=2
EXIT_ERROR_DEPS=3
EXIT_ERROR_BUILD=4
EXIT_ERROR_MIGRATION=5
EXIT_ERROR_SERVICE=6
EXIT_USER_ABORT=7

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy MowerManager application with enhanced features and automated migration checks.

OPTIONS:
    --dry-run           Simulate deployment without making changes
    --auto-confirm      Skip confirmation prompts (for automation)
    --verbose           Enable verbose logging
    --skip-git-pull     Skip git pull step
    --help             Show this help message

FEATURES:
    • Dry-run capability with user confirmation
    • Empty database detection and initialization
    • Smart migration handling for empty vs non-empty databases
    • Schema-aware migrations with automatic detection
    • Automated migration file validation and gap detection
    • Database migration history validation against actual database state
    • Automatic recovery of missing migration files from backups
    • Idempotent database migrations (safe to run multiple times)
    • Automatic handling of existing database tables and objects
    • CREATE TABLE IF NOT EXISTS conversion for safety
    • Enhanced error messaging with manual intervention guidance
    • Comprehensive logging for troubleshooting migration issues
    • Fallback strategies when migration automation fails

DATABASE INITIALIZATION:
    • Detects if target database is empty (no tables in any non-system schema)
    • For empty databases: runs 'npm run db:push' to initialize schema
    • For non-empty databases: uses standard migration workflow
    • Works with PostgreSQL connection strings via psql/node-postgres

AUTOMATED MIGRATION CHECKS:
    • Detects missing migration files and gaps in migration sequence
    • Validates migration journal against actual database state
    • Attempts to restore missing files from migrations-old directory
    • Provides clear guidance when manual intervention is required
    • Supports fresh database setup and existing database validation

FALLBACK STRATEGIES:
    • Uses db:push when regular migrations fail
    • Provides detailed error messages for troubleshooting
    • Guides developers through manual recovery steps
    • Ensures deployment can continue even with migration issues
    • Dynamic user prompts for safe deployment
    • Robust error handling and rollback support
    • Detailed logging and progress indicators
    • Database connectivity verification before/after migrations

IDEMPOTENCY SAFETY:
    • Checks existing database tables before creating new ones
    • Converts migration files to use IF NOT EXISTS statements
    • Skips operations that would fail due to existing objects
    • Continues deployment even when migrations are skipped
    • Provides comprehensive logging of all skipped operations

EOF
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        INFO)  echo -e "${BLUE}[INFO]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" >&2 ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Progress indicator
show_progress() {
    local step="$1"
    local total="$2"
    local description="$3"
    
    local percentage=$((step * 100 / total))
    printf "\r[%3d%%] %s" "$percentage" "$description"
    if [[ $step -eq $total ]]; then
        echo
    fi
}

# User confirmation with timeout
confirm() {
    local prompt="$1"
    local timeout="${2:-30}"
    local default="${3:-n}"
    
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        log INFO "Auto-confirming: $prompt"
        return 0
    fi
    
    local response
    echo -n "$prompt [y/N] (timeout: ${timeout}s): "
    
    if read -t "$timeout" -r response; then
        case "$response" in
            [Yy]|[Yy][Ee][Ss]) return 0 ;;
            *) return 1 ;;
        esac
    else
        echo
        log WARN "Confirmation timed out, using default: $default"
        [[ "$default" == "y" ]] && return 0 || return 1
    fi
}

# Cleanup function
cleanup() {
    local exit_code=$?
    
    if [[ -n "$TEMP_MIGRATION_FILE" && -f "$TEMP_MIGRATION_FILE" ]]; then
        log INFO "Cleaning up temporary migration file: $TEMP_MIGRATION_FILE"
        rm -f "$TEMP_MIGRATION_FILE"
    fi
    
    if [[ $exit_code -ne 0 ]]; then
        log ERROR "Deployment failed with exit code $exit_code"
        log INFO "Check the log file: $LOG_FILE"
    fi
    
    exit $exit_code
}

trap cleanup EXIT
trap 'log ERROR "Script interrupted by user"; exit $EXIT_USER_ABORT' INT TERM

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --auto-confirm)
                AUTO_CONFIRM=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --skip-git-pull)
                SKIP_GIT_PULL=true
                shift
                ;;
            --help)
                usage
                exit $EXIT_SUCCESS
                ;;
            *)
                log ERROR "Unknown option: $1"
                usage
                exit $EXIT_ERROR_GENERAL
                ;;
        esac
    done
}

execute() {
    local description="$1"
    shift
    local cmd="$*"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would execute: $description"
        log INFO "[DRY-RUN] Command: $cmd"
        return 0
    else
        log INFO "Executing: $description"
        if [[ "$VERBOSE" == "true" ]]; then
            log INFO "Command: $cmd"
        fi
        eval "$cmd"
    fi
}

# Check if a table exists in the database (idempotency helper)
check_table_exists() {
    local table_name="$1"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would check if table '$table_name' exists"
        return 1  # Assume table doesn't exist in dry-run mode
    fi

    local temp_check_script="/tmp/check_table_${table_name}.js"
    cat > "$temp_check_script" << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const tableName = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.log('false');
    process.exit(0);
}

const pool = new Pool({ connectionString: databaseUrl });

async function checkTable() {
    try {
        const query = `SELECT COUNT(*) AS found FROM information_schema.tables 
                       WHERE table_type = 'BASE TABLE'
                       AND table_name = $1
                       AND table_schema NOT IN ('pg_catalog', 'information_schema');`;
        const result = await pool.query(query, [tableName]);
        console.log(result.rows[0].found > 0 ? 'true' : 'false');
    } catch (error) {
        console.log('false');
    } finally {
        await pool.end();
    }
}

checkTable();
EOF

    result=$(node "$temp_check_script" "$table_name" 2>/dev/null || echo "false")
    rm -f "$temp_check_script"
    
    if [[ "$result" == "true" ]]; then
        log INFO "Table '$table_name' already exists in database"
        return 0
    else
        log INFO "Table '$table_name' does not exist in database"
        return 1
    fi
}

# Get list of existing tables in the database (all non-system schemas)
get_existing_tables() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would query existing tables"
        echo ""
        return 0
    fi
    
    local temp_list_script="/tmp/list_tables.js"
    cat > "$temp_list_script" << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    process.exit(0);
}

const pool = new Pool({ connectionString: databaseUrl });

async function listTables() {
    try {
        const query = `SELECT table_schema, table_name FROM information_schema.tables 
                       WHERE table_type = 'BASE TABLE'
                       AND table_schema NOT IN ('pg_catalog', 'information_schema')
                       ORDER BY table_schema, table_name;`;
        const result = await pool.query(query);
        result.rows.forEach(row => console.log(row.table_schema + '.' + row.table_name));
    } catch (error) {
        // Silent fail - database might not be available
    } finally {
        await pool.end();
    }
}

listTables();
EOF

    local tables
    tables=$(node "$temp_list_script" 2>/dev/null || echo "")
    rm -f "$temp_list_script"
    
    echo "$tables"
}

# Check if database is empty (no tables in any non-system schema)
is_database_empty() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would check if database is empty"
        return 1  # Assume database is not empty in dry-run mode
    fi
    
    log INFO "Checking if database is empty (no tables in any non-system schema)..."
    
    local temp_count_script="/tmp/count_tables.js"
    cat > "$temp_count_script" << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.log('0');
    process.exit(0);
}

const pool = new Pool({ connectionString: databaseUrl });

async function countTables() {
    try {
        const query = `SELECT COUNT(*) as table_count FROM information_schema.tables 
                       WHERE table_type = 'BASE TABLE'
                       AND table_schema NOT IN ('pg_catalog', 'information_schema');`;
        const result = await pool.query(query);
        console.log(result.rows[0].table_count);
    } catch (error) {
        console.log('0');
    } finally {
        await pool.end();
    }
}

countTables();
EOF

    local table_count
    table_count=$(node "$temp_count_script" 2>/dev/null || echo "0")
    rm -f "$temp_count_script"
    
    log INFO "Found $table_count tables in non-system schemas"
    
    if [[ "$table_count" == "0" ]]; then
        log INFO "Database is empty - no tables found in non-system schemas"
        return 0
    else
        log INFO "Database is not empty - found $table_count tables"
        return 1
    fi
}

# ... rest of the script remains unchanged ...
# All other functions and deployment logic should work as before.
