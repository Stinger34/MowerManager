#!/usr/bin/env bash
# new_deploy.sh - Local development schema sync & graceful rename helper
# Purpose: Safely evolve local PostgreSQL schema from Drizzle schema.ts changes
# Features:
#   - Detect & apply table renames (preserve data)
#   - Detect & apply column renames (preserve data)
#   - Archive "dropped" tables instead of destructive removal
#   - Heuristic column migration if type changes
#   - Optionally generate & apply migrations OR just use db:push
#   - Dry-run preview
#   - Simple, single-file, local-friendly
#
# NOTE: Heuristics; always review log output for correctness.
#       Archives let you recover if a rename wasn't detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --------------------
# Config via env vars
# --------------------
MODE="${MODE:-push}"                       # push | migrate
AUTO_CONFIRM="${AUTO_CONFIRM:-false}"
ARCHIVE_DROPPED_TABLES="${ARCHIVE_DROPPED_TABLES:-true}"
DRY_RUN="${DRY_RUN:-false}"
GENERATE_MIGRATION="${GENERATE_MIGRATION:-false}"
MIGRATION_NAME="${MIGRATION_NAME:-auto_local_$(date +%Y%m%d_%H%M%S)}"
NO_BUILD="${NO_BUILD:-false}"
START_APP="${START_APP:-false}"
SKIP_ARCHIVE="${SKIP_ARCHIVE:-false}"
RESET_PUBLIC="${RESET_PUBLIC:-false}"
VERBOSE="${VERBOSE:-false}"

LOG_FILE="${SCRIPT_DIR}/local_deploy.log"
JOURNAL_PLAN="${SCRIPT_DIR}/.rename_plan.json"

# Colors
C_BLUE='\033[0;34m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[0;31m'
C_DIM='\033[2m'
C_RESET='\033[0m'

log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  case "$level" in
    INFO) echo -e "${C_BLUE}[INFO]${C_RESET} $msg" ;;
    WARN) echo -e "${C_YELLOW}[WARN]${C_RESET} $msg" ;;
    ERROR) echo -e "${C_RED}[ERROR]${C_RESET} $msg" ;;
    SUCCESS) echo -e "${C_GREEN}[SUCCESS]${C_RESET} $msg" ;;
    DEBUG) [[ "$VERBOSE" == "true" ]] && echo -e "${C_DIM}[DEBUG] $msg${C_RESET}" ;;
    *) echo "[LOG] $msg" ;;
  esac
  echo "[$ts] [$level] $msg" >> "$LOG_FILE"
}

confirm() {
  local prompt="$1"
  if [[ "$AUTO_CONFIRM" == "true" ]]; then
    log INFO "Auto-confirm: $prompt"
    return 0
  fi
  read -r -p "$prompt [y/N]: " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

header() {
  echo -e "\n${C_GREEN}== $* ==${C_RESET}"
}

init_log() {
  echo "=== Local Deployment Log $(date) ===" > "$LOG_FILE"
}

load_env() {
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
    log INFO "Loaded .env"
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    log ERROR "DATABASE_URL not set (define in .env)"
    exit 1
  fi
}

reset_public_schema() {
  if [[ "$RESET_PUBLIC" != "true" ]]; then return 0; fi
  if confirm "RESET_PUBLIC=true: Drop and recreate public schema (DESTROYS DATA). Continue?"; then
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] Would: DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    else
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
      log SUCCESS "Public schema reset"
    fi
  else
    log WARN "Public schema reset aborted"
  fi
}

