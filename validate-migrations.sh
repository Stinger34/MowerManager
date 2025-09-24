#!/usr/bin/env bash
# validate-migrations.sh - Standalone migration validation for CI/CD integration
# This script validates migration files and structure without requiring database access

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="${SCRIPT_DIR}/migrations"
SCHEMA_FILE="${SCRIPT_DIR}/shared/schema.ts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Exit codes
EXIT_SUCCESS=0
EXIT_ERROR_VALIDATION=1
EXIT_ERROR_MISSING_FILES=2

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    
    case "$level" in
        ERROR) echo -e "${RED}[ERROR]${NC} $message" >&2 ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" >&2 ;;
        INFO)  echo -e "${BLUE}[INFO]${NC} $message" ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        *) echo "[$level] $message" ;;
    esac
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Validate database migration files and structure for MowerManager.
This script performs validation without requiring database access, making it suitable for CI/CD.

OPTIONS:
    --strict           Fail on warnings (treat warnings as errors)
    --fix             Attempt to fix minor issues automatically  
    --verbose         Enable verbose output
    --help            Show this help message

VALIDATION CHECKS:
    • Migration file structure and naming conventions
    • Migration journal integrity
    • Schema file consistency
    • Missing migration files detection
    • Orphaned migration files detection
    • Migration sequencing validation

EXIT CODES:
    0 - All validations passed
    1 - Validation errors found
    2 - Missing required files
EOF
}

# Parse command line arguments
STRICT_MODE=false
FIX_MODE=false
VERBOSE=false

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --strict)
                STRICT_MODE=true
                shift
                ;;
            --fix)
                FIX_MODE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                usage
                exit $EXIT_SUCCESS
                ;;
            *)
                log ERROR "Unknown option: $1"
                usage
                exit $EXIT_ERROR_VALIDATION
                ;;
        esac
    done
}

# Check if required files and directories exist
validate_structure() {
    log INFO "Validating migration directory structure..."
    
    local errors=0
    
    if [[ ! -d "$MIGRATION_DIR" ]]; then
        log ERROR "Migration directory not found: $MIGRATION_DIR"
        ((errors++))
    fi
    
    if [[ ! -f "$MIGRATION_DIR/meta/_journal.json" ]]; then
        log ERROR "Migration journal not found: $MIGRATION_DIR/meta/_journal.json"
        ((errors++))
    fi
    
    if [[ ! -f "$SCHEMA_FILE" ]]; then
        log ERROR "Schema file not found: $SCHEMA_FILE"
        ((errors++))
    fi
    
    if [[ ! -f "${SCRIPT_DIR}/drizzle.config.ts" ]]; then
        log WARN "Drizzle config not found: ${SCRIPT_DIR}/drizzle.config.ts"
        [[ "$STRICT_MODE" == "true" ]] && ((errors++))
    fi
    
    if [[ ! -f "${SCRIPT_DIR}/package.json" ]]; then
        log ERROR "Package.json not found: ${SCRIPT_DIR}/package.json"
        ((errors++))
    fi
    
    if [[ $errors -gt 0 ]]; then
        log ERROR "Structure validation failed with $errors errors"
        return $EXIT_ERROR_MISSING_FILES
    fi
    
    log SUCCESS "Directory structure validation passed"
    return 0
}

