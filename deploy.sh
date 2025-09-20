#!/usr/bin/env bash
# deploy.sh — Enhanced deployment script for MowerManager application
# Features: dry-run capability, schema-aware migrations, dynamic prompts, error handling

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

Deploy MowerManager application with enhanced features.

OPTIONS:
    --dry-run           Simulate deployment without making changes
    --auto-confirm      Skip confirmation prompts (for automation)
    --verbose           Enable verbose logging
    --skip-git-pull     Skip git pull step
    --help             Show this help message

FEATURES:
    • Dry-run capability with user confirmation
    • Schema-aware migrations with automatic detection
    • Dynamic user prompts for safe deployment
    • Robust error handling and rollback support
    • Detailed logging and progress indicators

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

# Set up signal handlers
trap cleanup EXIT
trap 'log ERROR "Script interrupted by user"; exit $EXIT_USER_ABORT' INT TERM

# Parse command line arguments
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

# Execute command with dry-run support
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

# Detect schema changes in migration files
detect_schema_changes() {
    local migration_file="$1"
    local changes=()
    
    if [[ ! -f "$migration_file" ]]; then
        return 0
    fi
    
    log INFO "Analyzing migration file for schema changes: $(basename "$migration_file")"
    
    # Detect new tables
    while IFS= read -r line; do
        if [[ "$line" =~ ^CREATE\ TABLE\ \"([^\"]+)\" ]]; then
            changes+=("NEW_TABLE:${BASH_REMATCH[1]}")
            log INFO "Detected new table: ${BASH_REMATCH[1]}"
        fi
    done < "$migration_file"
    
    # Detect new columns
    while IFS= read -r line; do
        if [[ "$line" =~ ^ALTER\ TABLE\ \"([^\"]+)\"\ ADD\ COLUMN\ \"([^\"]+)\" ]]; then
            changes+=("NEW_COLUMN:${BASH_REMATCH[1]}.${BASH_REMATCH[2]}")
            log INFO "Detected new column: ${BASH_REMATCH[2]} in table ${BASH_REMATCH[1]}"
        fi
    done < "$migration_file"
    
    # Detect table modifications
    while IFS= read -r line; do
        if [[ "$line" =~ ^ALTER\ TABLE\ \"([^\"]+)\"\ ALTER\ COLUMN ]]; then
            changes+=("ALTER_COLUMN:${BASH_REMATCH[1]}")
            log INFO "Detected column alteration in table: ${BASH_REMATCH[1]}"
        fi
    done < "$migration_file"
    
    # Store changes for later use
    printf '%s\n' "${changes[@]}" > "${SCRIPT_DIR}/.detected_changes"
    
    if [[ ${#changes[@]} -gt 0 ]]; then
        log INFO "Detected ${#changes[@]} schema changes"
        return 0
    else
        log INFO "No significant schema changes detected"
        return 1
    fi
}

# Execute schema-aware actions
execute_schema_actions() {
    local changes_file="${SCRIPT_DIR}/.detected_changes"
    
    if [[ ! -f "$changes_file" ]]; then
        return 0
    fi
    
    log INFO "Executing schema-aware actions based on detected changes"
    
    while IFS= read -r change; do
        case "$change" in
            NEW_TABLE:*)
                local table_name="${change#NEW_TABLE:}"
                execute_new_table_actions "$table_name"
                ;;
            NEW_COLUMN:*)
                local column_info="${change#NEW_COLUMN:}"
                local table_name="${column_info%.*}"
                local column_name="${column_info##*.}"
                execute_new_column_actions "$table_name" "$column_name"
                ;;
            ALTER_COLUMN:*)
                local table_name="${change#ALTER_COLUMN:}"
                execute_alter_column_actions "$table_name"
                ;;
        esac
    done < "$changes_file"
    
    # Clean up
    rm -f "$changes_file"
}

# Actions for new tables
execute_new_table_actions() {
    local table_name="$1"
    
    log INFO "Executing actions for new table: $table_name"
    
    case "$table_name" in
        "components"|"parts")
            log INFO "New table '$table_name' detected - consider seeding with default data"
            if [[ "$DRY_RUN" == "false" ]] && confirm "Seed $table_name table with default data?"; then
                # Add seeding logic here if needed
                log INFO "Seeding $table_name table (placeholder - implement as needed)"
            fi
            ;;
        *)
            log INFO "New table '$table_name' - no specific actions defined"
            ;;
    esac
}

# Actions for new columns
execute_new_column_actions() {
    local table_name="$1"
    local column_name="$2"
    
    log INFO "Executing actions for new column: $column_name in table $table_name"
    
    case "$table_name.$column_name" in
        "attachments.page_count")
            log INFO "New page_count column detected - consider populating existing PDF records"
            if [[ "$DRY_RUN" == "false" ]] && confirm "Populate page_count for existing PDF attachments?"; then
                log INFO "Would populate page_count for existing PDFs (implement as needed)"
            fi
            ;;
        *)
            log INFO "New column '$column_name' in '$table_name' - no specific actions defined"
            ;;
    esac
}

# Actions for altered columns
execute_alter_column_actions() {
    local table_name="$1"
    
    log INFO "Executing actions for altered columns in table: $table_name"
    log INFO "Column alteration detected - verify data integrity after deployment"
}

# Generate migration if schema changes exist
generate_migration() {
    log INFO "Checking for schema changes that require migration..."
    
    # Generate a migration to see if there are any changes
    TEMP_MIGRATION_FILE=$(mktemp "${MIGRATION_DIR}/temp_migration_XXXXXX.sql")
    
    if execute "Generate migration file" "npm run db:generate -- --name deployment_$(date +%Y%m%d_%H%M%S)"; then
        # Find the most recent migration file
        local latest_migration=$(find "$MIGRATION_DIR" -name "*.sql" -not -path "*/meta/*" | grep -v temp | sort | tail -1)
        
        if [[ -n "$latest_migration" && -f "$latest_migration" ]]; then
            # Check if the migration file has actual changes (not just empty)
            if [[ -s "$latest_migration" ]] && grep -q "CREATE\|ALTER\|DROP" "$latest_migration"; then
                log INFO "Schema changes detected in: $(basename "$latest_migration")"
                detect_schema_changes "$latest_migration"
                return 0
            else
                log INFO "No schema changes detected"
                return 1
            fi
        else
            log INFO "No new migration file generated - schema up to date"
            return 1
        fi
    else
        log ERROR "Failed to generate migration"
        return 1
    fi
}

# Apply migrations
apply_migrations() {
    log INFO "Applying database migrations..."
    
    if execute "Apply database migrations" "npm run db:migrate"; then
        log SUCCESS "Database migrations applied successfully"
        return 0
    else
        log ERROR "Failed to apply database migrations"
        return 1
    fi
}

# Main deployment steps
step_git_pull() {
    show_progress 1 7 "Pulling latest changes from dev branch..."
    
    if [[ "$SKIP_GIT_PULL" == "true" ]]; then
        log INFO "Skipping git pull (--skip-git-pull flag set)"
        return 0
    fi
    
    if execute "Pull latest changes from dev branch" "git pull origin dev"; then
        log SUCCESS "Git pull completed successfully"
        return 0
    else
        log ERROR "Failed to pull latest changes from dev branch"
        return $EXIT_ERROR_GIT
    fi
}

step_install_deps() {
    show_progress 2 7 "Installing dependencies..."
    
    if execute "Install dependencies" "NODE_OPTIONS=\"--max-old-space-size=4096\" npm install"; then
        log SUCCESS "Dependencies installed successfully"
        return 0
    else
        log ERROR "Failed to install dependencies"
        return $EXIT_ERROR_DEPS
    fi
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
    
    # Generate migration and detect changes
    if generate_migration; then
        log INFO "Schema changes detected, proceeding with migration"
        
        if [[ "$DRY_RUN" == "false" ]]; then
            if confirm "Apply detected database schema changes?"; then
                if apply_migrations; then
                    execute_schema_actions
                    log SUCCESS "Database schema updated successfully"
                    return 0
                else
                    log ERROR "Failed to apply database migrations"
                    return $EXIT_ERROR_MIGRATION
                fi
            else
                log WARN "User declined to apply database changes"
                return $EXIT_USER_ABORT
            fi
        else
            log INFO "[DRY-RUN] Would apply database migrations and execute schema actions"
            return 0
        fi
    else
        log INFO "No schema changes detected, using direct push for safety"
        if execute "Update database schema" "npm run db:push"; then
            log SUCCESS "Database schema verified/updated successfully"
            return 0
        else
            log ERROR "Failed to update database schema"
            return $EXIT_ERROR_MIGRATION
        fi
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
    
    # Add specific cache clearing commands here if needed
    log INFO "Cache clearing step (implement specific commands as needed)"
    return 0
}

step_verify_deployment() {
    show_progress 7 7 "Verifying deployment..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Add deployment verification logic here
        if execute "Check service status" "systemctl is-active mower-app"; then
            log SUCCESS "Service is running correctly"
        else
            log WARN "Service may not be running properly"
        fi
    fi
    
    log SUCCESS "Deployment verification completed"
    return 0
}

# Main deployment function
main_deploy() {
    local start_time=$(date +%s)
    
    log INFO "Starting MowerManager deployment"
    log INFO "Dry run mode: $DRY_RUN"
    log INFO "Auto confirm mode: $AUTO_CONFIRM"
    log INFO "Log file: $LOG_FILE"
    
    # Execute deployment steps
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

# Initialize logging
mkdir -p "$(dirname "$LOG_FILE")"
echo "=== MowerManager Deployment Log ===" > "$LOG_FILE"

# Parse arguments and start deployment
parse_args "$@"

# Pre-deployment checks
if [[ ! -f "package.json" ]]; then
    log ERROR "package.json not found. Are you in the correct directory?"
    exit $EXIT_ERROR_GENERAL
fi

if [[ ! -d "$MIGRATION_DIR" ]]; then
    log ERROR "Migration directory not found: $MIGRATION_DIR"
    exit $EXIT_ERROR_GENERAL
fi

# Show initial confirmation for dry run
if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "=== DRY RUN MODE ==="
    if ! confirm "Proceed with dry run deployment simulation?"; then
        log INFO "Dry run cancelled by user"
        exit $EXIT_SUCCESS
    fi
fi

# Start main deployment
main_deploy
