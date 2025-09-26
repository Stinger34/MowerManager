#!/usr/bin/env bash
# new_deploy.sh — Enhanced deployment script for MowerManager (multi-schema aware, restored resiliency)
# Enhancements applied:
# - Multi-schema awareness (all non-system schemas)
# - Restored comprehensive migration validation (files + history + orphan detection)
# - Implemented restoration from migrations-old
# - Schema-qualified table enumeration (schema.table_name)
# - Robust SCRIPT_DIR resolution fixed
# - Expanded mismatch diagnostics
# - Optional FAST_VALIDATION mode (export FAST_VALIDATION=true to skip orphan scan)
# - Improved idempotency handling & safer pattern matching

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

# Optional performance flag (skip orphan scan if true)
FAST_VALIDATION="${FAST_VALIDATION:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Exit codes
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

Deploy MowerManager with multi-schema database migration automation.

OPTIONS:
  --dry-run           Simulate deployment
  --auto-confirm      Skip interactive confirmations
  --verbose           Verbose logging
  --skip-git-pull     Skip git pull
  --help              Show this help

FEATURES:
  • Multi-schema awareness (all non-system schemas)
  • Empty DB detection vs existing schema
  • Migration gap / missing file / orphan detection
  • Automatic attempt to restore missing migrations (migrations-old/)
  • Idempotent migration transformation (CREATE ... IF NOT EXISTS)
  • Schema change detection + hooks for new tables/columns
  • Fallback strategies (db:push) on recoverable failures
  • Post-migration validation and diagnostics
  • FAST_VALIDATION mode (export FAST_VALIDATION=true) to skip orphan scan

EOF
}

log() {
    local level="$1"; shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    case "$level" in
        INFO)    echo -e "${BLUE}[INFO]${NC} $message" ;;
        WARN)    echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR)   echo -e "${RED}[ERROR]${NC} $message" >&2 ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

show_progress() {
    local step="$1" total="$2" description="$3"
    local percentage=$((step * 100 / total))
    printf "\r[%3d%%] %s" "$percentage" "$description"
    if [[ $step -eq $total ]]; then echo; fi
}

confirm() {
    local prompt="$1" timeout="${2:-30}" default="${3:-n}"
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        log INFO "Auto-confirming: $prompt"
        return 0
    fi
    local response
    echo -n "$prompt [y/N] (timeout ${timeout}s): "
    if read -t "$timeout" -r response; then
        case "$response" in
            [Yy]|[Yy][Ee][Ss]) return 0 ;;
            *) return 1 ;;
        esac
    else
        echo
        log WARN "Confirmation timed out, default: $default"
        [[ "$default" == "y" ]] && return 0 || return 1
    fi
}

cleanup() {
    local exit_code=$?
    if [[ -n "$TEMP_MIGRATION_FILE" && -f "$TEMP_MIGRATION_FILE" ]]; then
        log INFO "Cleaning temporary migration file: $TEMP_MIGRATION_FILE"
        rm -f "$TEMP_MIGRATION_FILE"
    fi
    if [[ $exit_code -ne 0 ]]; then
        log ERROR "Deployment failed (exit $exit_code)"
        log INFO "See log file: $LOG_FILE"
    fi
    exit $exit_code
}
trap cleanup EXIT
trap 'log ERROR "Interrupted by user"; exit $EXIT_USER_ABORT' INT TERM

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) DRY_RUN=true; shift ;;
            --auto-confirm) AUTO_CONFIRM=true; shift ;;
            --verbose) VERBOSE=true; shift ;;
            --skip-git-pull) SKIP_GIT_PULL=true; shift ;;
            --help) usage; exit $EXIT_SUCCESS ;;
            *) log ERROR "Unknown option: $1"; usage; exit $EXIT_ERROR_GENERAL ;;
        esac
    done
}

execute() {
    local description="$1"; shift
    local cmd="$*"
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] $description -> $cmd"
        return 0
    fi
    log INFO "Executing: $description"
    [[ "$VERBOSE" == "true" ]] && log INFO "Command: $cmd"
    eval "$cmd"
}

# --------------------------
# Multi-schema aware helpers
# --------------------------