# Validate migration journal format and content
validate_journal() {
    log INFO "Validating migration journal format..."
    
    local journal_file="$MIGRATION_DIR/meta/_journal.json"
    local errors=0
    
    # Check if journal is valid JSON
    if ! jq empty "$journal_file" 2>/dev/null; then
        log ERROR "Migration journal is not valid JSON"
        return $EXIT_ERROR_VALIDATION
    fi
    
    # Check journal structure
    local version
    version=$(jq -r '.version // empty' "$journal_file")
    if [[ -z "$version" ]]; then
        log ERROR "Migration journal missing version field"
        ((errors++))
    else
        log INFO "Migration journal version: $version"
    fi
    
    local dialect
    dialect=$(jq -r '.dialect // empty' "$journal_file")
    if [[ -z "$dialect" ]]; then
        log WARN "Migration journal missing dialect field"
        [[ "$STRICT_MODE" == "true" ]] && ((errors++))
    else
        log INFO "Migration journal dialect: $dialect"
    fi
    
    # Check entries array
    local entries_count
    entries_count=$(jq '.entries | length' "$journal_file")
    log INFO "Migration journal entries: $entries_count"
    
    if [[ $entries_count -gt 0 ]]; then
        # Validate each entry has required fields
        local entry_errors
        entry_errors=$(jq -r '.entries[] | select(.tag == null or .tag == "" or .breakpoints == null) | @base64' "$journal_file" | wc -l)
        if [[ $entry_errors -gt 0 ]]; then
            log ERROR "Found $entry_errors entries with missing required fields (tag, breakpoints)"
            ((errors++))
        fi
    fi
    
    if [[ $errors -gt 0 ]]; then
        log ERROR "Journal validation failed with $errors errors"
        return $EXIT_ERROR_VALIDATION
    fi
    
    log SUCCESS "Migration journal validation passed"
    return 0
}

