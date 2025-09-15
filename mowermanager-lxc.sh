#!/usr/bin/env bash
# Robust Proxmox LXC installer for MowerManager (Node.js/React/Postgres)
# Inspired by community-scripts/ProxmoxVE and Homarr install method

# Source helper functions (colors, error handling, container build, etc.)
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)

APP="MowerManager"
var_tags="${var_tags:-nodejs;postgres;react;typescript}"
var_cpu="${var_cpu:-2}"
var_ram="${var_ram:-4096}"
var_disk="${var_disk:-20}"
var_os="${var_os:-ubuntu}"
var_version="${var_version:-24.04}"
var_unprivileged="${var_unprivileged:-1}"

header_info "$APP"
variables
color
catch_errors

# If CTID not set, use the next available one from pvesh
if [ -z "$CTID" ]; then
  CTID=$(pvesh get /cluster/nextid)
fi
export CTID

### --- LXC Creation ---
build_container

### --- Container Setup ---
msg_info "Starting LXC setup for $APP..."

pct start $CT_ID
sleep 5
IP=$(pct exec $CT_ID -- hostname -I | awk '{print $1}')

msg_ok "LXC Container started with IP $IP"

### --- Dependency Install ---
msg_info "Installing dependencies in container..."

pct exec $CT_ID -- bash -c "
  apt update && apt upgrade -y
  apt install -y wget curl git python3 make g++ sudo
  apt remove -y nodejs npm 2>/dev/null || true
  apt autoremove -y
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  apt install -y postgresql postgresql-contrib postgresql-client
  apt install -y build-essential
"

msg_ok "Dependencies installed"

### --- PostgreSQL Setup ---
msg_info "Configuring PostgreSQL..."

DB_PASSWORD=$(openssl rand -base64 32)
pct exec $CT_ID -- bash -c "
  systemctl start postgresql
  systemctl enable postgresql
  sudo -u postgres psql << EOF
CREATE DATABASE mower_db;
CREATE USER mower_user WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE mower_db TO mower_user;
ALTER USER mower_user CREATEDB;
\q
EOF
  sudo -u postgres psql -d mower_db -c 'GRANT ALL ON SCHEMA public TO mower_user;'
  PG_VERSION=\$(psql --version | grep -oE '[0-9]+' | head -1)
  echo 'host all all 127.0.0.1/32 md5' >> /etc/postgresql/\${PG_VERSION}/main/pg_hba.conf
  systemctl restart postgresql
"

msg_ok "PostgreSQL configured"

### --- Application Setup ---
msg_info "Setting up application..."

pct exec $CT_ID -- bash -c "
  mkdir -p /opt/mower-app
"

# If you want to use git clone, provide your repo below!
GIT_REPO="https://github.com/Sting17/MowerManager_LXC.git"

pct exec $CT_ID -- bash -c "
  cd /opt/mower-app
  git clone $GIT_REPO .
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  NODE_OPTIONS='--max-old-space-size=4096' npm install
  NODE_OPTIONS='--max-old-space-size=4096' npm run build
"

msg_ok "Application dependencies installed and built"

### --- Environment Setup ---
msg_info "Creating .env file..."

pct exec $CT_ID -- bash -c "
  cat > /opt/mower-app/.env << EOF
DATABASE_URL=postgresql://mower_user:$DB_PASSWORD@localhost:5432/mower_db
NODE_ENV=production
PORT=5000
EOF
"

msg_ok ".env file created"

### --- Database Schema Setup ---
msg_info "Pushing database schema..."

pct exec $CT_ID -- bash -c "
  cd /opt/mower-app
  npm run db:push
"

msg_ok "Database schema pushed"

### --- Systemd Service Setup ---
msg_info "Configuring systemd service..."

pct exec $CT_ID -- bash -c "
  cat > /etc/systemd/system/mower-app.service << EOF
[Unit]
Description=MowerManager Application
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mower-app
EnvironmentFile=/opt/mower-app/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable mower-app
  systemctl start mower-app
"

msg_ok "Systemd service configured and started"

### --- Final Output ---
msg_ok "Installation complete!"
echo "------------------------------------------------------"
echo "MowerManager should now be accessible at: http://$IP:5000"
echo "Check systemd logs for status: pct exec $CT_ID -- journalctl -u mower-app -f"
echo "------------------------------------------------------"

exit 0