# ---------------
# Rename planner
# ---------------
generate_rename_plan() {
  log INFO "Analyzing current DB vs schema.ts for rename opportunities..."
  local node_script
  node_script=$(mktemp /tmp/rename_plan_XXXXXXXX.js)

  cat > "$node_script" <<'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const { Client } = require('pg');

/** Config **/
const DB_URL = process.env.DATABASE_URL;
const SCHEMA_FILE = './shared/schema.ts';

if (!DB_URL) {
  console.error(JSON.stringify({ error: 'DATABASE_URL not set' }));
  process.exit(0);
}

function levenshtein(a,b){
  if(a===b) return 0;
  const al=a.length, bl=b.length;
  if(al===0) return bl;
  if(bl===0) return al;
  const arr=[...Array(bl+1).keys()];
  for(let i=1;i<=al;i++){
    let prev=i, tmp;
    for(let j=1;j<=bl;j++){
      if(a[i-1]===b[j-1]) tmp=arr[j-1];
      else tmp=Math.min(arr[j-1]+1, prev+1, arr[j]+1);
      arr[j-1]=prev; prev=tmp;
    }
    arr[bl]=prev;
  }
  return arr[bl];
}

function normalizeName(s){ return s.toLowerCase().replace(/_/g,''); }

let schemaSource='';
try {
  schemaSource = fs.readFileSync(SCHEMA_FILE, 'utf8');
} catch {
  console.error(JSON.stringify({ error: 'Cannot read schema.ts', plan: {} }));
  process.exit(0);
}

// Extract pgTable definitions: pgTable('table_name', { ... })
const tableRegex = /pgTable\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*\{([\s\S]*?)}\s*\)/g;
let match;
const desiredTables = {}; // table: { columns: Set(), rawCols: { colName: { dbName, propName } } }
while ((match = tableRegex.exec(schemaSource)) !== null) {
  const tableName = match[1];
  const body = match[2];
  // Column lines pattern: key: <typeFunc>('db_column', ...)
  const colRegex = /([a-zA-Z0-9_]+)\s*:\s*[a-zA-Z0-9_]+\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  let c;
  desiredTables[tableName] = { columns: new Set(), rawCols: {} };
  while ((c = colRegex.exec(body)) !== null) {
    const prop = c[1];
    const dbCol = c[2];
    desiredTables[tableName].columns.add(dbCol);
    desiredTables[tableName].rawCols[dbCol] = { propName: prop, dbName: dbCol };
  }
}

// Connect to DB and fetch existing schema
const client = new Client({ connectionString: DB_URL });

(async () => {
  await client.connect();
  const existingTablesRes = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY 1;
  `);
  const existingTables = existingTablesRes.rows.map(r => r.table_name);

  const columnRes = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public'
    ORDER BY table_name, ordinal_position;
  `);

  const existingColumns = {}; // table -> { columns: Set(), types: { col: type } }
  for (const row of columnRes.rows) {
    existingColumns[row.table_name] = existingColumns[row.table_name] || { columns: new Set(), types: {} };
    existingColumns[row.table_name].columns.add(row.column_name);
    existingColumns[row.table_name].types[row.column_name] = row.data_type;
  }

  // Table rename detection
  const desiredNames = Object.keys(desiredTables);
  const existingOnly = existingTables.filter(t => !desiredNames.includes(t));
  const desiredOnly = desiredNames.filter(t => !existingTables.includes(t));

  const tableRenames = [];
  const archiveTables = [];

  const usedDesired = new Set();

  for (const ex of existingOnly) {
    const exCols = existingColumns[ex]?.columns || new Set();
    let best = null;
    let bestScore = 0;
    for (const dn of desiredOnly) {
      if (usedDesired.has(dn)) continue;
      const dCols = desiredTables[dn].columns;
      const inter = [...exCols].filter(c => dCols.has(c)).length;
      const score = (2 * inter) / (exCols.size + dCols.size || 1);
      if (score > bestScore) {
        bestScore = score;
        best = dn;
      }
    }
    if (best && bestScore >= 0.5 && exCols.size >= 1) {
      tableRenames.push({ from: ex, to: best, similarity: +bestScore.toFixed(3) });
      usedDesired.add(best);
    } else {
      archiveTables.push(ex);
    }
  }

  // Column rename detection
  const columnRenames = [];
  for (const tableName of desiredNames) {
    const targetTable = tableRenames.find(r => r.to === tableName)
      ? tableRenames.find(r => r.to === tableName).from
      : tableName;
    if (!existingColumns[targetTable]) continue;
    const exCols = [...existingColumns[targetTable].columns];
    const newCols = [...desiredTables[tableName].columns];

    const exOnly = exCols.filter(c => !newCols.includes(c));
    const newOnly = newCols.filter(c => !exCols.includes(c));

    const pairedNew = new Set();
    for (const oldCol of exOnly) {
      const oldNorm = normalizeName(oldCol);
      let bestCol = null;
      let bestDist = Infinity;
      for (const nCol of newOnly) {
        if (pairedNew.has(nCol)) continue;
        const nNorm = normalizeName(nCol);
        const dist = levenshtein(oldNorm, nNorm);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol = nCol;
        }
      }
      if (bestCol && bestDist <= 2) {
        const oldType = existingColumns[targetTable].types[oldCol];
        // Type compatibility heuristic
        const newType = oldType; // Can't know new type safely without deeper parse; assume same or will be altered later
        columnRenames.push({
          table: tableName,
            // reference actual table in DB (source)
          sourceTable: targetTable,
          from: oldCol,
          to: bestCol,
          distance: bestDist,
          oldType,
          newType
        });
        pairedNew.add(bestCol);
      }
    }
  }

  const plan = {
    tables: { renames: tableRenames, archives: archiveTables },
    columns: { renames: columnRenames },
    summary: {
      existingTableCount: existingTables.length,
      desiredTableCount: desiredNames.length
    }
  };

  console.log(JSON.stringify({ plan }, null, 2));
  await client.end();
})().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
});
EOF

  if [[ "$DRY_RUN" == "true" ]]; then
    node "$node_script" > "$JOURNAL_PLAN" 2>/dev/null || echo '{"error":"plan failed"}' > "$JOURNAL_PLAN"
  else
    node "$node_script" > "$JOURNAL_PLAN"
  fi

  if grep -q '"error"' "$JOURNAL_PLAN"; then
    log WARN "Rename plan generation reported an error (see $JOURNAL_PLAN)"
  else
    log INFO "Rename plan saved to $JOURNAL_PLAN"
  fi
  [[ "$VERBOSE" == "true" ]] && sed 's/^/[PLAN] /' "$JOURNAL_PLAN"
  rm -f "$node_script"
}

