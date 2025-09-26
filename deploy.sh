#!/usr/bin/env bash
# MowerManager deploy.sh — Robust, with environment sanity checks, Node/pg setup, and safe helper scripts

set -euo pipefail

APP_DIR="/opt/mowerm8"
cd "$APP_DIR"

LOG_FILE="${APP_DIR}/deploy.log"
MIGRATION_DIR="${APP_DIR}/migrations"
COUNT_SCRIPT="$APP_DIR/count_tables.js"
DEBUG_SCRIPT="$APP_DIR/debug_list_tables.js"

DRY_RUN=false
AUTO_CONFIRM=false
VERBOSE=false
SKIP_GIT_PULL=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

EXIT_SUCCESS=0
EXIT_ERROR_GENERAL=1
EXIT_ERROR_GIT=2
EXIT_ERROR_DEPS=3
EXIT_ERROR_BUILD=4
EXIT_ERROR_MIGRATION=5
EXIT_ERROR_SERVICE=6
EXIT_USER_ABORT=7

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy MowerManager application with enhanced features and automated migration checks.

OPTIONS:
    --dry-run           Simulate deployment without making changes
    --auto-confirm      Skip confirmation prompts (for automation)
    --verbose           Enable verbose logging
    --skip-git-pull     Skip git pull step
    --help              Show this help message

EOF
}

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

cleanup() {
    local exit_code=$?
    rm -f "$COUNT_SCRIPT" "$DEBUG_SCRIPT"
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

# ---- Load .env file if present ----
if [ -f "${APP_DIR}/.env" ]; then
    set -a
    source "${APP_DIR}/.env"
    set +a
fi

# ---- ENVIRONMENT SANITY CHECKS ----
env_sanity_checks() {
    # 1. Check DATABASE_URL
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log ERROR "DATABASE_URL is not set!"
        echo "Export it with: export DATABASE_URL='postgresql://user:pass@host:port/db'"
        exit 1
    fi

    # 2. Check pg module (local OR global)
    if ! node -e "require('pg')" 2>/dev/null; then
        log ERROR "Node.js 'pg' module not found."
        echo "Run: npm install pg OR npm install -g pg"
        exit 1
    fi

    # 3. Set NODE_PATH so ESM scripts find 'pg' if only globally installed
    export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
}

# ---- HELPER SCRIPTS ----
create_helper_scripts() {
    # COUNT_SCRIPT
    cat > "$COUNT_SCRIPT" << 'EOF'
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
        console.error("Error during table count:", error);
        console.log('0');
    } finally {
        await pool.end();
    }
}
countTables();
EOF

    # DEBUG_SCRIPT
    cat > "$DEBUG_SCRIPT" << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    process.exit(0);
}
const pool = new Pool({ connectionString: databaseUrl });
async function debugListTables() {
    try {
        const query = `SELECT table_schema, table_name FROM information_schema.tables
                       WHERE table_type = 'BASE TABLE'
                       AND table_schema NOT IN ('pg_catalog', 'information_schema')
                       ORDER BY table_schema, table_name;`;
        const result = await pool.query(query);
        result.rows.forEach(row => console.log(row.table_schema + '.' + row.table_name));
    } catch (error) {
        console.error("Error listing tables:", error);
    } finally {
        await pool.end();
    }
}
debugListTables();
EOF
}

# ---- DATABASE CHECK ----
is_database_empty() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would check if database is empty"
        return 1
    fi

    log INFO "Using DATABASE_URL: ${DATABASE_URL:-not set}"
    log INFO "Node.js module path: $NODE_PATH"
    log INFO "Checking if database is empty (no tables in non-system schemas)..."
    table_count=$(node "$COUNT_SCRIPT" 2>>"$LOG_FILE" || echo "0")
    log INFO "Found $table_count tables in non-system schemas"

    log INFO "Listing tables in all non-system schemas for debug:"
    node "$DEBUG_SCRIPT" >> "$LOG_FILE" 2>&1

    if [[ "$table_count" == "0" ]]; then
        log INFO "Database is empty - no tables found in any non-system schema"
        return 0
    else
        log INFO "Database is not empty - found $table_count tables"
        return 1
    fi
}

