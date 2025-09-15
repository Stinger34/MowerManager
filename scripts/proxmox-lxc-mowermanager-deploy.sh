#!/usr/bin/env bash
# Proxmox LXC deployment script for MowerManager_LXC
# This script must be run on the Proxmox host as root.

set -euo pipefail

# Configurable options
CTID=120
HOSTNAME="mowermanager"
STORAGE="local-lvm"
TEMPLATE="ubuntu-24.04-standard_24.04-1_amd64.tar.zst"
MEMORY="2048"
SWAP="2048"
CORES="2"
DISK="10"
APP_GIT="https://github.com/Stinger34/MowerManager.git"
APP_PATH="/opt/MowerManager"
NETWORK="name=eth0,bridge=vmbr0,ip=dhcp"
PG_DB="mower_db"
PG_USER="moweruser"
PORT="5000"
NODE_ENV="production"
DB_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)

# Download template if needed
pveam update
if ! pveam list | grep -q "$TEMPLATE"; then
  pveam download $STORAGE $TEMPLATE
fi

# Create the container -- ensure swap is set during creation per README Step 5
pct create $CTID $STORAGE:vztmpl/$TEMPLATE \
  --hostname $HOSTNAME \
  --cores $CORES \
  --memory $MEMORY \
  --swap $SWAP \
  --net0 $NETWORK \
  --rootfs $STORAGE:$DISK \
  --unprivileged 1 \
  --features nesting=1 \
  --start 1

# Setup app and DB inside the container (with error checking, schema privileges, schema push, and systemd autostart)
pct exec $CTID -- bash -eux <<EOF
# Update and install dependencies
apt update && apt upgrade -y

apt install -y git curl wget sudo python3 make g++ postgresql postgresql-contrib postgresql-client
if ! command -v psql >/dev/null; then
  echo "PostgreSQL installation failed!" && exit 1
fi

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
if ! command -v node >/dev/null; then
  echo "Node.js installation failed!" && exit 1
fi

# Setup PostgreSQL user and database with schema privileges
sudo -u postgres psql -c "CREATE USER $PG_USER WITH PASSWORD '$DB_PASSWORD';" || { echo "Failed to create DB user"; exit 1; }
sudo -u postgres psql -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" || { echo "Failed to create DB"; exit 1; }
sudo -u postgres psql -d $PG_DB -c "GRANT ALL PRIVILEGES ON SCHEMA public TO $PG_USER;" || { echo "Failed to grant privileges"; exit 1; }

# Clone and install app
git clone $APP_GIT $APP_PATH || { echo "Failed to clone app repo"; exit 1; }
cd $APP_PATH

# Create .env file
cat > .env <<ENV
DATABASE_URL=postgresql://$PG_USER:$DB_PASSWORD@localhost:5432/$PG_DB
PORT=$PORT
NODE_ENV=$NODE_ENV
ENV

# Install app dependencies
NODE_OPTIONS="--max-old-space-size=4096" npm install || { echo "npm install failed"; exit 1; }
NODE_OPTIONS="--max-old-space-size=4096" npm run build || { echo "npm run build failed"; exit 1; }

# Step 7: Push database schema
NODE_OPTIONS="--max-old-space-size=4096" npm run db:push || { echo "Schema push failed"; exit 1; }

# Create systemd service for autostart
cat >/etc/systemd/system/mowermanager.service <<SVC
[Unit]
Description=MowerManager_LXC Service
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=$APP_PATH
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=$NODE_ENV
Environment=PORT=$PORT
Environment=DATABASE_URL=postgresql://$PG_USER:$DB_PASSWORD@localhost:5432/$PG_DB

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable mowermanager
systemctl start mowermanager

# Check if app is listening on port
sleep 5
if ! ss -ltn | grep ":$PORT" >/dev/null; then
  echo "App did not start or not listening on port $PORT"
  exit 1
fi
EOF

# Get container IP
CT_IP=$(pct exec "$CTID" -- hostname -I | awk '{print $1}')

echo "---------------------------------------------------------------"
echo "Container $CTID deployed and MowerManager_LXC installed!"
echo "PostgreSQL user: $PG_USER"
echo "PostgreSQL DB:   $PG_DB"
echo "DB Password:     $DB_PASSWORD"
echo "App path:        $APP_PATH"
echo "Service:         mowermanager (systemd, autostart on boot)"
echo "---------------------------------------------------------------"
echo "Access your app at: http://$CT_IP:$PORT"
echo "---------------------------------------------------------------"
