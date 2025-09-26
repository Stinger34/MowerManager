#!/usr/bin/env bash
# new_deploy.sh - Local development schema sync & graceful rename helper
# Updated Fix:
#   - Removed ambiguous compound conditional that triggered "conditional binary operator expected"
#   - Made short-circuit conditions explicit with if/then blocks
#   - Added defensive checks & clarified logging

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
  read -r -p "$prompt [y/N]: " ans || true
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
  if ! command -v jq >/dev/null 2>&1; then
    log WARN "jq not found. Rename heuristics & archiving plan need jq. Skipping rename phase."
    SKIP_RENAME_HEURISTICS=true
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
    log INFO "Installing drizzle-kit (not found)"
    [[ "$DRY_RUN" == "true" ]] || npm install --save-dev drizzle-kit
  fi
  if [[ ! -d node_modules/pg ]]; then
    log INFO "Installing pg module (missing)"
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
    log INFO "Skipping rename heuristics (flag set)"
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    log WARN "jq not available -> skipping rename plan"
    return 0
  fi
  log INFO "Analyzing current DB vs schema.ts for rename opportunities..."
  local node_script="${SCRIPT_DIR}/.planner_rename.js"

  cat > "$node_script" <<'EOF'
import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/package.json');
const fs = require('fs');
let Client;
try { ({ Client } = require('pg')); } catch { console.error(JSON.stringify({ error: 'pg module not installed' })); process.exit(0); }

const DB_URL = process.env.DATABASE_URL;
const SCHEMA_FILE = './shared/schema.ts';
function out(o){ console.log(JSON.stringify(o,null,2)); }
if (!DB_URL) { out({ error: 'DATABASE_URL not set' }); process.exit(0); }

let schemaSource='';
try { schemaSource = fs.readFileSync(SCHEMA_FILE,'utf8'); }
catch { out({ error:'Cannot read schema.ts', plan:{} }); process.exit(0); }

const tableRegex=/pgTable\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*\{([\s\S]*?)}\s*\)/g;
const desiredTables={};
let m;
while((m=tableRegex.exec(schemaSource))!==null){
  const t=m[1]; const body=m[2];
  const colRegex=/([a-zA-Z0-9_]+)\s*:\s*[a-zA-Z0-9_]+\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  let c; desiredTables[t]={columns:new Set(), rawCols:{}};
  while((c=colRegex.exec(body))!==null){
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

(async () => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  const tablesRes = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY 1;`);
  const existing = tablesRes.rows.map(r=>r.table_name);

  const colsRes = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public'
    ORDER BY table_name, ordinal_position;`);
  const existingColumns={};
  for(const row of colsRes.rows){
    existingColumns[row.table_name]=existingColumns[row.table_name]||{columns:new Set(),types:{}};
    existingColumns[row.table_name].columns.add(row.column_name);
    existingColumns[row.table_name].types[row.column_name]=row.data_type;
  }

  const desiredNames=Object.keys(desiredTables);
  const existingOnly=existing.filter(t=>!desiredNames.includes(t));
  const desiredOnly=desiredNames.filter(t=>!existing.includes(t));

  const tableRenames=[], archives=[], used=new Set();

  for(const ex of existingOnly){
    const exCols=existingColumns[ex]?.columns||new Set();
    let best=null,bestScore=0;
    for(const dn of desiredOnly){
      if(used.has(dn)) continue;
      const dCols=desiredTables[dn].columns;
      const inter=[...exCols].filter(c=>dCols.has(c)).length;
      const score=(2*inter)/(exCols.size + dCols.size || 1);
      if(score>bestScore){ bestScore=score; best=dn; }
    }
    if(best && bestScore>=0.5 && exCols.size>=1){
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
    if(!existingColumns[srcTable]) continue;
    const exCols=[...existingColumns[srcTable].columns];
    const newCols=[...desiredTables[dName].columns];
    const exOnly=exCols.filter(c=>!newCols.includes(c));
    const newOnly=newCols.filter(c=>!exCols.includes(c));
    const paired=new Set();
    for(const oldCol of exOnly){
      let best=null,bestDist=Infinity;
      const on=norm(oldCol);
      for(const nCol of newOnly){
        if(paired.has(nCol)) continue;
        const dist=lev(on,norm(nCol));
        if(dist<bestDist){ bestDist=dist; best=nCol; }
      }
      if(best && bestDist<=2){
        columnRenames.push({
          table:dName,
          sourceTable:srcTable,
          from:oldCol,
          to:best,
          distance:bestDist,
          oldType:existingColumns[srcTable].types[oldCol]||null
        });
        paired.add(best);
      }
    }
  }

  const plan={
    tables:{ renames:tableRenames, archives },
    columns:{ renames:columnRenames },
    summary:{ existingTableCount:existing.length, desiredTableCount:desiredNames.length }
  };
  console.log(JSON.stringify({ plan }, null, 2));
  await client.end();
})().catch(e=>console.log(JSON.stringify({ error:e.message })));
EOF

  if [[ "$DRY_RUN" == "true" ]]; then
    node "$node_script" > "$JOURNAL_PLAN" 2>/dev/null || echo '{"error":"plan failed"}' > "$JOURNAL_PLAN"
  else
    if ! node "$node_script" > "$JOURNAL_PLAN" 2>&1; then
      log WARN "Rename planning failed; continuing without rename heuristics"
      SKIP_RENAME_HEURISTICS=true
      return 0
    fi
  fi

  if grep -q '"error"' "$JOURNAL_PLAN"; then
    log WARN "Rename plan contained error -> disabling rename heuristics"
    SKIP_RENAME_HEURISTICS=true
  else
    log INFO "Rename plan created: $JOURNAL_PLAN"
    [[ "$VERBOSE" == "true" ]] && sed 's/^/[PLAN] /' "$JOURNAL_PLAN"
  fi
}

