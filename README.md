# Automated Proxmox LXC Deployment

You can deploy MowerManager_LXC automatically on your Proxmox host with a single command:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Sting17/MowerManager_LXC/main/proxmox-lxc-mowermanager-deploy.sh)
```

Or, using wget:

```bash
wget -qO - https://raw.githubusercontent.com/Sting17/MowerManager_LXC/main/proxmox-lxc-mowermanager-deploy.sh | bash
```

This will create and configure a Proxmox LXC container, install all dependencies, set up PostgreSQL, deploy the application, and enable autostart.

---

# Running in Proxmox LXC Container

This guide provides instructions for running the Mower Management application in a Proxmox LXC container using Ubuntu 24.04 LTS (Noble Numbat).

## Application Overview

- **Type**: Full-stack Node.js application with React frontend and Express backend
- **Database**: PostgreSQL with Drizzle ORM
- **Main Technologies**: TypeScript, React, Express, Vite, TailwindCSS
- **Runtime**: Node.js 20+ required
- **Network**: Local LAN access only (no internet exposure required)

## Prerequisites

- Proxmox Virtual Environment (PVE) host
- Access to Proxmox web interface
- Basic knowledge of LXC container management

## Ubuntu 24.04 Benefits

This guide is optimized for Ubuntu 24.04 LTS (Noble Numbat) which provides:
- **PostgreSQL 16** as the default version (no complex repository setup needed)
- **Long-term support** until April 2029
- **Modern package versions** with improved security and performance
- **Simplified installation** compared to older Ubuntu versions

## 📦 Proxmox LXC Container Setup

### 1. Create LXC Container via Proxmox Web Interface

**Using the Proxmox LXC Creation Wizard:**

1. **Navigate to Proxmox Web Interface** → Select your node → **Create CT**

2. **General Tab:**
   - **CT ID**: Choose available ID (e.g., 100)
   - **Hostname**: `mower-app`
   - **Password**: Set root password
   - ✅ **Unprivileged container**: Recommended for security

3. **Template Tab:**
   - **Storage**: local
   - **Template**: `ubuntu-24.04-standard`

4. **Disks Tab:**
   - **Storage**: local-lvm (or your preferred storage)
   - **Disk size**: 20GB (minimum recommended)

5. **CPU Tab:**
   - **Cores**: 2 (minimum recommended)

6. **Memory Tab:**
   - **Memory**: 4096MB (4GB recommended for npm install/build)
   - **Swap**: 2048MB (helps prevent memory issues)

7. **Network Tab:** ⭐ **CRITICAL SETTING**
   - **Bridge**: `vmbr0` (default bridge to your LAN)
   - **IPv4**: DHCP (gets IP from your router automatically)
   - **IPv6**: DHCP (optional)
   - **Firewall**: ❌ **Disabled** (for initial setup)

8. **DNS Tab:** (Use defaults or your preferred DNS)
   - **DNS domain**: Your local domain or leave blank
   - **DNS servers**: 8.8.8.8, 1.1.1.1

9. **Confirm Tab:** Review settings and **Create**

10. **Start the Container** and note the assigned IP address

### 2. Access the Container

```bash
# From Proxmox web interface: Container → Console
# Or via SSH (after container starts):
ssh root@<container-ip>

# Or from Proxmox host command line:
pct enter <CT-ID>
```

### 3. Install System Dependencies

Once inside the LXC container:

```bash
# Update package list
apt update && apt upgrade -y

# Install Node.js 20 (required for this application)
# Ubuntu 24.04 comes with Node.js 18 by default, but we need Node.js 20 LTS
# Remove any existing Node.js from Ubuntu repos
apt remove -y nodejs npm 2>/dev/null || true
apt autoremove -y

# Install wget/curl if not present
apt install -y wget curl

# Method 1: NodeSource repository (recommended for Ubuntu 24.04)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Method 2: Direct binary download (fallback if NodeSource fails)
if ! command -v node &> /dev/null || [[ $(node --version | cut -d'.' -f1 | cut -d'v' -f2) -lt 20 ]]; then
    echo "NodeSource installation failed or version too low, trying binary download..."
    NODE_VERSION="20.19.2"
    wget https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
    tar -xJf node-v${NODE_VERSION}-linux-x64.tar.xz -C /usr/local --strip-components=1
    rm node-v${NODE_VERSION}-linux-x64.tar.xz

    # Create symlinks for compatibility
    ln -sf /usr/local/bin/node /usr/bin/node
    ln -sf /usr/local/bin/npm /usr/bin/npm
    ln -sf /usr/local/bin/npx /usr/bin/npx
