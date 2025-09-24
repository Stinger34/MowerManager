#!/bin/bash

set -e

echo "==== [MowerM8 Automated Install: Ubuntu 24.04+] ===="

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root (use sudo)." >&2
  exit 1
fi

echo
echo "Updating package list and upgrading..."
apt update && apt upgrade -y

echo
echo "Installing required system packages..."
apt install -y wget curl python3 make g++ git imagemagick ghostscript graphicsmagick

echo
echo "Removing existing Node.js (if present)..."
apt remove -y nodejs npm 2>/dev/null || true
apt autoremove -y

echo
echo "Installing Node.js 20 (LTS)..."
NODE_VERSION_REQUIRED=20
NODE_VERSION_BINARY="20.19.2"

# Try NodeSource first
if ! curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION_REQUIRED}.x | bash -; then
  echo "NodeSource setup script failed. Will try binary install."
fi
apt install -y nodejs || true

# Check if Node.js is installed and correct version
NODE_CURRENT=$(command -v node && node --version 2>/dev/null | cut -d'.' -f1 | cut -d'v' -f2 || echo "0")
if [ -z "$NODE_CURRENT" ] || [ "$NODE_CURRENT" -lt "$NODE_VERSION_REQUIRED" ]; then
  echo "Node.js version is insufficient or not installed. Installing Node.js ${NODE_VERSION_BINARY} from binary..."
  cd /tmp
  wget https://nodejs.org/dist/v${NODE_VERSION_BINARY}/node-v${NODE_VERSION_BINARY}-linux-x64.tar.xz
  tar -xJf node-v${NODE_VERSION_BINARY}-linux-x64.tar.xz -C /usr/local --strip-components=1
  rm node-v${NODE_VERSION_BINARY}-linux-x64.tar.xz
  ln -sf /usr/local/bin/node /usr/bin/node
  ln -sf /usr/local/bin/npm /usr/bin/npm
  ln -sf /usr/local/bin/npx /usr/bin/npx
fi

echo
echo "Node.js installed: $(node --version)"
echo "npm installed: $(npm --version)"

echo
echo "Installing PostgreSQL 16 (from Ubuntu 24.04 repositories)..."
apt install -y postgresql postgresql-contrib postgresql-client

echo
echo "Verifying PostgreSQL installation..."
if sudo -u postgres psql -c "SELECT version();" < /dev/null 2>/dev/null; then
    echo "PostgreSQL service is running."
else
    echo "ERROR: PostgreSQL is not responding correctly."
    exit 1
fi

echo
echo "==== [Step 4: PostgreSQL Database Config] ===="

# Set static values for DB name and user
DB_NAME="mower_db"
DB_USER="mower_user"

# Generate a secure random password for the database user
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '+/=')
echo "Generated database password: $DB_PASSWORD"
echo "NOTE: This password will be written to your application's .env file for use by the service."

echo
echo "Starting and enabling PostgreSQL service..."
systemctl start postgresql
systemctl enable postgresql

echo
echo "Creating database and user (if not exists)..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")
if [ "$DB_EXISTS" != "1" ]; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};"
fi

USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")
if [ "$USER_EXISTS" != "1" ]; then
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
else
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -c "ALTER USER ${DB_USER} CREATEDB;"

# Configure PostgreSQL to accept local connections with MD5 (password)
PG_VERSION=$(psql --version | grep -oE '[0-9]+' | head -1)
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
if ! grep -q "host all all 127.0.0.1/32 md5" "$PG_HBA"; then
    echo "host all all 127.0.0.1/32 md5" >> "$PG_HBA"
fi
systemctl restart postgresql

echo
echo "Testing connection with new database user..."
PGPASSWORD="$DB_PASSWORD" psql -U "${DB_USER}" -h localhost -d "${DB_NAME}" -c "SELECT current_user, current_database();" || {
    echo "ERROR: Cannot connect with new user credentials."
    exit 1
}

echo
echo "==== [Step 5] Application Setup: Cloning and Installing ===="

APP_DIR="/opt/mowerm8"
REPO_URL="https://github.com/Stinger34/MowerManager.git"

# Prompt for branch
echo "Which branch do you want to install?"
echo " [1] main"
echo " [2] dev"
echo " [3] canary"
read -p "Select branch [main]: " BRANCH_CHOICE

case "$BRANCH_CHOICE" in
  2|dev|Dev|DEV)
    REPO_BRANCH="dev"
    ;;
  3|canary|Canary|CANARY)
    REPO_BRANCH="canary"
    ;;
  *)
    REPO_BRANCH="main"
    ;;
esac

echo
echo "Selected branch: $REPO_BRANCH"

echo
echo "Creating application directory at $APP_DIR..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo
echo "Cloning repository..."
if [ "$REPO_BRANCH" = "main" ]; then
  git clone "$REPO_URL" .
else
  git clone -b "$REPO_BRANCH" --single-branch "$REPO_URL" .
fi

echo
echo "Creating swap space for npm install (prevents 'Killed' errors)..."
if ! swapon --show | grep -q '/swapfile'; then
  if [ -f /swapfile ]; then
    sudo swapoff /swapfile || true
    sudo rm -f /swapfile
  fi
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
  echo "Swap file already exists and is active."
fi

echo
echo "Verifying swap is active:"
free -h

echo
echo "Verifying swap is active:"
free -h

echo
echo "Installing dependencies (this may take several minutes)..."
if [ -f package-lock.json ]; then
  echo "Found package-lock.json; attempting 'npm ci' for exact dependency versions..."
  if NODE_OPTIONS="--max-old-space-size=4096" npm ci; then
    echo "npm ci completed successfully."
  else
    echo "npm ci failed; falling back to 'npm install'..."
    NODE_OPTIONS="--max-old-space-size=4096" npm install
  fi
else
  echo "No package-lock.json found; using 'npm install'..."
  NODE_OPTIONS="--max-old-space-size=4096" npm install
fi

echo
echo "Building application..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo
echo "==== [Step 6] Environment File, DB Schema, and Service Setup ===="

# Create .env file with the correct values
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}" > /opt/mowerm8/.env
echo "NODE_ENV=production" >> /opt/mowerm8/.env
echo "PORT=5000" >> /opt/mowerm8/.env

echo "Created .env file with the following content:"
cat /opt/mowerm8/.env

echo
echo "Setting up database schema (npm run db:push)..."
cd /opt/mowerm8
if NODE_OPTIONS="--max-old-space-size=4096" npm run db:push; then
  echo "Database schema pushed successfully."
else
  echo "Database schema push encountered an issue. If you see data-loss warnings, try:"
  echo "  NODE_OPTIONS=\"--max-old-space-size=4096\" npm run db:push -- --force"
fi

echo
echo "Creating systemd service for automated startup..."
cat > /etc/systemd/system/mower-app.service <<EOF
[Unit]
Description=Mower Management Application
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mowerm8
Environment=NODE_ENV=production
EnvironmentFile=/opt/mowerm8/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mower-app
systemctl start mower-app

echo
echo "Service status:"
systemctl status mower-app --no-pager

echo
echo "==== [Final Step] Credentials Reference ===="
echo "Your generated database password (for reference):"
echo "$DB_PASSWORD"
echo "It is stored in /opt/mowerm8/.env and used by the application service."

echo
echo "Access the web interface from any LAN device using:"
IP_ADDR=$(hostname -I | awk '{print $1}')
echo "Web Interface: http://${IP_ADDR}:5000"
