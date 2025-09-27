#!/usr/bin/env bash
# new_deploy.sh  (Local Development Deployment & Schema Helper)
#
# Purpose:
#   - Quick local deployment helper for the MowerManager app
#   - Safely evolves DB schema using drizzle (push or migrate)
#   - Optional heuristic table/column rename assistance (requires jq)
#   - Automatic foreign‑key repair for asset_parts.engine_id -> engines.id
#   - Minimal, resilient, and idempotent for local iteration
#
# Key Features:
#   • Loads .env and ensures DATABASE_URL present
#   • Dependency verification (node_modules, drizzle-kit, pg, optional jq)
#   • Optional: rename heuristics (table/column) if jq installed
#   • Automatic FK orphan repair (placeholder or nullify) before schema sync
#   • Supports modes: push (default) or migrate (with optional generate)
#   • Dry-run preview mode
#   • Archive unmatched tables (rename to archived_<table>_<timestamp>)
#   • Safe fallback if jq missing (rename heuristics disabled)
#
# Environment / Flags:
#   MODE=push|migrate                (default push)
#   GENERATE_MIGRATION=true          (with MODE=migrate)
#   MIGRATION_NAME=<name>            (defaults auto timestamp)
#   DRY_RUN=true                     (preview only)
#   AUTO_CONFIRM=true                (skip confirmations)
#   NO_BUILD=true                    (skip build step)
#   START_APP=true                   (run npm start at end)
#   RESET_PUBLIC=true                (drop & recreate public schema)
#   VERBOSE=true                     (extra debug output)
#   SKIP_RENAME_HEURISTICS=true      (disable rename planning)
#   ARCHIVE_DROPPED_TABLES=false     (disable archiving)
#   SKIP_ARCHIVE=true                (alias to skip archiving)
#   FK_REPAIR_MODE=placeholder|nullify|skip (default placeholder)
#
# CLI Options (override env):
#   --migrate --push --generate <name> --dry-run --auto-confirm --no-build
#   --start --reset-public --verbose --no-archive --skip-archive
#   --no-rename --plan-only --help
#
# Exit Codes: 0 success / 1 generic failure
#
# NOTE: This script aims to preserve data (archives orphans, creates placeholder engines).
#       Always inspect logs when schema changes occur.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---------------------------------------------------------------------------
# Default configuration (can be overridden via env or flags)
# ---------------------------------------------------------------------------
MODE="${MODE:-push}"                # push | migrate
AUTO_CONFIRM="${AUTO_CONFIRM:-false}"
DRY_RUN="${DRY_RUN:-false}"
GENERATE_MIGRATION="${GENERATE_MIGRATION:-false}"
MIGRATION_NAME="${MIGRATION_NAME:-auto_local_$(date +%Y%m%d_%H%M%S)}"
NO_BUILD="${NO_BUILD:-false}"
START_APP="${START_APP:-false}"
RESET_PUBLIC="${RESET_PUBLIC:-false}"
VERBOSE="${VERBOSE:-false}"
SKIP_RENAME_HEURISTICS="${SKIP_RENAME_HEURISTICS:-false}"
ARCHIVE_DROPPED_TABLES="${ARCHIVE_DROPPED_TABLES:-true}"
SKIP_ARCHIVE="${SKIP_ARCHIVE:-false}"
FK_REPAIR_MODE="${FK_REPAIR_MODE:-placeholder}"   # placeholder|nullify|skip

LOG_FILE="${SCRIPT_DIR}/local_deploy.log"
PLAN_FILE="${SCRIPT_DIR}/.rename_plan.json"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
C_BLUE='\033[0;34m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'
C_RED='\033[0;31m'; C_DIM='\033[2m'; C_RESET='\033[0m'

# ---------------------------------------------------------------------------
# Logging / Utilities
# ---------------------------------------------------------------------------
log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  case "$level" in
    INFO)    echo -e "${C_BLUE}[INFO]${C_RESET} $msg" ;;
    WARN)    echo -e "${C_YELLOW}[WARN]${C_RESET} $msg" ;;
    ERROR)   echo -e "${C_RED}[ERROR]${C_RESET} $msg" ;;
    SUCCESS) echo -e "${C_GREEN}[SUCCESS]${C_RESET} $msg" ;;
    DEBUG)   [[ "$VERBOSE" == "true" ]] && echo -e "${C_DIM}[DEBUG] $msg${C_RESET}" ;;
    *)       echo "[LOG] $msg" ;;
  esac
  echo "[$ts] [$level] $msg" >> "$LOG_FILE"
}