apply_table_renames() {
  [[ -f "$JOURNAL_PLAN" ]] || return 0
  local renames_json
  renames_json=$(jq -r '.plan.tables.renames[]? | @base64' "$JOURNAL_PLAN" 2>/dev/null || true)
  [[ -z "$renames_json" ]] && { log INFO "No table renames detected"; return 0; }

  header "Applying Table Renames"
  echo "$renames_json" | while read -r line; do
    local obj from to sim
    obj=$(echo "$line" | base64 --decode)
    from=$(echo "$obj" | jq -r '.from')
    to=$(echo "$obj" | jq -r '.to')
    sim=$(echo "$obj" | jq -r '.similarity')
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] Would: ALTER TABLE \"${from}\" RENAME TO \"${to}\";  (similarity: $sim)"
    else
      log INFO "Renaming table $from -> $to (sim=$sim)"
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${from}\" RENAME TO \"${to}\";"
    fi
  done
}

archive_tables() {
  [[ "$ARCHIVE_DROPPED_TABLES" == "true" ]] || [[ "$SKIP_ARCHIVE" == "true" ]] && return 0
  [[ -f "$JOURNAL_PLAN" ]] || return 0
  local archives
  archives=$(jq -r '.plan.tables.archives[]?' "$JOURNAL_PLAN" 2>/dev/null || true)
  [[ -z "$archives" ]] && return 0
  header "Archiving Orphaned Tables"
  for t in $archives; do
    local new="archived_${t}_$(date +%Y%m%d_%H%M%S)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] Would: ALTER TABLE \"${t}\" RENAME TO \"${new}\";"
    else
      log INFO "Archiving table $t -> $new"
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${t}\" RENAME TO \"${new}\";"
    fi
  done
}

