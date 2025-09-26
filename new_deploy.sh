#!/usr/bin/env bash
# new_deploy.sh - Local development schema sync & graceful rename helper
# Updated:
#   - Place temp Node script inside repo so require('pg') resolves
#   - Added dependency check (pg, drizzle-kit, jq)
#   - Graceful fallback if planner fails
#   - Optional SKIP_RENAME_HEURISTICS=true to bypass rename logic

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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
SKIP_RENAME_HEURISTICS="${SKIP_RENAME_HEURISTICS:-false}"

LOG_FILE="${SCRIPT_DIR}/local_deploy.log"
JOURNAL_PLAN="${SCRIPT_DIR}/.rename_plan.json"

C_BLUE='\033[0;34m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'; C_RED='\033[0;31m'; C_DIM='\033[2m'; C_RESET='\033[0m'

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

header() { echo -e "\n${C_GREEN}== $* ==${C_RESET}"; }

init_log() { echo "=== Local Deployment Log $(date) ===" > "$LOG_FILE"; }

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

ensure_dependencies() {
  header "Dependency Check"
  # jq
  if ! command -v jq >/dev/null 2>&1; then
    log WARN "jq not found. Install jq for full features (archives & plan parsing). Proceeding without jq will skip rename plan."
    SKIP_RENAME_HEURISTICS=true
  fi
  # node_modules presence
  if [[ ! -d node_modules ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] Would run: npm install"
    else
      log INFO "node_modules missing -> running npm install"
      npm install
    fi
  fi
  # drizzle-kit (migration/push)
  if ! npx --yes drizzle-kit --version >/dev/null 2>&1; then
    log INFO "Installing drizzle-kit (not found)"
    [[ "$DRY_RUN" == "true" ]] || npm install --save-dev drizzle-kit
  fi
  # pg module needed by server code & planner
  if [[ ! -d node_modules/pg ]]; then
    log INFO "Installing pg (missing)"
    [[ "$DRY_RUN" == "true" ]] || npm install pg
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

generate_rename_plan() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then
    log INFO "Skipping rename heuristics (SKIP_RENAME_HEURISTICS=true)"
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    log WARN "jq missing -> skipping rename plan"
    return 0
  fi
  log INFO "Analyzing current DB vs schema.ts for rename opportunities..."
  local node_script="${SCRIPT_DIR}/.planner_rename.js"

  cat > "$node_script" <<'EOF'
import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/package.json'); // ensure project root context
const fs = require('fs');
let Client;
try {
  ({ Client } = require('pg'));
} catch {
  console.error(JSON.stringify({ error: 'pg module not installed' }));
  process.exit(0);
}

const DB_URL = process.env.DATABASE_URL;
const SCHEMA_FILE = './shared/schema.ts';

function out(obj){ console.log(JSON.stringify(obj, null, 2)); }

if (!DB_URL) { out({ error: 'DATABASE_URL not set' }); process.exit(0); }

let schemaSource='';
try { schemaSource = fs.readFileSync(SCHEMA_FILE,'utf8'); }
catch { out({ error: 'Cannot read schema.ts', plan:{} }); process.exit(0); }

const tableRegex = /pgTable\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*\{([\s\S]*?)}\s*\)/g;
const desiredTables = {};
let m;
while ((m = tableRegex.exec(schemaSource)) !== null) {
  const t = m[1]; const body = m[2];
  const colRegex=/([a-zA-Z0-9_]+)\s*:\s*[a-zA-Z0-9_]+\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  let c;
  desiredTables[t]={columns:new Set(), rawCols:{}};
  while((c = colRegex.exec(body))!==null){
    desiredTables[t].columns.add(c[2]);
    desiredTables[t].rawCols[c[2]]={prop:c[1], db:c[2]};
  }
}

function lev(a,b){
  if(a===b) return 0;
  const al=a.length, bl=b.length;
  if(!al) return bl; if(!bl) return al;
  const v=[...Array(bl+1).keys()];
  for(let i=1;i<=al;i++){
    let prev=i, tmp;
    for(let j=1;j<=bl;j++){
      if(a[i-1]===b[j-1]) tmp=v[j-1];
      else tmp=Math.min(v[j-1]+1, prev+1, v[j]+1);
      v[j-1]=prev; prev=tmp;
    }
    v[bl]=prev;
  }
  return v[bl];
}
const norm = s => s.toLowerCase().replace(/_/g,'');

(async () => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  const tablesRes = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY 1;
  `);
  const existing = tablesRes.rows.map(r=>r.table_name);

  const colsRes = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public'
    ORDER BY table_name, ordinal_position;
  `);
  const existingColumns = {};
  for(const row of colsRes.rows){
    existingColumns[row.table_name] = existingColumns[row.table_name] || { columns:new Set(), types:{} };
    existingColumns[row.table_name].columns.add(row.column_name);
    existingColumns[row.table_name].types[row.column_name]=row.data_type;
  }

  const desiredNames = Object.keys(desiredTables);
  const existingOnly = existing.filter(t => !desiredNames.includes(t));
  const desiredOnly = desiredNames.filter(t => !existing.includes(t));

  const tableRenames=[];
  const archives=[];
  const usedDesired=new Set();

  for(const ex of existingOnly){
    const exCols = existingColumns[ex]?.columns || new Set();
    let best=null, bestScore=0;
    for(const dn of desiredOnly){
      if(usedDesired.has(dn)) continue;
      const dCols = desiredTables[dn].columns;
      const inter=[...exCols].filter(c=>dCols.has(c)).length;
      const score = (2*inter)/(exCols.size + dCols.size || 1);
      if(score>bestScore){ bestScore=score; best=dn; }
    }
    if(best && bestScore>=0.5 && exCols.size>=1){
      tableRenames.push({ from: ex, to: best, similarity:+bestScore.toFixed(3) });
      usedDesired.add(best);
    } else {
      archives.push(ex);
    }
  }

  const columnRenames=[];
  for(const dName of desiredNames){
    const mapping = tableRenames.find(r=>r.to===dName);
    const sourceTable = mapping ? mapping.from : dName;
    if(!existingColumns[sourceTable]) continue;
    const exCols=[...existingColumns[sourceTable].columns];
    const newCols=[...desiredTables[dName].columns];
    const exOnly=exCols.filter(c=>!newCols.includes(c));
    const newOnly=newCols.filter(c=>!exCols.includes(c));
    const paired=new Set();
    for(const oldCol of exOnly){
      let best=null, bestDist=Infinity;
      const on=norm(oldCol);
      for(const nCol of newOnly){
        if(paired.has(nCol)) continue;
        const dist=lev(on, norm(nCol));
        if(dist<bestDist){ bestDist=dist; best=nCol; }
      }
      if(best && bestDist<=2){
        columnRenames.push({
          table: dName,
          sourceTable,
          from: oldCol,
          to: best,
          distance: bestDist,
          oldType: existingColumns[sourceTable].types[oldCol] || null
        });
        paired.add(best);
      }
    }
  }

  const plan = {
    tables: { renames: tableRenames, archives },
    columns: { renames: columnRenames },
    summary: {
      existingTableCount: existing.length,
      desiredTableCount: desiredNames.length
    }
  };
  out({ plan });
  await client.end();
})().catch(e => out({ error: e.message }));
EOF

  if [[ "$DRY_RUN" == "true" ]]; then
    node "$node_script" > "$JOURNAL_PLAN" 2>/dev/null || echo '{"error":"plan failed"}' > "$JOURNAL_PLAN"
  else
    if ! node "$node_script" > "$JOURNAL_PLAN" 2>&1; then
      log WARN "Rename planning failed; proceeding without rename assistance."
      SKIP_RENAME_HEURISTICS=true
      return 0
    fi
  fi

  if grep -q '"error"' "$JOURNAL_PLAN"; then
    log WARN "Rename plan reported error → skipping rename phase"
    SKIP_RENAME_HEURISTICS=true
  else
    log INFO "Rename plan created ($JOURNAL_PLAN)"
    [[ "$VERBOSE" == "true" ]] && sed 's/^/[PLAN] /' "$JOURNAL_PLAN"
  fi

  # leave script for inspection; uncomment next line to auto-remove
  # rm -f "$node_script"
}