step_git_pull() {
    git config --global --add safe.directory "$APP_DIR"
    local CURRENT_BRANCH
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    show_progress 1 7 "Pulling latest changes from $CURRENT_BRANCH branch..."
    if [[ "$SKIP_GIT_PULL" == "true" ]]; then
        log INFO "Skipping git pull (--skip-git-pull flag set)"
        return 0
    fi
    if execute "Pull latest changes from $CURRENT_BRANCH branch" "git pull origin $CURRENT_BRANCH"; then
        log SUCCESS "Git pull completed successfully"
        return 0
    else
        log ERROR "Failed to pull latest changes from $CURRENT_BRANCH branch"
        return $EXIT_ERROR_GIT
    fi
}

step_install_deps() {
    show_progress 2 7 "Installing dependencies..."

    # Always fully clean before install (prevents lockfile and modules corruption)
    echo "Cleaning up node_modules and package-lock.json for fresh install..."
    rm -rf node_modules package-lock.json

    echo "Current directory: $(pwd)"
    echo "User: $(whoami)"
    echo "Vite in package.json:"
    grep vite package.json || echo "Vite NOT FOUND in package.json"
    echo "Vite in package-lock.json:"
    grep vite package-lock.json || echo "Vite NOT FOUND in package-lock.json"

    if execute "Install dependencies" "NODE_OPTIONS=\"--max-old-space-size=4096\" npm install"; then
        log SUCCESS "Dependencies installed successfully"
    else
        log ERROR "Failed to install dependencies"
        return $EXIT_ERROR_DEPS
    fi

    # Check for vite binary or npx
    if [ ! -f node_modules/.bin/vite ]; then
      log WARN "Vite binary missing after npm install! Checking npx vite..."
      if npx vite --version >/dev/null 2>&1; then
        log SUCCESS "Vite is available via npx, proceeding."
        return 0
      fi
      log WARN "Trying direct install of Vite..."
      if execute "Install Vite explicitly" "npm install --save-dev vite"; then
        log SUCCESS "Vite installed successfully after manual install"
        if [ ! -f node_modules/.bin/vite ] && ! npx vite --version >/dev/null 2>&1; then
          log ERROR "Vite binary STILL missing after manual install!"
          return $EXIT_ERROR_DEPS
        fi
      else
        log ERROR "Vite could not be installed. Check your package.json and lockfile."
        return $EXIT_ERROR_DEPS
      fi
    fi
    return 0
}

step_build() {
    show_progress 3 7 "Building application..."
    if execute "Build application" "NODE_OPTIONS=\"--max-old-space-size=4096\" npm run build"; then
        log SUCCESS "Application built successfully"
        return 0
    else
        log ERROR "Failed to build application"
        return $EXIT_ERROR_BUILD
    fi
}