header() { echo -e "\n${C_GREEN}== $* ==${C_RESET}"; }

confirm() {
  local prompt="$1"
  if [[ "$AUTO_CONFIRM" == "true" ]]; then
    log INFO "Auto-confirm: $prompt"
    return 0
  fi
  read -r -p "$prompt [y/N]: " ans || true
  [[ "$ans" =~ ^[Yy]$ ]]
}

init_log() { echo "=== Local Deployment Log $(date) ===" > "$LOG_FILE"; }

# ---------------------------------------------------------------------------
# Argument Parsing (fixed esac & shift usage)
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --migrate) MODE="migrate" ;;
    --push) MODE="push" ;;
    --generate)
      GENERATE_MIGRATION="true"
      shift
      if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
        MIGRATION_NAME="$1"
      else
        log WARN "No migration name provided after --generate; using $MIGRATION_NAME"
        (( $# > 0 )) && set -- "$1" "$@"
      fi
      ;;
    --dry-run) DRY_RUN="true" ;;
    --auto-confirm) AUTO_CONFIRM="true" ;;
    --no-build) NO_BUILD="true" ;;
    --start) START_APP="true" ;;
    --reset-public) RESET_PUBLIC="true" ;;
    --verbose) VERBOSE="true" ;;
    --no-archive|--skip-archive) ARCHIVE_DROPPED_TABLES="false"; SKIP_ARCHIVE="true" ;;
    --no-rename) SKIP_RENAME_HEURISTICS="true" ;;
    --plan-only) SKIP_RENAME_HEURISTICS="false"; NO_BUILD="true"; START_APP="false"; MODE="push"; DRY_RUN="true" ;;
    --help)
      cat <<EOF
Usage: ./new_deploy.sh [options]

Options:
  --push / --migrate          Select schema sync mode
  --generate <name>           Generate migration (implies migrate path)
  --dry-run                   Preview actions
  --auto-confirm              Skip interactive prompts
  --no-build                  Skip build
  --start                     Start the app after sync
  --reset-public              Drop & recreate public schema (DESTRUCTIVE)
  --verbose                   More debug logs
  --no-archive | --skip-archive   Disable archiving of unmatched tables
  --no-rename                 Disable rename heuristics
  --plan-only                 Produce plan (dry-run) then exit
  --help                      Show this help
EOF
      exit 0
      ;;
    *)
      log WARN "Unknown argument ignored: $1"
      ;;
  esac
  shift || true
done