fi

# Install PostgreSQL 16 (Ubuntu 24.04 comes with PostgreSQL 16 as default)
echo "Installing PostgreSQL 16 from Ubuntu 24.04 repositories..."
apt install -y postgresql postgresql-contrib postgresql-client

# Verify PostgreSQL version
echo "Installed PostgreSQL version:"
sudo -u postgres psql -c "SELECT version();" 2>/dev/null || echo "PostgreSQL installation verification will be done after service start"

# Install build tools for native dependencies
apt install -y python3 make g++ git

# Verify installations
node --version    # Should be v20.x (LTS)
npm --version     # Should be 10.x (bundled with Node.js 20)
psql --version    # Should be 16.x (Ubuntu 24.04 default)
```

### 4. Configure PostgreSQL

```bash
# Start PostgreSQL service
systemctl start postgresql
systemctl enable postgresql

# Generate a secure random password for the database user
DB_PASSWORD=$(openssl rand -base64 32)
echo "Generated database password: $DB_PASSWORD"
echo "IMPORTANT: Save this password - you'll need it for DATABASE_URL"

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE mower_db;
CREATE USER mower_user WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE mower_db TO mower_user;
ALTER USER mower_user CREATEDB;
\q
EOF

# Grant schema permissions (required for PostgreSQL 15+)
sudo -u postgres psql -d mower_db -c "GRANT ALL ON SCHEMA public TO mower_user;"

# Configure PostgreSQL to accept connections (detect version dynamically)
PG_VERSION=$(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -1 | cut -d. -f1)
echo "host all all 127.0.0.1/32 md5" >> /etc/postgresql/${PG_VERSION}/main/pg_hba.conf
systemctl restart postgresql

# Verify PostgreSQL installation and database connectivity
echo "Testing PostgreSQL installation..."
sudo -u postgres psql -c "SELECT version();" || {
    echo "ERROR: PostgreSQL is not responding correctly"
    exit 1
}

# Test the new user connection
PGPASSWORD="$DB_PASSWORD" psql -U mower_user -h localhost -d mower_db -c "SELECT current_user, current_database();" || {
    echo "ERROR: Cannot connect with new user credentials"
    exit 1
}

echo "PostgreSQL installation and configuration completed successfully!"
```

### 5. Set Up Application

```bash
# Create application directory
mkdir -p /opt/mower-app
cd /opt/mower-app

# Copy your application files (from host or git)
# If copying from host:
# sudo lxc file push /path/to/your/app/ mower-app/opt/mower-app/ -r

# If cloning from repository (NOTE: the "." is important - clones into current directory):
# git clone <your-repo-url> .
# 
# IMPORTANT: Do NOT run "git clone <repo-url>" without the "." 
# That would create a subdirectory and break the paths!

# Create swap space to prevent memory issues during npm install
echo "Creating swap space for npm install (prevents 'Killed' errors)..."
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Verify swap is active
free -h

# Install dependencies with increased Node.js memory limit
echo "Installing dependencies (this may take several minutes)..."

# Use npm install (not npm ci) since we may not have package-lock.json
NODE_OPTIONS="--max-old-space-size=4096" npm install

# Note: Use npm ci only if package-lock.json exists and you want exact versions
# NODE_OPTIONS="--max-old-space-size=4096" npm ci

# Build the application
echo "Building application..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### 6. Configure Environment

**Create environment file with automatically generated password:**

```bash
# Use the database password generated in step 4
echo "DATABASE_URL=postgresql://mower_user:$DB_PASSWORD@localhost:5432/mower_db" > /opt/mower-app/.env
echo "NODE_ENV=production" >> /opt/mower-app/.env
echo "PORT=5000" >> /opt/mower-app/.env

# Verify the .env file was created correctly
echo "Created .env file with the following content:"
cat /opt/mower-app/.env
```

**Alternative (Manual method if running in separate shell session):**