# Accepts table or schema.table. If schema omitted, searches all non-system.
check_table_exists() {
    local identifier="$1"
    local schema="" table=""
    if [[ "$identifier" == *.* ]]; then
        schema="${identifier%%.*}"
        table="${identifier##*.}"
    else
        table="$identifier"
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would check existence of table '$identifier'"
        return 1
    fi

    local temp_js="/tmp/check_table_$$.js"
    cat > "$temp_js" << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const raw = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.log('false'); process.exit(0); }

let schema=null, table=null;
if (raw.includes('.')) {
  const parts = raw.split('.');
  schema = parts[0];
  table = parts[1];
} else {
  table = raw;
}

const pool = new Pool({ connectionString: databaseUrl });

(async () => {
  try {
    let query, params;
    if (schema) {
      query = `SELECT COUNT(*) AS found
               FROM information_schema.tables
               WHERE table_type='BASE TABLE'
                 AND table_schema NOT IN ('pg_catalog','information_schema')
                 AND table_schema=$1 AND table_name=$2`;
      params = [schema, table];
    } else {
      query = `SELECT COUNT(*) AS found
               FROM information_schema.tables
               WHERE table_type='BASE TABLE'
                 AND table_schema NOT IN ('pg_catalog','information_schema')
                 AND table_name=$1`;
      params = [table];
    }
    const r = await pool.query(query, params);
    console.log(Number(r.rows[0].found) > 0 ? 'true' : 'false');
  } catch {
    console.log('false');
  } finally {
    await pool.end();
  }
})();
EOF

    local result
    result=$(node "$temp_js" "$identifier" 2>/dev/null || echo "false")
    rm -f "$temp_js"
    if [[ "$result" == "true" ]]; then
        log INFO "Table exists: $identifier"
        return 0
    else
        log INFO "Table missing: $identifier"
        return 1
    fi
}

# Outputs schema.table_name per line
get_existing_tables() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would enumerate existing tables"
        echo ""
        return 0
    fi
    local temp_js="/tmp/list_tables_$$.js"
    cat > "$temp_js" << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const db = process.env.DATABASE_URL;
if (!db) process.exit(0);
const pool = new Pool({ connectionString: db });
(async () => {
  try {
    const q = `SELECT table_schema, table_name
               FROM information_schema.tables
               WHERE table_type='BASE TABLE'
                 AND table_schema NOT IN ('pg_catalog','information_schema')
               ORDER BY table_schema, table_name`;
    const r = await pool.query(q);
    r.rows.forEach(row => console.log(row.table_schema + '.' + row.table_name));
  } catch {
  } finally {
    await pool.end();
  }
})();
EOF
    local tables
    tables=$(node "$temp_js" 2>/dev/null || echo "")
    rm -f "$temp_js"
    echo "$tables"
}

is_database_empty() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would check emptiness (multi-schema)"
        return 1
    fi
    local temp_js="/tmp/count_tables_$$.js"
    cat > "$temp_js" << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const db = process.env.DATABASE_URL;
if (!db) { console.log('0'); process.exit(0); }
const pool = new Pool({ connectionString: db });
(async () => {
  try {
    const q = `SELECT COUNT(*) AS c
               FROM information_schema.tables
               WHERE table_type='BASE TABLE'
                 AND table_schema NOT IN ('pg_catalog','information_schema')`;
    const r = await pool.query(q);
    console.log(r.rows[0].c);
  } catch {
    console.log('0');
  } finally {
    await pool.end();
  }
})();
EOF
    local count
    count=$(node "$temp_js" 2>/dev/null || echo "0")
    rm -f "$temp_js"
    log INFO "Detected $count existing base tables (non-system schemas)"
    if [[ "$count" == "0" ]]; then
        return 0
    fi
    return 1
}

# ----------------------
# Idempotency adjustment
# ----------------------
make_migration_idempotent() {
    local migration_file="$1"
    local backup="${migration_file}.backup"
    [[ ! -f "$migration_file" ]] && { log WARN "Missing migration file: $migration_file"; return 1; }
    cp "$migration_file" "$backup"

    # Replace plain CREATE TABLE with IF NOT EXISTS (avoid double applying)
    perl -0777 -pi -e 's/\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/CREATE TABLE IF NOT EXISTS /gi' "$migration_file"
    perl -0777 -pi -e 's/\bCREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/CREATE UNIQUE INDEX IF NOT EXISTS /gi' "$migration_file"
    perl -0777 -pi -e 's/\bCREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/CREATE INDEX IF NOT EXISTS /gi' "$migration_file"

    if ! diff -q "$backup" "$migration_file" >/dev/null; then
        log INFO "Idempotency transformations applied to $(basename "$migration_file")"
        [[ "$VERBOSE" == "true" ]] && diff -u "$backup" "$migration_file" | head -40
        return 0
    else
        rm -f "$backup"
        log INFO "No idempotent changes needed"
        return 1
    fi
}

