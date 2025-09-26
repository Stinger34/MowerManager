#!/usr/bin/env bash
# new_deploy.sh (stable safe-mode version)
# Purpose: Local schema sync with optional rename/archive heuristics.
# All compound conditionals rewritten into explicit if blocks to avoid parsing errors.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --------------------
# Configuration (env or flags)
# --------------------
MODE="push"       # push | migrate
AUTO_CONFIRM="false"
DRY_RUN="false"
GENERATE_MIGRATION="false"
MIGRATION_NAME="auto_local_$(date +%Y%m%d_%H%M%S)"
NO_BUILD="false"
START_APP="false"
RESET_PUBLIC="false"
VERBOSE="false"
ARCHIVE_DROPPED_TABLES="true"
SKIP_ARCHIVE="false"
SKIP_RENAME_HEURISTICS="false"

LOG_FILE="${SCRIPT_DIR}/local_deploy.log"
PLAN_FILE="${SCRIPT_DIR}/.rename_plan.json"

# --------------------
# Color helpers
# --------------------
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
    DEBUG) if [[ "$VERBOSE" == "true" ]]; then echo -e "${C_DIM}[DEBUG] $msg${C_RESET}"; fi ;;
    *) echo "[LOG] $msg" ;;
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

# --------------------
# Argument parsing
# --------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --migrate) MODE="migrate"; shift ;;
    --push) MODE="push"; shift ;;
    --generate) GENERATE_MIGRATION="true"; MIGRATION_NAME="${2:-$MIGRATION_NAME}"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    --auto-confirm) AUTO_CONFIRM="true"; shift ;;
    --no-build) NO_BUILD="true"; shift ;;
    --start) START_APP="true"; shift ;;
    --reset-public) RESET_PUBLIC="true"; shift ;;
    --verbose) VERBOSE="true"; shift ;;
    --no-archive) ARCHIVE_DROPPED_TABLES="false"; shift ;;
    --skip-archive) SKIP_ARCHIVE="true"; shift ;;
    --no-rename) SKIP_RENAME_HEURISTICS="true"; shift ;;
    --plan-only) SKIP_RENAME_HEURISTICS="false"; NO_BUILD="true"; START_APP="false"; MODE="push"; DRY_RUN="true"; shift ;;
    --help)
      cat <<EOF
Usage: ./new_deploy.sh [options]

Options:
  --push                Use db:push (default)
  --migrate             Use db:migrate
  --generate NAME       Generate migration (implies migrate path)
  --dry-run             Preview actions
  --auto-confirm        Skip interactive confirmations
  --no-build            Skip build step
  --start               Start app after build
  --reset-public        Drop and recreate public schema (DANGEROUS)
  --verbose             Verbose debug logs
  --no-archive          Do not archive unmatched tables
  --skip-archive        Alias of --no-archive
  --no-rename           Disable rename heuristics entirely
  --plan-only           Produce plan (dry-run) and exit
  --help                Show this help
EOF
      exit 0
      ;;
    *)
      log WARN "Unknown argument: $1"
      shift
      ;;
  esac
done

# --------------------
# Environment load
# --------------------
load_env() {
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
    log INFO "Loaded .env"
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    log ERROR "DATABASE_URL not set"
    exit 1
  fi
}

# --------------------
# Dependency checks
# --------------------
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

# --------------------
# Dangerous reset
# --------------------
reset_public_schema() {
  if [[ "$RESET_PUBLIC" != "true" ]]; then return 0; fi
  if confirm "RESET_PUBLIC: Drop and recreate public schema? THIS DELETES DATA."; then
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    else
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
      log SUCCESS "Public schema reset"
    fi
  else
    log WARN "Public schema reset aborted"
  fi
}

# --------------------
# Rename plan generator
# --------------------
generate_plan() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then
    log INFO "Rename heuristics disabled"
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    log WARN "jq missing -> skipping rename plan"
    return 0
  fi

  log INFO "Generating rename plan..."
  local planner="${SCRIPT_DIR}/.planner_rename.js"

  cat > "$planner" <<'EOF'
import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/package.json');
const fs = require('fs');
let Client;
try { ({ Client } = require('pg')); } catch { console.log(JSON.stringify({ error:'pg module missing'})); process.exit(0); }

const DB_URL=process.env.DATABASE_URL;
if(!DB_URL){ console.log(JSON.stringify({ error:'DATABASE_URL not set'})); process.exit(0); }

let schemaSrc='';
try { schemaSrc=fs.readFileSync('./shared/schema.ts','utf8'); }
catch { console.log(JSON.stringify({ error:'Cannot read schema.ts'})); process.exit(0); }