# ---------------------------------------------------------------------------
# Environment Loading
# ---------------------------------------------------------------------------
load_env() {
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
    log INFO "Loaded .env"
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    log ERROR "DATABASE_URL not set (define in .env or export before running)"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Dependency Check
# ---------------------------------------------------------------------------
ensure_deps() {
  header "Dependency Check"
  if ! command -v jq >/dev/null 2>&1; then
    log WARN "jq not found -> rename heuristics disabled"
    SKIP_RENAME_HEURISTICS="true"
  fi
  if [[ ! -d node_modules ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] Would run: npm install"
    else
      log INFO "Installing dependencies (node_modules missing)"
      npm install
    fi
  fi
  if ! npx --yes drizzle-kit --version >/dev/null 2>&1; then
    log INFO "Installing drizzle-kit"
    [[ "$DRY_RUN" == "true" ]] || npm install --save-dev drizzle-kit
  fi
  if [[ ! -d node_modules/pg ]]; then
    log INFO "Installing pg module"
    [[ "$DRY_RUN" == "true" ]] || npm install pg
  fi
}

# ---------------------------------------------------------------------------
# Reset public schema (dangerous)
# ---------------------------------------------------------------------------
reset_public_schema() {
  if [[ "$RESET_PUBLIC" != "true" ]]; then return 0; fi
  if confirm "RESET PUBLIC SCHEMA? This DROPS all tables. Continue?"; then
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    else
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
      log SUCCESS "Public schema reset"
    fi
  else
    log WARN "Reset aborted"
  fi
}

# ---------------------------------------------------------------------------
# Rename Plan Generation (Table/Column) — requires jq
# ---------------------------------------------------------------------------
generate_plan() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then
    log INFO "Rename heuristics disabled"
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    log WARN "jq missing -> cannot generate rename plan"
    return 0
  fi

  log INFO "Generating rename/column plan..."
  local planner="${SCRIPT_DIR}/.planner_rename.js"
  cat > "$planner" <<'EOF'
import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/package.json');
const fs = require('fs');
let Client;
try { ({ Client } = require('pg')); } catch { console.log(JSON.stringify({ error:'pg module missing'})); process.exit(0); }

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.log(JSON.stringify({ error:'DATABASE_URL not set'})); process.exit(0); }

let schemaSrc = '';
try { schemaSrc = fs.readFileSync('./shared/schema.ts','utf8'); }
catch { console.log(JSON.stringify({ error:'Cannot read schema.ts'})); process.exit(0); }

const tableRegex=/pgTable\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*\{([\s\S]*?)}\s*\)/g;
const desired = {};
let m;
while ((m = tableRegex.exec(schemaSrc)) !== null) {
  const t=m[1], body=m[2];
  const colRegex=/([A-Za-z0-9_]+)\s*:\s*[A-Za-z0-9_]+\(\s*['"]([A-Za-z0-9_]+)['"]/g;
  let c; desired[t]={ cols:new Set() };
  while((c=colRegex.exec(body))!==null){ desired[t].cols.add(c[2]); }
}

function lev(a,b){
  if(a===b) return 0;
  const al=a.length, bl=b.length;
  if(!al) return bl; if(!bl) return al;
  const v=[...Array(bl+1).keys()];
  for(let i=1;i<=al;i++){
    let prev=i,tmp;
    for(let j=1;j<=bl;j++){
      if(a[i-1]===b[j-1]) tmp=v[j-1];
      else tmp=Math.min(v[j-1]+1, prev+1, v[j]+1);
      v[j-1]=prev; prev=tmp;
    }
    v[bl]=prev;
  }
  return v[bl];
}
const norm=s=>s.toLowerCase().replace(/_/g,'');

(async()=>{
  const client=new Client({connectionString:DB_URL});
  await client.connect();

  const tRes=await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY 1;
  `);
  const existing=tRes.rows.map(r=>r.table_name);

  const cRes=await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema='public'
    ORDER BY table_name, ordinal_position;
  `);
  const exColsMap={};
  for(const r of cRes.rows){
    exColsMap[r.table_name]=exColsMap[r.table_name]||new Set();
    exColsMap[r.table_name].add(r.column_name);
  }

  const desiredNames=Object.keys(desired);
  const existingOnly=existing.filter(t=>!desiredNames.includes(t));
  const desiredOnly=desiredNames.filter(t=>!existing.includes(t));

  const tableRenames=[], archives=[], used=new Set();
  for(const ex of existingOnly){
    const exCols=exColsMap[ex]||new Set();
    let best=null,bestScore=0;
    for(const dn of desiredOnly){
      if(used.has(dn)) continue;
      const dCols=desired[dn].cols;
      const inter=[...exCols].filter(x=>dCols.has(x)).length;
      const score=(2*inter)/(exCols.size + dCols.size || 1);
      if(score>bestScore){ bestScore=score; best=dn; }
    }
    if(best && bestScore>=0.5){
      tableRenames.push({ from:ex,to:best, similarity:+bestScore.toFixed(3) });
      used.add(best);
    } else {
      archives.push(ex);
    }
  }

  const columnRenames=[];
  for(const dName of desiredNames){
    const mapping=tableRenames.find(r=>r.to===dName);
    const srcTable=mapping?mapping.from:dName;
    const exCols=[...(exColsMap[srcTable]||[])];
    const newCols=[...desired[dName].cols];
    const exOnly=exCols.filter(c=>!newCols.includes(c));
    const newOnly=newCols.filter(c=>!exCols.includes(c));
    const paired=new Set();
    for(const oldCol of exOnly){
      let best=null,bestDist=Infinity;
      const on=norm(oldCol);
      for(const nn of newOnly){
        if(paired.has(nn)) continue;
        const dist=lev(on,norm(nn));
        if(dist<bestDist){ bestDist=dist; best=nn; }
      }
      if(best && bestDist<=2){
        columnRenames.push({ table:dName, from:oldCol, to:best, distance:bestDist });
        paired.add(best);
      }
    }
  }

  console.log(JSON.stringify({ plan:{
    tables:{ renames:tableRenames, archives },
    columns:{ renames:columnRenames },
    summary:{ existing:existing.length, desired:desiredNames.length }
  }}));
  await client.end();
})().catch(e=>console.log(JSON.stringify({ error:e.message })));
EOF

  if [[ "$DRY_RUN" == "true" ]]; then
    node "$planner" > "$PLAN_FILE" 2>/dev/null || echo '{"error":"plan failed"}' > "$PLAN_FILE"
  else
    if ! node "$planner" > "$PLAN_FILE" 2>&1; then
      log WARN "Plan generation failed; disabling rename heuristics"
      SKIP_RENAME_HEURISTICS="true"
      return 0
    fi
  fi

  if grep -q '"error"' "$PLAN_FILE"; then
    log WARN "Plan file contains error; disabling rename heuristics"
    SKIP_RENAME_HEURISTICS="true"
  else
    log INFO "Plan saved: $PLAN_FILE"
    [[ "$VERBOSE" == "true" ]] && sed 's/^/[PLAN] /' "$PLAN_FILE"
  fi
}