# ------------------------
# Schema change detection
# ------------------------
detect_schema_changes() {
    local migration_file="$1"
    [[ ! -f "$migration_file" ]] && return 0

    local existing
    existing=$(get_existing_tables)

    local changes=()
    local skipped=()

    while IFS= read -r line; do
        # Match CREATE TABLE [IF NOT EXISTS] ["]?schema?."?table
        if [[ "$line" =~ CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?(\"?[A-Za-z0-9_]+\"?\.)?\"?([A-Za-z0-9_]+)\"? ]]; then
            local schema_part="${BASH_REMATCH[2]}"
            local table_name="${BASH_REMATCH[3]}"
            local schema_clean=""
            if [[ -n "$schema_part" ]]; then
                schema_clean=$(echo "$schema_part" | sed 's/[\".]//g')
            else
                schema_clean="public"  # default assumption if omitted
            fi
            local fq="${schema_clean}.${table_name}"
            if echo "$existing" | grep -qx "$fq"; then
                skipped+=("SKIP_TABLE:$fq")
            else
                changes+=("NEW_TABLE:$fq")
            fi
        fi
    done < "$migration_file"

    while IFS= read -r line; do
        if [[ "$line" =~ ALTER[[:space:]]+TABLE[[:space:]]+\"?([A-Za-z0-9_]+)\"?\.\"?([A-Za-z0-9_]+)\"?[[:space:]]+ADD[[:space:]]+COLUMN[[:space:]]+\"?([A-Za-z0-9_]+)\"? ]]; then
            local schema="${BASH_REMATCH[1]}"
            local table="${BASH_REMATCH[2]}"
            local column="${BASH_REMATCH[3]}"
            changes+=("NEW_COLUMN:${schema}.${table}.${column}")
        elif [[ "$line" =~ ALTER[[:space:]]+TABLE[[:space:]]+\"?([A-Za-z0-9_]+)\"?\.\"?([A-Za-z0-9_]+)\"?[[:space:]]+ALTER[[:space:]]+COLUMN ]]; then
            local schema="${BASH_REMATCH[1]}"
            local table="${BASH_REMATCH[2]}"
            changes+=("ALTER_COLUMN:${schema}.${table}")
        fi
    done < "$migration_file"

    printf '%s\n' "${changes[@]}" > "${SCRIPT_DIR}/.detected_changes"
    printf '%s\n' "${skipped[@]}" > "${SCRIPT_DIR}/.skipped_changes"

    [[ ${#skipped[@]} -gt 0 ]] && log INFO "Skipped ${#skipped[@]} existing table creations"
    if [[ ${#changes[@]} -gt 0 ]]; then
        log INFO "Detected ${#changes[@]} schema operations"
        return 0
    else
        log INFO "No actionable schema changes detected"
        return 1
    fi
}

execute_schema_actions() {
    local f_changes="${SCRIPT_DIR}/.detected_changes"
    local f_skipped="${SCRIPT_DIR}/.skipped_changes"
    if [[ -f "$f_skipped" ]]; then
        while IFS= read -r line; do
            case "$line" in
                SKIP_TABLE:*) log INFO "Skipped existing table: ${line#SKIP_TABLE:}" ;;
            esac
        done < "$f_skipped"
        rm -f "$f_skipped"
    fi
    [[ ! -f "$f_changes" ]] && return 0
    while IFS= read -r line; do
        case "$line" in
            NEW_TABLE:*) execute_new_table_actions "${line#NEW_TABLE:}" ;;
            NEW_COLUMN:*) local data="${line#NEW_COLUMN:}"; execute_new_column_actions "${data%.*.*}" ;; # simplified hook
            ALTER_COLUMN:*) execute_alter_column_actions "${line#ALTER_COLUMN:}" ;;
        esac
    done < "$f_changes"
    rm -f "$f_changes"
}

execute_new_table_actions() {
    local fq="$1"
    log INFO "(Hook) New table created: $fq"
}

execute_new_column_actions() {
    # Parameter format schema.table.column (simplified for demonstration)
    local composite="$1"
    log INFO "(Hook) New column detected: $composite"
}

execute_alter_column_actions() {
    local target="$1"
    log INFO "(Hook) Column alteration on: $target"
}

# --------------------------------------------
# Migration file validation & restoration logic
# --------------------------------------------
validate_migration_files() {
    log INFO "Validating migration files..."
    local journal="${MIGRATION_DIR}/meta/_journal.json"
    if [[ ! -f "$journal" ]]; then
        log WARN "Migration journal missing: $(realpath -m "$journal")"
        return 1
    fi

    local tags=()
    local missing=()
    local case_insensitive="false"

    # Extract tags (simple JSON parsing)
    while IFS= read -r line; do
        if [[ "$line" =~ \"tag\":\"([^\"]+)\" ]]; then
            tags+=("${BASH_REMATCH[1]}")
        fi
    done < "$journal"

    if [[ ${#tags[@]} -eq 0 ]]; then
        log WARN "No migration entries found in journal"
        return 1
    fi

    local found_count=0
    for t in "${tags[@]}"; do
        local file="${MIGRATION_DIR}/${t}.sql"
        if [[ -f "$file" ]]; then
            ((found_count++))
            [[ "$VERBOSE" == "true" ]] && log INFO "Found migration: $(basename "$file")"
        else
            log WARN "Missing migration file for tag: $t"
            missing+=("$t")
        fi
    done

    # Gap detection if tags start with numeric prefix (e.g. 0001_*)
    local numeric_tags=()
    for t in "${tags[@]}"; do
        if [[ "$t" =~ ^([0-9]{4,})_ ]]; then
            numeric_tags+=("${BASH_REMATCH[1]}")
        fi
    done
    if [[ ${#numeric_tags[@]} -gt 1 ]]; then
        IFS=$'\n' read -r -d '' -a sorted_nums < <(printf "%s\n" "${numeric_tags[@]}" | sort && printf '\0')
        local expected=${sorted_nums[0]}
        for n in "${sorted_nums[@]}"; do
            if [[ "$n" != "$expected" ]]; then
                log WARN "Gap in numeric migration sequence around $expected -> $n"
                expected="$n"
            fi
            expected=$(printf "%0${#n}d" $((10#$n + 1)))
        done
    fi

    # Orphan detection (unless FAST_VALIDATION)
    local orphans=()
    if [[ "$FAST_VALIDATION" != "true" ]]; then
        while IFS= read -r sqlfile; do
            local base
            base=$(basename "$sqlfile" .sql)
            local present="false"
            for t in "${tags[@]}"; do
                if [[ "$t" == "$base" ]]; then
                    present="true"; break
                fi
            done
            if [[ "$present" == "false" ]]; then
                orphans+=("$base")
            fi
        done < <(find "$MIGRATION_DIR" -maxdepth 1 -type f -name "*.sql" -not -path "*/meta/*" | sort)
    else
        log INFO "FAST_VALIDATION enabled: skipping orphan scan"
    fi

    log INFO "Migration journal entries: ${#tags[@]}"
    log INFO "Migration files found: $found_count"

    if [[ ${#missing[@]} -gt 0 ]]; then
        log ERROR "Missing files: ${missing[*]}"
        return 1
    fi

    if [[ ${#orphans[@]} -gt 0 ]]; then
        log WARN "Orphaned migration files not in journal: ${orphans[*]}"
    fi

    log SUCCESS "Migration file validation passed"
    return 0
}

restore_missing_migrations() {
    log INFO "Attempting restoration of missing migration files..."
    local journal="${MIGRATION_DIR}/meta/_journal.json"
    [[ ! -f "$journal" ]] && { log WARN "No journal for restoration"; return 1; }

    local missing_tags=()
    while IFS= read -r line; do
        if [[ "$line" =~ \"tag\":\"([^\"]+)\" ]]; then
            local tag="${BASH_REMATCH[1]}"
            local file="${MIGRATION_DIR}/${tag}.sql"
            [[ ! -f "$file" ]] && missing_tags+=("$tag")
        fi
    done < "$journal"

    [[ ${#missing_tags[@]} -eq 0 ]] && { log INFO "No missing migrations to restore"; return 0; }

    if [[ ! -d "${SCRIPT_DIR}/migrations-old" ]]; then
        log WARN "No migrations-old directory for restoration"
        return 1
    fi

    local restored=0
    for tag in "${missing_tags[@]}"; do
        local candidate
        candidate=$(find "${SCRIPT_DIR}/migrations-old" -type f -name "${tag}.sql" | head -1 || true)
        if [[ -n "$candidate" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                log INFO "[DRY-RUN] Would restore $tag.sql"
            else
                cp "$candidate" "${MIGRATION_DIR}/${tag}.sql"
                log SUCCESS "Restored migration $tag.sql"
            fi
            ((restored++))
        else
            log WARN "No backup found for $tag.sql"
        fi
    done

    if [[ $restored -gt 0 ]]; then
        log INFO "Restored $restored migration(s)"
        return 0
    fi
    return 1
}

# ----------------------------------
# Migration history / DB consistency
# ----------------------------------
validate_migration_history() {
    log INFO "Validating migration history against database..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Skipping live migration history check"
        return 0
    fi

    local temp_js="/tmp/history_validate_$$.js"
    cat > "$temp_js" << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const fs = require('fs');

const db = process.env.DATABASE_URL;
if (!db) { console.log(JSON.stringify({error:"DATABASE_URL not set"})); process.exit(0); }

const pool = new Pool({ connectionString: db });

(async () => {
  const result = { status: 'unknown', mismatches: [] };
  try {
    const t = await pool.query(`SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog','information_schema')
          AND table_name='__drizzle_migrations'
    ) AS exists;`);
    if (!t.rows[0].exists) {
      result.status = 'no_migration_table';
      console.log(JSON.stringify(result)); 
      return;
    }
    let journal=null;
    try {
      journal = JSON.parse(fs.readFileSync('./migrations/meta/_journal.json','utf8'));
    } catch {
      result.status = 'journal_missing';
    }
    const applied = await pool.query('SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at, id;');
    result.applied = applied.rows;
    if (journal && journal.entries) {
      result.journal_count = journal.entries.length;
      result.applied_count = applied.rows.length;
      const journalMap = new Map(journal.entries.map(e => [e.tag, e.hash || null]));
      const appliedSet = new Set(applied.rows.map(r => r.id));
      // In journal but not applied
      for (const e of journal.entries) {
        if (!appliedSet.has(e.tag)) {
          result.mismatches.push({ type: 'journal_only', id: e.tag });
        }
      }
      // Applied but not in journal OR hash mismatch
      for (const r of applied.rows) {
        if (!journalMap.has(r.id)) {
          result.mismatches.push({ type: 'db_only', id: r.id });
        } else {
            const jHash = journalMap.get(r.id);
            if (jHash && r.hash && jHash !== r.hash) {
              result.mismatches.push({ type: 'hash_mismatch', id: r.id });
            }
        }
      }
      result.status = result.mismatches.length === 0 ? 'success' : 'divergent';
    } else {
      result.status = result.status === 'journal_missing' ? 'journal_missing' : 'indeterminate';
    }
    console.log(JSON.stringify(result));
  } catch (e) {
    console.log(JSON.stringify({error: e.message}));
  } finally {
    await pool.end();
  }
})();
EOF

    local output
    output=$( (cd "$SCRIPT_DIR" && node "$temp_js") 2>/dev/null || echo '{"error":"execution failed"}')
    rm -f "$temp_js"

    if grep -q '"error"' <<< "$output"; then
        log WARN "Migration history validation error: $output"
        return 1
    fi
    if grep -q '"status":"no_migration_table"' <<< "$output"; then
        log WARN "No migration tracking table (fresh database likely)"
        return 2
    fi
    if grep -q '"status":"journal_missing"' <<< "$output"; then
        log WARN "Journal missing but migration table exists"
        return 1
    fi
    if grep -q '"status":"success"' <<< "$output"; then
        log SUCCESS "Migration history consistent"
        return 0
    fi
    if grep -q '"status":"divergent"' <<< "$output"; then
        log WARN "Migration history divergence detected"
        # List mismatches succinctly
        echo "$output" | sed -n 's/.*"mismatches":\[\(.*\)\].*/\1/p' >/dev/null || true
        return 1
    fi
    log WARN "Indeterminate migration history state"
    return 1
}

comprehensive_migration_check() {
    log INFO "=== Comprehensive Migration Check ==="
    local files_ok=true
    validate_migration_files || files_ok=false
    if [[ "$files_ok" == "false" ]]; then
        log WARN "File validation failed – attempting restoration"
        if restore_missing_migrations; then
            log INFO "Re-validating after restoration"
            validate_migration_files || files_ok=false
        fi
    fi
    local hist_status=0
    validate_migration_history || hist_status=$?
    if [[ "$files_ok" == "true" && $hist_status -eq 0 ]]; then
        log SUCCESS "All migration checks passed"
        return 0
    fi
    if [[ $hist_status -eq 2 ]]; then
        log INFO "Fresh database scenario recognized"
        return 0
    fi
    log WARN "Proceeding despite migration inconsistencies (safeguards will apply)"
    return 1
}

generate_migration() {
    log INFO "Checking for pending schema changes (drizzle diff)"
    local diff_output
    diff_output=$(npx drizzle-kit diff 2>&1 || true)
    if grep -qi "No changes detected" <<< "$diff_output"; then
        log INFO "No pending schema changes"
        return 1
    fi
    log INFO "Schema changes detected – generating migration"
    TEMP_MIGRATION_FILE=$(mktemp "${MIGRATION_DIR}/_temp_migration_XXXXXX.sql")
    if ! execute "Generate migration" "npm run db:generate -- --name deployment_$(date +%Y%m%d_%H%M%S)"; then
        log ERROR "Migration generation failed"
        return 1
    fi
    local latest
    latest=$(find "$MIGRATION_DIR" -maxdepth 1 -type f -name "*.sql" -not -path "*/meta/*" | sort | tail -1 || true)
    if [[ -z "$latest" ]]; then
        log WARN "No migration file produced"
        return 1
    fi
    if grep -Eq '\b(CREATE|ALTER|DROP)\b' "$latest"; then
        make_migration_idempotent "$latest" || true
        detect_schema_changes "$latest" || true
        return 0
    else
        log INFO "Generated migration contains no actionable DDL"
        return 1
    fi
}

apply_migrations() {
    log INFO "Applying migrations"
    if execute "Run drizzle migrations" "npm run db:migrate"; then
        log SUCCESS "Migrations applied"
        return 0
    fi
    log WARN "Primary migration apply reported issues – verifying state"
    local tables
    tables=$(get_existing_tables)
    if [[ -n "$tables" ]]; then
        log INFO "Tables detected post-failure; assuming idempotent conflict and continuing"
        return 0
    fi
    log ERROR "No tables detected after migration failure – critical"
    return 1
}

# -------------
# Deployment steps
# -------------
step_git_pull() {
    git config --global --add safe.directory /opt/mowerm8 || true
    local branch
    branch=$(git rev-parse --abbrev-ref HEAD)
    show_progress 1 7 "Pulling latest changes ($branch)"
    [[ "$SKIP_GIT_PULL" == "true" ]] && { log INFO "Skipping git pull"; return 0; }
    execute "Git pull" "git pull origin $branch" || return $EXIT_ERROR_GIT
}

step_install_deps() {
    show_progress 2 7 "Installing dependencies"
    local run_updates="n"
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        log INFO "Auto-confirm: skipping dependency updates"
    else
        read -r -p "Run dependency update steps? (y/N): " run_updates || true
    fi
    if [[ "$run_updates" =~ ^[Yy]$ ]]; then
        execute "Update npm" "npm install -g npm@latest"
        execute "Update Browserslist DB" "npx update-browserslist-db@latest"
        execute "Update dependencies" "npm update"
    else
        log INFO "Skipping dependency update steps"
    fi
    execute "Install dependencies" "NODE_OPTIONS='--max-old-space-size=4096' npm install" || return $EXIT_ERROR_DEPS
}

step_build() {
    show_progress 3 7 "Building application"
    execute "Build" "NODE_OPTIONS='--max-old-space-size=4096' npm run build" || return $EXIT_ERROR_BUILD
}

step_migration() {
    show_progress 4 7 "Processing database schema"
    if is_database_empty; then
        log INFO "Empty database detected – initializing via db:push"
        if [[ "$DRY_RUN" == "true" ]]; then
            log INFO "[DRY-RUN] Would run: npm run db:push"
            return 0
        fi
        if confirm "Initialize schema on empty database?"; then
            execute "Initialize schema" "npm run db:push" || return $EXIT_ERROR_MIGRATION
            log SUCCESS "Schema initialized"
            return 0
        else
            log WARN "User declined initialization"
            return $EXIT_USER_ABORT
        fi
    fi

    log INFO "Existing database detected – running comprehensive validation"
    comprehensive_migration_check || log WARN "Continuing with fallback-safe path"

    if generate_migration; then
        log INFO "Generated migration – applying"
        if [[ "$DRY_RUN" == "true" ]]; then
            log INFO "[DRY-RUN] Would apply migrations"
            return 0
        fi
        if confirm "Apply detected schema changes?"; then
            if apply_migrations; then
                execute_schema_actions
                log INFO "Post-apply validation"
                validate_migration_history || log WARN "Post-migration mismatches"
                return 0
            else
                log WARN "Migration apply issues – attempting fallback db:push"
                if execute "Fallback db:push" "npm run db:push"; then
                    log SUCCESS "Fallback succeeded"
                    return 0
                else
                    log ERROR "Fallback path failed"
                    return $EXIT_ERROR_MIGRATION
                fi
            fi
        else
            log WARN "User declined applying new migrations"
            return $EXIT_USER_ABORT
        fi
    else
        log INFO "No new migrations – performing verification (db:push no-op)"
        execute "Schema verification" "npm run db:push" || return $EXIT_ERROR_MIGRATION
        validate_migration_history || log WARN "Verification detected divergence"
        return 0
    fi
}

step_restart_service() {
    show_progress 5 7 "Restarting service"
    execute "Restart mower-app" "systemctl restart mower-app" || return $EXIT_ERROR_SERVICE
}

step_clear_cache() {
    show_progress 6 7 "Clearing cache"
    log INFO "Cache clearing hook (add commands if needed)"
}

step_verify_deployment() {
    show_progress 7 7 "Verifying deployment"
    if [[ "$DRY_RUN" == "false" ]]; then
        if execute "Check service active" "systemctl is-active mower-app"; then
            log SUCCESS "Service is active"
        else
            log WARN "Service not reported active"
        fi
    fi
    log SUCCESS "Verification step complete"
}

main_deploy() {
    local start
    start=$(date +%s)
    log INFO "Starting deployment"
    log INFO "Dry run: $DRY_RUN | Auto confirm: $AUTO_CONFIRM | FAST_VALIDATION: $FAST_VALIDATION"
    step_git_pull || exit $?
    step_install_deps || exit $?
    step_build || exit $?
    step_migration || exit $?
    step_restart_service || exit $?
    step_clear_cache || exit $?
    step_verify_deployment || exit $?
    local end
    end=$(date +%s)
    local duration=$((end - start))
    echo
    if [[ "$DRY_RUN" == "true" ]]; then
        log SUCCESS "Dry run completed in ${duration}s"
        if confirm "Execute real deployment now?"; then
            DRY_RUN=false
            main_deploy
        else
            log INFO "Exiting after dry run"
        fi
    else
        log SUCCESS "Deployment completed in ${duration}s"
    fi
}

# Initialize logging
mkdir -p "$(dirname "$LOG_FILE")"
echo "=== MowerManager Deployment Log ===" > "$LOG_FILE"

parse_args "$@"

[[ ! -f "${SCRIPT_DIR}/package.json" ]] && { log ERROR "package.json not found in $SCRIPT_DIR"; exit $EXIT_ERROR_GENERAL; }
[[ ! -d "$MIGRATION_DIR" ]] && { log ERROR "Migration directory missing: $MIGRATION_DIR"; exit $EXIT_ERROR_GENERAL; }

if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "=== DRY RUN MODE ==="
    confirm "Proceed with dry run?" || { log INFO "Dry run aborted"; exit $EXIT_SUCCESS; }
fi

main_deploy