apply_table_renames() {
  [[ "$SKIP_RENAME_HEURISTICS" == "true" ]] && return 0
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
      log INFO "[DRY-RUN] ALTER TABLE \"${from}\" RENAME TO \"${to}\"; (similarity=$sim)"
    else
      log INFO "Renaming table $from -> $to (sim=$sim)"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${from}\" RENAME TO \"${to}\";"; then
        log WARN "Table rename $from -> $to failed; skipping"
      fi
    fi
  done
}

archive_tables() {
  [[ "$SKIP_RENAME_HEURISTICS" == "true" ]] && return 0
  [[ "$ARCHIVE_DROPPED_TABLES" == "true" ]] || [[ "$SKIP_ARCHIVE" == "true" ]] && return 0
  [[ -f "$JOURNAL_PLAN" ]] || return 0
  local archives
  archives=$(jq -r '.plan.tables.archives[]?' "$JOURNAL_PLAN" 2>/dev/null || true)
  [[ -z "$archives" ]] && return 0
  header "Archiving Orphaned Tables"
  for t in $archives; do
    local new="archived_${t}_$(date +%Y%m%d_%H%M%S)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] ALTER TABLE \"${t}\" RENAME TO \"${new}\";"
    else
      log INFO "Archiving $t -> $new"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${t}\" RENAME TO \"${new}\";"; then
        log WARN "Archive rename failed for $t"
      fi
    fi
  done
}