```bash
# Create .env file (replace YOUR_DB_PASSWORD with the password generated in step 4)
cat > /opt/mower-app/.env << EOF
DATABASE_URL=postgresql://mower_user:YOUR_DB_PASSWORD@localhost:5432/mower_db
NODE_ENV=production
PORT=5000
EOF
```

### 7. Set Up Database Schema

```bash
cd /opt/mower-app

# Push database schema
npm run db:push

# If you get data-loss warnings:
# npm run db:push --force
```

### 8. Create Systemd Service (Optional)

For automatic startup and management:

```bash
cat > /etc/systemd/system/mower-app.service << EOF
[Unit]
Description=Mower Management Application
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mower-app
Environment=NODE_ENV=production
EnvironmentFile=/opt/mower-app/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl daemon-reload
systemctl enable mower-app
systemctl start mower-app
```

### 9. Network Configuration & Access

**✅ No Additional Network Configuration Required!**

The Proxmox LXC wizard with bridge networking automatically handles all network setup:

- ✅ **Container gets LAN IP automatically** (e.g., 192.168.1.150)
- ✅ **Accessible from any device on your local network**
- ✅ **No port forwarding needed**
- ✅ **No iptables rules required**
- ✅ **No complex network configuration**

### Find Your Container's IP Address:

```bash
# Method 1: From inside the container
ip addr show eth0

# Method 2: From Proxmox web interface
# Container → Summary → Network section

# Method 3: From Proxmox host
pct exec <CT-ID> -- ip addr show eth0
```

### 10. Start and Access the Application

```bash
# From inside the container, start the app manually:
cd /opt/mower-app
node dist/index.js

# Or if using systemd service:
systemctl status mower-app

# The application will bind to 0.0.0.0:5000 and be accessible from your entire LAN
```

### 🌐 **Access from Any LAN Device:**

**Your container IP will be something like: `192.168.1.150`**

- **Web Interface**: `http://192.168.1.150:5000`
- **API Endpoints**: `http://192.168.1.150:5000/api/mowers`

**Access from any device on your local network:**
- 💻 **Desktop/Laptop browsers**: Direct access via container IP
- 📱 **Mobile devices**: Same URL works on phones/tablets  
- 🖥️ **Workshop computers**: Local network access
- 📟 **Other devices**: Any device on your LAN can access the application

## Environment Variables

The following environment variables must be configured:

| Variable      | Description                  | Required | Default      |
|---------------|-----------------------------|----------|-------------|
| `DATABASE_URL`| PostgreSQL connection string| **Yes**  | None        |
| `PORT`        | Application port            | No       | 5000        |
| `NODE_ENV`    | Environment mode            | No       | development |

## Key Dependencies

### Production Dependencies (51 packages)
- **Core Runtime**: `express`, `react`, `react-dom`
- **Database**: `drizzle-orm`, `@neondatabase/serverless`
- **UI Library**: 23 Radix UI components + styling libs
- **Form/State**: `react-hook-form`, `@tanstack/react-query`
- **Validation**: `zod`, `drizzle-zod`
- **File Handling**: `multer` (10MB limit in-memory storage)
- **External APIs**: `dropbox` integration

### Development Dependencies (20 packages)
- **Build Tools**: `vite`, `esbuild`, `typescript`, `tsx`
- **Database Tools**: `drizzle-kit` (for schema management)
- **Styling**: `tailwindcss`, `postcss`, `autoprefixer`

## 🔧 Key Differences from Docker

| Aspect         | Docker                | Proxmox LXC           |
|----------------|----------------------|-----------------------|
| **OS**         | Shares host kernel    | Full OS stack         |
| **Services**   | Single process        | Multiple services (systemd) |
| **Networking** | Port mapping required | Direct LAN access (bridge mode) |
| **Persistence**| Volumes needed        | Direct filesystem access |
| **Resource Usage** | Lower overhead    | Higher overhead       |
| **Management** | CLI/Compose files     | Proxmox web interface |

## 📊 Memory and Performance

- **LXC Overhead**: ~50-100MB for the OS
- **Application Memory**: ~200-500MB depending on usage
- **Database Memory**: ~50-200MB for PostgreSQL
- **File Storage**: 10MB per uploaded file (stored as base64 in database)

## Application Structure