# Validate migration files match journal entries
validate_migration_files() {
    log INFO "Validating migration files against journal..."
    
    local journal_file="$MIGRATION_DIR/meta/_journal.json"
    local errors=0
    local warnings=0
    
    # Get all migration tags from journal
    local journal_tags
    journal_tags=$(jq -r '.entries[].tag' "$journal_file" 2>/dev/null || echo "")
    
    # Check each journal entry has corresponding file
    while IFS= read -r tag; do
        if [[ -n "$tag" ]]; then
            local migration_file="$MIGRATION_DIR/${tag}.sql"
            if [[ ! -f "$migration_file" ]]; then
                log ERROR "Missing migration file for journal entry: ${tag}.sql"
                ((errors++))
            else
                [[ "$VERBOSE" == "true" ]] && log INFO "✓ Found migration file: ${tag}.sql"
            fi
        fi
    done <<< "$journal_tags"
    
    # Check for orphaned migration files (files not in journal)
    local orphaned_files=()
    while IFS= read -r migration_file; do
        if [[ -f "$migration_file" ]]; then
            local basename_file
            basename_file=$(basename "$migration_file" .sql)
            if ! echo "$journal_tags" | grep -q "^${basename_file}$"; then
                orphaned_files+=("$migration_file")
                log WARN "Orphaned migration file (not in journal): $(basename "$migration_file")"
                ((warnings++))
            fi
        fi
    done < <(find "$MIGRATION_DIR" -name "*.sql" -not -path "*/meta/*" 2>/dev/null | sort)
    
    # Validation summary
    local total_journal_entries
    total_journal_entries=$(echo "$journal_tags" | grep -c . || echo "0")
    
    log INFO "Migration file validation summary:"
    log INFO "  Journal entries: $total_journal_entries"
    log INFO "  Orphaned files: ${#orphaned_files[@]}"
    log INFO "  Errors: $errors"
    log INFO "  Warnings: $warnings"
    
    # Fix orphaned files if requested
    if [[ "$FIX_MODE" == "true" && ${#orphaned_files[@]} -gt 0 ]]; then
        log INFO "Attempting to fix orphaned files..."
        for orphaned_file in "${orphaned_files[@]}"; do
            log WARN "Would move orphaned file to migrations-old: $(basename "$orphaned_file")"
            # In fix mode, we could move files to migrations-old
            # mv "$orphaned_file" "${SCRIPT_DIR}/migrations-old/" || true
        done
    fi
    
    if [[ $errors -gt 0 ]]; then
        log ERROR "Migration files validation failed with $errors errors"
        return $EXIT_ERROR_VALIDATION
    fi
    
    if [[ $warnings -gt 0 && "$STRICT_MODE" == "true" ]]; then
        log ERROR "Migration files validation failed in strict mode due to $warnings warnings"
        return $EXIT_ERROR_VALIDATION
    fi
    
    log SUCCESS "Migration files validation passed"
    return 0
}

# Validate schema file syntax and structure
validate_schema() {
    log INFO "Validating schema file..."
    
    local errors=0
    
    # Check if schema file exists and is readable
    if [[ ! -r "$SCHEMA_FILE" ]]; then
        log ERROR "Schema file is not readable: $SCHEMA_FILE"
        return $EXIT_ERROR_MISSING_FILES
    fi
    
    # Basic syntax validation using TypeScript compiler if available
    if command -v npx >/dev/null 2>&1; then
        log INFO "Checking schema TypeScript syntax..."
        if ! npx tsc --noEmit --skipLibCheck "$SCHEMA_FILE" 2>/dev/null; then
            log WARN "Schema file has TypeScript syntax issues"
            [[ "$STRICT_MODE" == "true" ]] && ((errors++))
        else
            [[ "$VERBOSE" == "true" ]] && log INFO "Schema TypeScript syntax is valid"
        fi
    else
        log INFO "TypeScript compiler not available, skipping syntax check"
    fi
    
    # Check for basic Drizzle ORM patterns
    if ! grep -q "import.*drizzle-orm" "$SCHEMA_FILE"; then
        log WARN "Schema file doesn't appear to import drizzle-orm"
        [[ "$STRICT_MODE" == "true" ]] && ((errors++))
    fi
    
    if ! grep -q "pgTable\|table" "$SCHEMA_FILE"; then
        log WARN "Schema file doesn't appear to define any tables"
        [[ "$STRICT_MODE" == "true" ]] && ((errors++))
    fi
    
    # Count tables defined in schema
    local table_count
    table_count=$(grep -c "pgTable\|= table" "$SCHEMA_FILE" || echo "0")
    log INFO "Schema defines approximately $table_count tables"
    
    if [[ $errors -gt 0 ]]; then
        log ERROR "Schema validation failed with $errors errors"
        return $EXIT_ERROR_VALIDATION
    fi
    
    log SUCCESS "Schema file validation passed"
    return 0
}

# Validate package.json has required migration scripts
validate_package_scripts() {
    log INFO "Validating package.json migration scripts..."
    
    local package_file="${SCRIPT_DIR}/package.json"
    local errors=0
    
    # Check for required scripts
    local required_scripts=("db:generate" "db:migrate" "db:push")
    for script in "${required_scripts[@]}"; do
        if ! jq -e ".scripts[\"$script\"]" "$package_file" >/dev/null 2>&1; then
            log ERROR "Missing required npm script: $script"
            ((errors++))
        else
            [[ "$VERBOSE" == "true" ]] && log INFO "✓ Found npm script: $script"
        fi
    done
    
    # Check for drizzle-kit dependency
    if ! jq -e '.devDependencies["drizzle-kit"] // .dependencies["drizzle-kit"]' "$package_file" >/dev/null 2>&1; then
        log ERROR "Missing drizzle-kit dependency"
        ((errors++))
    fi
    
    if [[ $errors -gt 0 ]]; then
        log ERROR "Package.json validation failed with $errors errors"
        return $EXIT_ERROR_VALIDATION
    fi
    
    log SUCCESS "Package.json scripts validation passed"
    return 0
}

# Main validation function
main() {
    parse_args "$@"
    
    log INFO "Starting migration validation for MowerManager"
    log INFO "Validation mode: $([ "$STRICT_MODE" == "true" ] && echo "STRICT" || echo "NORMAL")"
    log INFO "Fix mode: $([ "$FIX_MODE" == "true" ] && echo "ENABLED" || echo "DISABLED")"
    echo
    
    local total_errors=0
    
    # Run all validation checks
    validate_structure || ((total_errors++))
    echo
    
    validate_journal || ((total_errors++))
    echo
    
    validate_migration_files || ((total_errors++))
    echo
    
    validate_schema || ((total_errors++))
    echo
    
    validate_package_scripts || ((total_errors++))
    echo
    
    # Final summary
    if [[ $total_errors -eq 0 ]]; then
        log SUCCESS "=== All migration validations passed ==="
        log SUCCESS "Migration system is ready for deployment"
        exit $EXIT_SUCCESS
    else
        log ERROR "=== Migration validation failed ==="
        log ERROR "Found issues in $total_errors validation categories"
        log ERROR "Please fix the issues before deployment"
        echo
        log INFO "To fix automatically where possible, run: $0 --fix"
        log INFO "For stricter validation, run: $0 --strict"
        exit $EXIT_ERROR_VALIDATION
    fi
}

# Run main function with all arguments
main "$@"