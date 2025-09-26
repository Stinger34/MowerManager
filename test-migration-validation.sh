#!/usr/bin/env bash
# Test script for automated migration validation features

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    
    case "$level" in
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        INFO)  echo -e "${BLUE}[INFO]${NC} $message" ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        *) echo "[$level] $message" ;;
    esac
}

echo "=== Testing Automated Migration Validation Features ==="
echo

# Source the deploy.sh functions we need
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="${SCRIPT_DIR}/migrations"
DRY_RUN=true  # Always run in dry-run mode for testing

# Extract necessary functions from deploy.sh for testing
source <(grep -A 200 "^validate_migration_files()" deploy.sh | sed '/^[a-zA-Z_][a-zA-Z0-9_]*() {/q' | head -n -1)
source <(grep -A 200 "^validate_migration_history()" deploy.sh | sed '/^[a-zA-Z_][a-zA-Z0-9_]*() {/q' | head -n -1)
source <(grep -A 200 "^restore_missing_migrations()" deploy.sh | sed '/^[a-zA-Z_][a-zA-Z0-9_]*() {/q' | head -n -1)
source <(grep -A 200 "^comprehensive_migration_check()" deploy.sh | sed '/^[a-zA-Z_][a-zA-Z0-9_]*() {/q' | head -n -1)

echo "1. Testing Migration File Validation:"
echo "   Checking for migration files and gaps..."
validate_migration_files
echo

echo "2. Testing Migration History Validation:"
echo "   Validating migration journal against database (dry-run)..."
validate_migration_history
echo

echo "3. Testing Missing Migration Recovery:"
echo "   Checking ability to restore missing migrations..."
restore_missing_migrations
echo

echo "4. Testing Comprehensive Migration Check:"
echo "   Running full automated validation suite..."
comprehensive_migration_check
echo

echo "=== Test Complete ==="
echo "The enhanced deploy.sh script now provides:"
echo "• Automated migration file validation with gap detection"
echo "• Database migration history validation against actual state"
echo "• Automatic recovery of missing migration files from backups"
echo "• Comprehensive error messaging and manual intervention guidance"
echo "• Multiple fallback strategies for robust deployment"
echo "• Enhanced logging for troubleshooting migration issues"