- **Frontend**: React app built with Vite → serves from `/dist/public`
- **Backend**: Express server → compiled to `/dist/index.js`
- **Database**: PostgreSQL with Drizzle ORM using Neon driver
- **File uploads**: Multer with memory storage (10MB limit for PDF/images/documents)

## Database Schema

The application uses the following database tables:
- `mowers` - Main mower records
- `service_records` - Service history
- `attachments` - File attachments (stored as base64)
- `tasks` - Maintenance tasks

## Troubleshooting

### Common Issues

1. **npm ci "Killed" Error (Memory Issue)**:
    ```bash
    # Check available memory
    free -h

    # If no swap space exists, create it:
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile

    # Install with memory limit
    NODE_OPTIONS="--max-old-space-size=4096" npm ci

    # Alternative: Use npm install instead of ci
    NODE_OPTIONS="--max-old-space-size=4096" npm install
    ```

2. **"vite: not found" Build Error**:
    - This happens when `npm ci` failed due to memory issues
    - Follow the memory fix above first, then retry:
    ```bash
    NODE_OPTIONS="--max-old-space-size=4096" npm ci
    NODE_OPTIONS="--max-old-space-size=4096" npm run build
    ```

3. **Database Connection**: 
    - Ensure DATABASE_URL is correct and database is accessible
    - Application will test connection on startup and exit if it fails
    - Look for "Database connection successful" in startup logs

4. **Port Conflicts**: Change the host port if 5000 is already in use

5. **Build Failures**: Make sure all system dependencies are installed

6. **Schema Errors**: 
    - Run `npm run db:push` after database is available
    - If you encounter data-loss warnings, use `npm run db:push --force`
    - Ensure drizzle-kit is available (installed via `npm ci`)
    - Application uses schema push, not migration files

7. **Connection Timeouts**: The app handles database timeouts gracefully with retry logic

8. **Memory Issues**: Monitor memory usage due to file uploads stored in memory as base64 in database

### Logs

```bash
# View application logs (if using systemd)
journalctl -u mower-app -f

# View PostgreSQL logs
journalctl -u postgresql -f

# Look for these key startup messages:
# "Testing database connection..."
# "Database connection successful"
# "serving on port 5000"
```

### Database Stability

The application includes several stability improvements:
- **Connection Health Checks**: Verifies database connectivity before starting
- **Error Recovery**: Handles connection drops and administrator terminations
- **Proper Timeouts**: 30s idle timeout, 5s connection timeout
- **Graceful Shutdown**: Properly closes database connections on exit
- **Connection Monitoring**: Logs database errors for debugging

## 🚨 Important Notes

1. **Database**: This setup uses a local PostgreSQL instance. For production, consider external database.
2. **Security**: Change default passwords and configure proper firewall rules.
3. **Backups**: Set up regular database backups.
4. **Updates**: Keep Node.js, PostgreSQL, and dependencies updated.
5. **Monitoring**: Consider adding log rotation and monitoring.

## Development vs Production

- **Development**: Uses Vite dev server with hot reload
- **Production**: Serves built static files through Express
- **Database**: Same PostgreSQL setup for both environments

## Container Management

### Via Proxmox Web Interface:
- **Start/Stop**: Container → Start/Stop buttons
- **Console**: Container → Console (web terminal)
- **Monitor**: Container → Summary (resource usage)
- **Backup**: Container → Backup (snapshots)

### Via Command Line (from Proxmox host):
```bash
# Start container
pct start <CT-ID>

# Stop container  
pct stop <CT-ID>

# Enter container
pct enter <CT-ID>

# Container info
pct status <CT-ID>

# Create snapshot
pct snapshot <CT-ID> <snapshot-name>

# Delete container (be careful!)
pct destroy <CT-ID>
```

## 🎯 **Why Proxmox LXC Bridge Mode is Perfect for Local Apps:**

✅ **Plug-and-Play Networking**: Container acts like any other device on your network  
✅ **No Port Conflicts**: Each container gets its own IP address  
✅ **Easy Access**: Simple IP:port URLs work from any LAN device  
✅ **No Firewall Complexity**: Standard LAN security practices apply  
✅ **Scalable**: Add more containers without port management headaches  
✅ **Future-Proof**: Easy to add reverse proxy or SSL if needed later

The application will run with all features including mower management, service records, file attachments, and task management.