step_migration() {
    show_progress 4 7 "Processing database schema changes..."
    log INFO "Starting database schema processing..."
    if is_database_empty; then
        log INFO "Empty database detected - initializing schema with db:push"
        for file in "$MIGRATION_DIR"/*.sql; do
            if grep -qE "(RENAME TABLE|RENAME COLUMN)" "$file"; then
                log WARN "Migration file $(basename "$file") contains RENAME statements and will be skipped for empty database initialization."
                mv "$file" "$file.skipped"
            fi
        done
        if [[ "$DRY_RUN" == "false" ]]; then
            if confirm "Initialize empty database schema?"; then
                if execute "Initialize database schema" "NODE_OPTIONS=\"--max-old-space-size=4096\" npm run db:push"; then
                    log SUCCESS "Database schema initialized successfully"
                    for file in "$MIGRATION_DIR"/*.sql.skipped; do
                        mv "$file" "${file%.skipped}"
                        log INFO "Restored skipped migration file: $(basename "${file%.skipped}")"
                    done
                    return 0
                else
                    log ERROR "Failed to initialize database schema"
                    for file in "$MIGRATION_DIR"/*.sql.skipped; do
                        mv "$file" "${file%.skipped}"
                        log INFO "Restored skipped migration file: $(basename "${file%.skipped}")"
                    done
                    return $EXIT_ERROR_MIGRATION
                fi
            else
                log WARN "User declined to initialize database schema"
                for file in "$MIGRATION_DIR"/*.sql.skipped; do
                    mv "$file" "${file%.skipped}"
                    log INFO "Restored skipped migration file: $(basename "${file%.skipped}")"
                done
                return $EXIT_USER_ABORT
            fi
        else
            log INFO "[DRY-RUN] Would initialize empty database schema with npm run db:push"
            for file in "$MIGRATION_DIR"/*.sql.skipped; do
                mv "$file" "${file%.skipped}"
                log INFO "Restored skipped migration file: $(basename "${file%.skipped}")"
            done
            return 0
        fi
    else
        log INFO "Database is not empty - proceeding with migration workflow"
        if execute "Generate migration files" "NODE_OPTIONS=\"--max-old-space-size=4096\" npm run db:generate"; then
            log SUCCESS "Migration files generated"
            if execute "Apply migrations" "NODE_OPTIONS=\"--max-old-space-size=4096\" npm run db:migrate"; then
                log SUCCESS "Migrations applied successfully"
            else
                log ERROR "Migration application failed, attempting fallback migration (db:push)..."
                if execute "Fallback migration" "NODE_OPTIONS=\"--max-old-space-size=4096\" npm run db:push"; then
                    log SUCCESS "Fallback migration succeeded"
                else
                    log ERROR "Fallback migration also failed - manual intervention required"
                    return $EXIT_ERROR_MIGRATION
                fi
            fi
        else
            log ERROR "Migration generation failed - manual intervention required"
            return $EXIT_ERROR_MIGRATION
        fi
        return 0
    fi
}

step_restart_service() {
    show_progress 5 7 "Restarting mower-app service..."
    if execute "Restart mower-app service" "systemctl restart mower-app"; then
        log SUCCESS "Service restarted successfully"
        return 0
    else
        log ERROR "Failed to restart mower-app service"
        return $EXIT_ERROR_SERVICE
    fi
}

step_clear_cache() {
    show_progress 6 7 "Clearing application cache..."
    log INFO "Cache clearing step (implement specific commands as needed)"
    return 0
}

step_verify_deployment() {
    show_progress 7 7 "Verifying deployment..."
    if [[ "$DRY_RUN" == "false" ]]; then
        if execute "Check service status" "systemctl is-active mower-app"; then
            log SUCCESS "Service is running correctly"
        else
            log WARN "Service may not be running properly"
        fi
    fi
    log SUCCESS "Deployment verification completed"
    return 0
}

main_deploy() {
    local start_time=$(date +%s)
    log INFO "Starting MowerManager deployment"
    log INFO "Dry run mode: $DRY_RUN"
    log INFO "Auto confirm mode: $AUTO_CONFIRM"
    log INFO "Log file: $LOG_FILE"
    env_sanity_checks
    create_helper_scripts
    step_git_pull || exit $?
    step_install_deps || exit $?
    step_build || exit $?
    step_migration || exit $?
    step_restart_service || exit $?
    step_clear_cache || exit $?
    step_verify_deployment || exit $?
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo
    if [[ "$DRY_RUN" == "true" ]]; then
        log SUCCESS "Dry run completed successfully in ${duration}s"
        echo
        if confirm "The dry run completed successfully. Do you want to proceed with the actual deployment?"; then
            log INFO "Proceeding with actual deployment..."
            DRY_RUN=false
            main_deploy
        else
            log INFO "Deployment cancelled by user"
            exit $EXIT_SUCCESS
        fi
    else
        log SUCCESS "Deployment completed successfully in ${duration}s"
    fi
}

mkdir -p "$(dirname "$LOG_FILE")"
echo "=== MowerManager Deployment Log ===" > "$LOG_FILE"
parse_args "$@"
if [[ ! -f "package.json" ]]; then
    log ERROR "package.json not found. Are you in the correct directory?"
    exit $EXIT_ERROR_GENERAL
fi
if [[ ! -d "$MIGRATION_DIR" ]]; then
    log ERROR "Migration directory not found: $MIGRATION_DIR"
    exit $EXIT_ERROR_GENERAL
fi
if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "=== DRY RUN MODE ==="
    if ! confirm "Proceed with dry run deployment simulation?"; then
        log INFO "Dry run cancelled by user"
        exit $EXIT_SUCCESS
    fi
fi
main_deploy