const tableRegex=/pgTable\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*\{([\s\S]*?)}\s*\)/g;
const desired={};
let m;
while((m=tableRegex.exec(schemaSrc))!==null){
  const t=m[1], body=m[2];
  const colRegex=/([A-Za-z0-9_]+)\s*:\s*[A-Za-z0-9_]+\(\s*['"]([A-Za-z0-9_]+)['"]/g;
  let c;
  desired[t]={cols:new Set()};
  while((c=colRegex.exec(body))!==null){
    desired[t].cols.add(c[2]);
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

(async()=>{
  const client=new Client({connectionString:DB_URL});
  await client.connect();
  const tRes=await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;`);
  const existing=tRes.rows.map(r=>r.table_name);

  const cRes=await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;`);
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
    let best=null, bestScore=0;
    for(const dn of desiredOnly){
      if(used.has(dn)) continue;
      const dCols=desired[dn].cols;
      const inter=[...exCols].filter(x=>dCols.has(x)).length;
      const score=(2*inter)/(exCols.size + dCols.size || 1);
      if(score>bestScore){ bestScore=score; best=dn; }
    }
    if(best && bestScore>=0.5){
      tableRenames.push({ from:ex, to:best, similarity:+bestScore.toFixed(3) });
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
      for(const nC of newOnly){
        if(paired.has(nC)) continue;
        const dist=lev(on,norm(nC));
        if(dist<bestDist){ bestDist=dist; best=nC; }
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
      log WARN "Plan generation failed; disabling heuristics"
      SKIP_RENAME_HEURISTICS="true"
      return 0
    fi
  fi

  if grep -q '"error"' "$PLAN_FILE"; then
    log WARN "Plan file contains error; heuristics disabled"
    SKIP_RENAME_HEURISTICS="true"
  else
    log INFO "Plan written to $PLAN_FILE"
    if [[ "$VERBOSE" == "true" ]]; then sed 's/^/[PLAN] /' "$PLAN_FILE"; fi
  fi
}

apply_table_renames() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then return 0; fi
  if [[ ! -f "$PLAN_FILE" ]]; then return 0; fi
  local rows
  rows=$(jq -r '.plan.tables.renames[]? | @base64' "$PLAN_FILE" 2>/dev/null || true)
  if [[ -z "$rows" ]]; then
    log INFO "No table renames"
    return 0
  fi
  header "Table Renames"
  while read -r row; do
    [[ -z "$row" ]] && continue
    local from to sim
    from=$(echo "$row" | base64 --decode | jq -r '.from')
    to=$(echo "$row" | base64 --decode | jq -r '.to')
    sim=$(echo "$row" | base64 --decode | jq -r '.similarity')
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] ALTER TABLE \"$from\" RENAME TO \"$to\"; (sim=$sim)"
    else
      log INFO "Renaming $from -> $to (sim=$sim)"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$from\" RENAME TO \"$to\";"; then
        log WARN "Failed to rename $from -> $to"
      fi
    fi
  done <<< "$rows"
}

archive_tables() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then return 0; fi
  if [[ "$ARCHIVE_DROPPED_TABLES" != "true" ]]; then return 0; fi
  if [[ "$SKIP_ARCHIVE" == "true" ]]; then return 0; fi
  if [[ ! -f "$PLAN_FILE" ]]; then return 0; fi
  local list
  list=$(jq -r '.plan.tables.archives[]?' "$PLAN_FILE" 2>/dev/null || true)
  if [[ -z "$list" ]]; then
    log INFO "No archives required"
    return 0
  fi
  header "Archiving Unmatched Tables"
  while read -r t; do
    [[ -z "$t" ]] && continue
    local archive="archived_${t}_$(date +%Y%m%d_%H%M%S)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] ALTER TABLE \"$t\" RENAME TO \"$archive\";"
    else
      log INFO "Archiving $t -> $archive"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$t\" RENAME TO \"$archive\";"; then
        log WARN "Failed to archive $t"
      fi
    fi
  done <<< "$list"
}

apply_column_renames() {
  if [[ "$SKIP_RENAME_HEURISTICS" == "true" ]]; then return 0; fi
  if [[ ! -f "$PLAN_FILE" ]]; then return 0; fi
  local rows
  rows=$(jq -r '.plan.columns.renames[]? | @base64' "$PLAN_FILE" 2>/dev/null || true)
  if [[ -z "$rows" ]]; then
    log INFO "No column renames"
    return 0
  fi
  header "Column Renames"
  while read -r row; do
    [[ -z "$row" ]] && continue
    local table from to distance
    table=$(echo "$row" | base64 --decode | jq -r '.table')
    from=$(echo "$row" | base64 --decode | jq -r '.from')
    to=$(echo "$row" | base64 --decode | jq -r '.to')
    distance=$(echo "$row" | base64 --decode | jq -r '.distance')
    local sql="ALTER TABLE \"$table\" RENAME COLUMN \"$from\" TO \"$to\";"
    if [[ "$DRY_RUN" == "true" ]]; then
      log INFO "[DRY-RUN] $sql (distance=$distance)"
    else
      log INFO "Renaming column $table.$from -> $to (distance=$distance)"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$sql"; then
        log WARN "Direct rename failed for $table.$from; attempting fallback"
        local tmp="__tmp_${to}_$(date +%s)"
        if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$table\" ADD COLUMN \"$tmp\" TEXT;" \
           && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "UPDATE \"$table\" SET \"$tmp\" = \"$from\"::text;" \
           && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$table\" DROP COLUMN \"$from\";" \
           && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE \"$table\" RENAME COLUMN \"$tmp\" TO \"$to\";" ; then
             log INFO "Fallback copy/rename succeeded for $table.$from"
        else
             log ERROR "Fallback failed for $table.$from"
        fi
      fi
    fi
  done <<< "$rows"
}

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
  schema_sync
  build_phase
  start_app
  show_summary
}

main "$@"