# ---------------------------------------------------------------------------
# Apply Table Renames
# ---------------------------------------------------------------------------
apply_table_renames() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]] || [[ ! -f "$PLAN_FILE" ]]; then return 0; fi
  local rows
  rows=$(jq -r '.plan.tables.renames[]? | @base64' "$PLAN_FILE" 2>/dev/null || true)
  [[ -z "$rows" ]] && { log INFO "No table renames"; return 0; }
  header "Table Renames"
  while read -r r; do
    [[ -z "$r" ]] && continue
    local from to sim
    from=$(echo "$r" | base64 --decode | jq -r '.from')
    to=$(echo "$r" | base64 --decode | jq -r '.to')
    sim=$(echo "$r" | base64 --decode | jq -r '.similarity')
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] ALTER TABLE \"$from\" RENAME TO \"$to\"; (sim=$sim)"
    else
      log INFO "Renaming $from -> $to (sim=$sim)"
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$from\" RENAME TO \"$to\";" || log WARN "Failed rename $from"
    fi
  done <<< "$rows"
}

# ---------------------------------------------------------------------------
# Archive Unmatched Tables
# ---------------------------------------------------------------------------
archive_tables() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]] || [[ "$ARCHIVE_DROPPED_TABLES" != "true" ]] || [[ "$SKIP_ARCHIVE" == "true" ]] || [[ ! -f "$PLAN_FILE" ]]; then
    return 0
  fi
  local list
  list=$(jq -r '.plan.tables.archives[]?' "$PLAN_FILE" 2>/dev/null || true)
  [[ -z "$list" ]] && { log INFO "No tables to archive"; return 0; }
  header "Archiving Tables"
  while read -r t; do
    [[ -z "$t" ]] && continue
    local new="archived_${t}_$(date +%Y%m%d_%H%M%S)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] ALTER TABLE \"$t\" RENAME TO \"$new\";"
    else
      log INFO "Archiving $t -> $new"
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$t\" RENAME TO \"$new\";" || log WARN "Archive failed $t"
    fi
  done <<< "$list"
}

# ---------------------------------------------------------------------------
# Apply Column Renames
# ---------------------------------------------------------------------------
apply_column_renames() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]] || [[ ! -f "$PLAN_FILE" ]]; then return 0; fi
  local rows
  rows=$(jq -r '.plan.columns.renames[]? | @base64' "$PLAN_FILE" 2>/dev/null || true)
  [[ -z "$rows" ]] && { log INFO "No column renames"; return 0; }
  header "Column Renames"
  while read -r r; do
    [[ -z "$r" ]] && continue
    local table from to distance
    table=$(echo "$r" | base64 --decode | jq -r '.table')
    from=$(echo "$r" | base64 --decode | jq -r '.from')
    to=$(echo "$r" | base64 --decode | jq -r '.to')
    distance=$(echo "$r" | base64 --decode | jq -r '.distance')
    local sql="ALTER TABLE \"$table\" RENAME COLUMN \"$from\" TO \"$to\";"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] $sql (distance=$distance)"
    else
      log INFO "Renaming column $table.$from -> $to (dist=$distance)"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$sql"; then
        log WARN "Direct rename failed; attempting fallback"
        local tmp="__tmp_${to}_$(date +%s)"
        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$table\" ADD COLUMN \"$tmp\" TEXT;" \
          && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "UPDATE \"$table\" SET \"$tmp\" = \"$from\"::text;" \
          && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$table\" DROP COLUMN \"$from\";" \
          && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$table\" RENAME COLUMN \"$tmp\" TO \"$to\";" \
          || log ERROR "Fallback failed for $table.$from"
      fi
    fi
  done <<< "$rows"
}