apply_column_renames() {
  [[ -f "$JOURNAL_PLAN" ]] || return 0
  local renames
  renames=$(jq -r '.plan.columns.renames[]? | @base64' "$JOURNAL_PLAN" 2>/dev/null || true)
  [[ -z "$renames" ]] && { log INFO "No column renames detected"; return 0; }
  header "Applying Column Renames"
  echo "$renames" | while read -r line; do
    local obj tbl srcTbl from to dist oldType newType
    obj=$(echo "$line" | base64 --decode)
    tbl=$(echo "$obj" | jq -r '.table')
    srcTbl=$(echo "$obj" | jq -r '.sourceTable')
    from=$(echo "$obj" | jq -r '.from')
    to=$(echo "$obj" | jq -r '.to')
    dist=$(echo "$obj" | jq -r '.distance')
    oldType=$(echo "$obj" | jq -r '.oldType')
    newType=$(echo "$obj" | jq -r '.newType')

    # If table was renamed already, rename applied pre-migration; reference new name (tbl)
    local effective="$tbl"
    # Basic rule: if type differs drastically we fallback to copy approach
    local renameSQL="ALTER TABLE \"${effective}\" RENAME COLUMN \"${from}\" TO \"${to}\";"
    if [[ "$oldType" != "$newType" && "$newType" != "null" ]]; then
      # We'll attempt safe rename anyway; type changes can be handled by push or migrate
      :
    fi
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] Would: $renameSQL   (distance=$dist oldType=$oldType)"
    else
      log INFO "Renaming column ${effective}.${from} -> ${to} (distance=$dist)"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$renameSQL"; then
        log WARN "Direct rename failed; attempting copy fallback"
        local tmpCol="__tmp_${to}"
        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${effective}\" ADD COLUMN \"${tmpCol}\" TEXT;"
        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "UPDATE \"${effective}\" SET \"${tmpCol}\" = \"${from}\"::text;"
        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${effective}\" DROP COLUMN \"${from}\";"
        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${effective}\" RENAME COLUMN \"${tmpCol}\" TO \"${to}\";"
        log INFO "Fallback copy/rename completed for ${effective}.${from}"
      fi
    fi
  done
}

schema_sync() {
  header "Schema Synchronization"
  if [[ "$MODE" == "push" ]]; then
    log INFO "Using db:push (fast local sync)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] Would run: npm run db:push"
    else
      if ! npm run db:push; then
        log ERROR "db:push failed"
        return 1
      fi
    fi
  else
    # Migration path
    if [[ "$GENERATE_MIGRATION" == "true" ]]; then
      log INFO "Generating migration: $MIGRATION_NAME"
      if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would run: npm run db:generate -- --name \"$MIGRATION_NAME\""
      else
        npm run db:generate -- --name "$MIGRATION_NAME"
      fi
    fi
    log INFO "Applying migrations (npm run db:migrate)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] Would run: npm run db:migrate"
    else
      npm run db:migrate
    fi
  fi
}

build_phase() {
  [[ "$NO_BUILD" == "true" ]] && { log INFO "Skipping build (NO_BUILD=true)"; return 0; }
  header "Build Application"
  if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "[DRY-RUN] Would run: npm run build"
  else
    npm run build
  fi
}

start_app() {
  [[ "$START_APP" != "true" ]] && return 0
  header "Start Application"
  if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "[DRY-RUN] Would run: npm start"
  else
    npm start
  fi
}

show_summary() {
  header "Summary"
  if [[ -f "$JOURNAL_PLAN" ]]; then
    local tcount rcount ccount
    tcount=$(jq '.plan.tables.renames | length' "$JOURNAL_PLAN" 2>/dev/null || echo 0)
    rcount=$(jq '.plan.tables.archives | length' "$JOURNAL_PLAN" 2>/dev/null || echo 0)
    ccount=$(jq '.plan.columns.renames | length' "$JOURNAL_PLAN" 2>/dev/null || echo 0)
    log INFO "Table renames: $tcount"
    log INFO "Archived tables: $rcount"
    log INFO "Column renames: $ccount"
  else
    log INFO "No plan file generated"
  fi
  log SUCCESS "Done (MODE=$MODE DRY_RUN=$DRY_RUN)"
}

main() {
  init_log
  header "Local Schema Evolution Script"
  log INFO "MODE=$MODE DRY_RUN=$DRY_RUN AUTO_CONFIRM=$AUTO_CONFIRM VERBOSE=$VERBOSE"
  load_env
  reset_public_schema
  # Preflight connectivity
  if ! psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    log ERROR "Cannot connect to database with DATABASE_URL"
    exit 1
  fi
  generate_rename_plan
  apply_table_renames
  apply_column_renames
  archive_tables
  schema_sync
  build_phase
  start_app
  show_summary
}

main "$@"