apply_column_renames() {
  [[ "$SKIP_RENAME_HEURISTICS" == "true" ]] && return 0
  [[ -f "$JOURNAL_PLAN" ]] || return 0
  local renames
  renames=$(jq -r '.plan.columns.renames[]? | @base64' "$JOURNAL_PLAN" 2>/dev/null || true)
  [[ -z "$renames" ]] && { log INFO "No column renames detected"; return 0; }
  header "Applying Column Renames"
  echo "$renames" | while read -r line; do
    local obj tbl srcTbl from to dist
    obj=$(echo "$line" | base64 --decode)
    tbl=$(echo "$obj" | jq -r '.table')
    srcTbl=$(echo "$obj" | jq -r '.sourceTable')
    from=$(echo "$obj" | jq -r '.from')
    to=$(echo "$obj" | jq -r '.to')
    dist=$(echo "$obj" | jq -r '.distance')

    local effective="$tbl"
    local renameSQL="ALTER TABLE \"${effective}\" RENAME COLUMN \"${from}\" TO \"${to}\";"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] $renameSQL (distance=$dist)"
    else
      log INFO "Renaming column ${effective}.${from} -> ${to} (dist=$dist)"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$renameSQL"; then
        log WARN "Direct column rename failed; attempting fallback (copy) for ${effective}.${from}"
        local tmp="__tmp_${to}_$(date +%s)"
        if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${effective}\" ADD COLUMN \"${tmp}\" TEXT;" \
          && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "UPDATE \"${effective}\" SET \"${tmp}\" = \"${from}\"::text;" \
          && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${effective}\" DROP COLUMN \"${from}\";" \
          && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${effective}\" RENAME COLUMN \"${tmp}\" TO \"${to}\";"; then
            log INFO "Fallback copy/rename succeeded for ${effective}.${from}"
        else
            log ERROR "Fallback copy/rename failed for ${effective}.${from}"
        fi
      fi
    fi
  done
}

schema_sync() {
  header "Schema Synchronization"
  if [[ "$MODE" == "push" ]]; then
    log INFO "Running db:push"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] npm run db:push"
    else
      npm run db:push || { log ERROR "db:push failed"; return 1; }
    fi
  else
    if [[ "$GENERATE_MIGRATION" == "true" ]]; then
      log INFO "Generating migration: $MIGRATION_NAME"
      if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] npm run db:generate -- --name \"$MIGRATION_NAME\""
      else
        npm run db:generate -- --name "$MIGRATION_NAME"
      fi
    fi
    log INFO "Applying migrations"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] npm run db:migrate"
    else
      npm run db:migrate
    fi
  fi
}

build_phase() {
  [[ "$NO_BUILD" == "true" ]] && { log INFO "Skipping build (NO_BUILD=true)"; return 0; }
  header "Build"
  if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "[DRY-RUN] npm run build"
  else
    npm run build
  fi
}

start_app() {
  [[ "$START_APP" != "true" ]] && return 0
  header "Start App"
  if [[ "$DRY_RUN" == "true" ]]; then
    log INFO "[DRY-RUN] npm start"
  else
    npm start
  fi
}

show_summary() {
  header "Summary"
  if [[ -f "$JOURNAL_PLAN" && "$SKIP_RENAME_HEURISTICS" != "true" && command -v jq >/dev/null 2>&1 ]]; then
    log INFO "Table renames: $(jq '.plan.tables.renames | length' "$JOURNAL_PLAN")"
    log INFO "Archived tables: $(jq '.plan.tables.archives | length' "$JOURNAL_PLAN")"
    log INFO "Column renames: $(jq '.plan.columns.renames | length' "$JOURNAL_PLAN")"
  else
    log INFO "No plan (skipped or unavailable)."
  fi
  log SUCCESS "Completed (MODE=$MODE DRY_RUN=$DRY_RUN)"
}

main() {
  init_log
  header "Local Schema Evolution Script"
  log INFO "MODE=$MODE DRY_RUN=$DRY_RUN AUTO_CONFIRM=$AUTO_CONFIRM VERBOSE=$VERBOSE"
  load_env
  ensure_dependencies
  reset_public_schema
  if ! psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    log ERROR "Cannot connect to database using DATABASE_URL"
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