# ---------------------------------------------------------------------------
# Foreign Key Repair (asset_parts.engine_id -> engines.id)
# ---------------------------------------------------------------------------
repair_asset_parts_engine_fk() {
  log INFO "Checking orphan engine_id references (FK repair mode: $FK_REPAIR_MODE)..."
  local orphan_count
  orphan_count=$(psql "$DATABASE_URL" -At -c "
    SELECT COUNT(*)
    FROM asset_parts ap
    LEFT JOIN engines e ON e.id = ap.engine_id
    WHERE ap.engine_id IS NOT NULL
      AND e.id IS NULL;
  " 2>/dev/null || echo "0")

  if [[ "$orphan_count" == "0" ]]; then
    log INFO "No orphan engine_id values."
    return 0
  fi

  log WARN "Detected $orphan_count orphan engine_id value(s)."

  case "$FK_REPAIR_MODE" in
    placeholder)
      if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would create placeholder engine rows."
      else
        psql "$DATABASE_URL" <<'SQL'
WITH missing AS (
  SELECT DISTINCT ap.engine_id
  FROM asset_parts ap
  LEFT JOIN engines e ON e.id = ap.engine_id
  WHERE ap.engine_id IS NOT NULL
    AND e.id IS NULL
)
INSERT INTO engines (id, name, model, created_at)
SELECT m.engine_id,
       CONCAT('Placeholder Engine ', m.engine_id),
       'pending',
       NOW()
FROM missing m
ORDER BY m.engine_id;
SQL
        # Adjust sequence if table uses serial/identity
        psql "$DATABASE_URL" -c "SELECT setval(pg_get_serial_sequence('engines','id'), (SELECT MAX(id) FROM engines));" >/dev/null 2>&1 || true
        log SUCCESS "Inserted placeholder engines."
      fi
      ;;
    nullify)
      if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would nullify orphan engine_id references."
      else
        psql "$DATABASE_URL" -c "
          UPDATE asset_parts ap
          SET engine_id = NULL
          WHERE engine_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM engines e WHERE e.id = ap.engine_id);
        "
        log SUCCESS "Nullified orphan engine_id values."
      fi
      ;;
    skip)
      log WARN "Skipping FK repair; db:push may fail if constraint enforced."
      ;;
    *)
      log ERROR "Invalid FK_REPAIR_MODE: $FK_REPAIR_MODE (expected placeholder|nullify|skip)"
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Schema Sync (Push or Migrate)
# ---------------------------------------------------------------------------
schema_sync() {
  header "Schema Sync"
  if [[ "$MODE" == "push" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] npm run db:push"
    else
      npm run db:push || { log ERROR "db:push failed"; return 1; }
    fi
  else
    if [[ "$GENERATE_MIGRATION" == "true" ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] npm run db:generate -- --name \"$MIGRATION_NAME\""
      else
        npm run db:generate -- --name "$MIGRATION_NAME"
      fi
    fi
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] npm run db:migrate"
    else
      npm run db:migrate
    fi
  fi
}

# ---------------------------------------------------------------------------
# Build / Start
# ---------------------------------------------------------------------------
build_phase() {
  if [[ "$NO_BUILD" == "true" ]]; then
    log INFO "Skipping build (--no-build)"
    return 0
  fi
  header "Build"
  if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "[DRY-RUN] npm run build"
  else
    npm run build
  fi
}

start_app() {
  if [[ "$START_APP" != "true" ]]; then return 0; fi
  header "Start App"
  if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "[DRY-RUN] npm start"
  else
    npm start
  fi
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
show_summary() {
  header "Summary"
  if [[ -f "$PLAN_FILE" && "$SKIP_RENAME_HEURISTICS" != "true" && $(command -v jq || echo "") ]]; then
    log INFO "Table renames: $(jq '.plan.tables.renames | length' "$PLAN_FILE")"
    log INFO "Archived tables: $(jq '.plan.tables.archives | length' "$PLAN_FILE")"
    log INFO "Column renames: $(jq '.plan.columns.renames | length' "$PLAN_FILE")"
  else
    log INFO "No plan or heuristics disabled"
  fi
  log SUCCESS "Completed (MODE=$MODE DRY_RUN=$DRY_RUN)"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  init_log
  header "Local Schema Evolution Script"
  log INFO "MODE=$MODE DRY_RUN=$DRY_RUN AUTO_CONFIRM=$AUTO_CONFIRM VERBOSE=$VERBOSE"
  load_env
  ensure_deps
  if ! psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    log ERROR "Cannot connect to database with DATABASE_URL"
    exit 1
  fi
  reset_public_schema
  generate_plan
  apply_table_renames
  apply_column_renames
  archive_tables
  repair_asset_parts_engine_fk
  schema_sync
  build_phase
  start_app
  show_summary
}

main "$@"