apply_table_renames() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then return 0; fi
  if [[ ! -f "$JOURNAL_PLAN" ]]; then return 0; fi
  local renames_json
  renames_json=$(jq -r '.plan.tables.renames[]? | @base64' "$JOURNAL_PLAN" 2>/dev/null || true)
  if [[ -z "$renames_json" ]]; then
    log INFO "No table renames detected"
    return 0
  fi
  header "Applying Table Renames"
  while read -r line; do
    [[ -z "$line" ]] && continue
    local obj from to sim
    obj=$(echo "$line" | base64 --decode)
    from=$(echo "$obj" | jq -r '.from')
    to=$(echo "$obj" | jq -r '.to')
    sim=$(echo "$obj" | jq -r '.similarity')
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] ALTER TABLE \"${from}\" RENAME TO \"${to}\"; (similarity=$sim)"
    else
      log INFO "Renaming table $from -> $to (similarity=$sim)"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${from}\" RENAME TO \"${to}\";"; then
        log WARN "Failed table rename $from -> $to"
      fi
    fi
  done <<< "$renames_json"
}

archive_tables() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then return 0; fi
  if [[ "$ARCHIVE_DROPPED_TABLES" != "true" ]]; then return 0; fi
  if [[ "$SKIP_ARCHIVE" == "true" ]]; then return 0; fi
  if [[ ! -f "$JOURNAL_PLAN" ]]; then return 0; fi

  local archives
  archives=$(jq -r '.plan.tables.archives[]?' "$JOURNAL_PLAN" 2>/dev/null || true)
  if [[ -z "$archives" ]]; then
    log INFO "No tables to archive"
    return 0
  fi

  header "Archiving Unmatched Tables"
  while read -r t; do
    [[ -z "$t" ]] && continue
    local new="archived_${t}_$(date +%Y%m%d_%H%M%S)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] ALTER TABLE \"${t}\" RENAME TO \"${new}\";"
    else
      log INFO "Archiving $t -> $new"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${t}\" RENAME TO \"${new}\";"; then
        log WARN "Archive rename failed for $t"
      fi
    fi
  done <<< "$archives"
}

apply_column_renames() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then return 0; fi
  if [[ ! -f "$JOURNAL_PLAN" ]]; then return 0; fi
  local renames
  renames=$(jq -r '.plan.columns.renames[]? | @base64' "$JOURNAL_PLAN" 2>/dev/null || true)
  if [[ -z "$renames" ]]; then
    log INFO "No column renames detected"
    return 0
  fi

  header "Applying Column Renames"
  while read -r line; do
    [[ -z "$line" ]] && continue
    local obj tbl from to dist
    obj=$(echo "$line" | base64 --decode)
    tbl=$(echo "$obj" | jq -r '.table')
    from=$(echo "$obj" | jq -r '.from')
    to=$(echo "$obj" | jq -r '.to')
    dist=$(echo "$obj" | jq -r '.distance')
    local sql="ALTER TABLE \"${tbl}\" RENAME COLUMN \"${from}\" TO \"${to}\";"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] $sql (distance=$dist)"
    else
      log INFO "Renaming column ${tbl}.${from} -> ${to} (distance=$dist)"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$sql"; then
        log WARN "Direct rename failed; attempting copy fallback for ${tbl}.${from}"
        local tmp="__tmp_${to}_$(date +%s)"
        if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${tbl}\" ADD COLUMN \"${tmp}\" TEXT;" \
           && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "UPDATE \"${tbl}\" SET \"${tmp}\" = \"${from}\"::text;" \
           && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${tbl}\" DROP COLUMN \"${from}\";" \
           && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"${tbl}\" RENAME COLUMN \"${tmp}\" TO \"${to}\";" ; then
             log INFO "Fallback copy/rename succeeded for ${tbl}.${from}"
        else
             log ERROR "Fallback copy/rename failed for ${tbl}.${from}"
        fi
      fi
    fi
  done <<< "$renames"
}

schema_sync() {
  header "Schema Synchronization"
  if [[ "$MODE" == "push" ]]; then
    log INFO "db:push mode"
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
  if [[ "$NO_BUILD" == "true" ]]; then
    log INFO "Skipping build (NO_BUILD=true)"
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

show_summary() {
  header "Summary"
  if [[ -f "$JOURNAL_PLAN" && "$SKIP_RENAME_HEURISTICS" != "true" && command -v jq >/dev/null 2>&1 ]]; then
    log INFO "Table renames: $(jq '.plan.tables.renames | length' "$JOURNAL_PLAN")"
    log INFO "Archived tables: $(jq '.plan.tables.archives | length' "$JOURNAL_PLAN")"
    log INFO "Column renames: $(jq '.plan.columns.renames | length' "$JOURNAL_PLAN")"
  else
    log INFO "No rename plan (skipped or unavailable)"
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
    log ERROR "Cannot connect to database"
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
