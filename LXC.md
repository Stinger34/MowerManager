# Running in Linux LXC Container

This guide provides instructions for running the Mower Management application in a Linux LXC container.

## Application Overview

- **Type**: Full-stack Node.js application with React frontend and Express backend
- **Database**: PostgreSQL with Drizzle ORM
- **Main Technologies**: TypeScript, React, Express, Vite, TailwindCSS
- **Runtime**: Node.js 20+ required

## Prerequisites

- Linux host system with LXC installed
- Root access to create and configure containers
- Basic knowledge of LXC container management

## 📦 LXC Container Setup

### 1. Create and Configure LXC Container

```bash
# Create Ubuntu 22.04 LXC container
sudo lxc-create -n mower-app -t ubuntu -- --release jammy

# Start the container
sudo lxc-start -n mower-app

# Attach to the container
sudo lxc-attach -n mower-app
```

### 2. Install System Dependencies

Once inside the LXC container:

```bash
# Update package list
apt update && apt upgrade -y

# Install Node.js 20 (required for this application)
# Remove any existing Node.js from Ubuntu repos
apt remove -y nodejs npm 2>/dev/null || true
apt autoremove -y

# Install wget/curl if not present
apt install -y wget curl

# Method 1: Direct binary download (most reliable for LXC containers)
NODE_VERSION="20.19.2"
wget https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
tar -xJf node-v${NODE_VERSION}-linux-x64.tar.xz -C /usr/local --strip-components=1
rm node-v${NODE_VERSION}-linux-x64.tar.xz

# Create symlinks for compatibility
ln -sf /usr/local/bin/node /usr/bin/node
ln -sf /usr/local/bin/npm /usr/bin/npm
ln -sf /usr/local/bin/npx /usr/bin/npx

# Alternative: If binary download fails, try NodeSource
# curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
# apt install -y nodejs

# Install PostgreSQL 16
apt install -y wget ca-certificates lsb-release

# Get Ubuntu codename and add correct PostgreSQL repository
UBUNTU_CODENAME=$(lsb_release -cs)
echo "deb http://apt.postgresql.org/pub/repos/apt/ ${UBUNTU_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

# Update package lists
apt update

# Install missing dependencies first (LXC containers often missing these)
apt install -y --fix-missing libc6 libgcc-s1 libgssapi-krb5-2 libssl3 libstdc++6 zlib1g

# Try to install required libraries for PostgreSQL 16
apt install -y libicu70 libldap-2.5-0 2>/dev/null || {
    echo "Note: Some libraries not available, trying PostgreSQL installation anyway..."
    # For older Ubuntu versions, try alternative libraries
    apt install -y libicu66 libldap-2.4-2 2>/dev/null || true
}

# Install PostgreSQL 16
apt install -y postgresql-16 postgresql-client-16 || {
    echo "PostgreSQL 16 installation failed, trying Ubuntu's default PostgreSQL..."
    # Fallback: Remove PostgreSQL repo and use Ubuntu's version
    rm -f /etc/apt/sources.list.d/pgdg.list
    apt update
    apt install -y postgresql postgresql-contrib postgresql-client
}

# Install build tools for native dependencies
apt install -y python3 make g++ git

# Verify installations
node --version    # Should be v20.x
npm --version     # Should be 10.x
psql --version    # Should be 16.x
```

### 3. Configure PostgreSQL

```bash
# Start PostgreSQL service
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE mower_db;
CREATE USER mower_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE mower_db TO mower_user;
ALTER USER mower_user CREATEDB;
\q
EOF

# Configure PostgreSQL to accept connections
echo "host all all 127.0.0.1/32 md5" >> /etc/postgresql/16/main/pg_hba.conf
systemctl restart postgresql
```

### 4. Set Up Application

```bash
# Create application directory
mkdir -p /opt/mower-app
cd /opt/mower-app

# Copy your application files (from host or git)
# If copying from host:
# sudo lxc file push /path/to/your/app/ mower-app/opt/mower-app/ -r

# If cloning from repository:
# git clone <your-repo-url> .

# Install dependencies
npm ci

# Build the application
npm run build
```

### 5. Configure Environment

Create environment file:

```bash
# Create .env file
cat > /opt/mower-app/.env << EOF
DATABASE_URL=postgresql://mower_user:secure_password@localhost:5432/mower_db
NODE_ENV=production
PORT=5000
EOF
```

### 6. Set Up Database Schema

```bash
cd /opt/mower-app

# Push database schema
npm run db:push

# If you get data-loss warnings:
# npm run db:push --force
```

### 7. Create Systemd Service (Optional)

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

### 8. Configure LXC Networking

From the **host system** (outside the container):

```bash
# Configure port forwarding to access the app
# Edit LXC container config
sudo nano /var/lib/lxc/mower-app/config

# Add these lines for port forwarding:
# lxc.net.0.type = veth
# lxc.net.0.link = lxcbr0
# lxc.net.0.flags = up

# Forward host port 5000 to container port 5000
sudo iptables -t nat -A PREROUTING -p tcp --dport 5000 -j DNAT --to-destination [CONTAINER_IP]:5000
sudo iptables -A FORWARD -p tcp -d [CONTAINER_IP] --dport 5000 -j ACCEPT

# Find container IP:
sudo lxc-info -n mower-app -i
```

### 9. Access the Application

```bash
# From inside the container, start the app manually:
cd /opt/mower-app
node dist/index.js

# Or if using systemd service:
systemctl status mower-app
```

Access the application at: `http://[HOST_IP]:5000`

## Environment Variables

The following environment variables must be configured:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | None |
| `PORT` | Application port | No | 5000 |
| `NODE_ENV` | Environment mode | No | development |

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

| Aspect | Docker | LXC Container |
|--------|---------|---------------|
| **OS** | Shares host kernel | Full OS stack |
| **Services** | Single process | Multiple services (systemd) |
| **Networking** | Automatic port mapping | Manual iptables rules |
| **Persistence** | Volumes needed | Direct filesystem access |
| **Resource Usage** | Lower overhead | Higher overhead |

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

1. **Database Connection**: 
   - Ensure DATABASE_URL is correct and database is accessible
   - Application will test connection on startup and exit if it fails
   - Look for "Database connection successful" in startup logs

2. **Port Conflicts**: Change the host port if 5000 is already in use

3. **Build Failures**: Make sure all system dependencies are installed

4. **Schema Errors**: 
   - Run `npm run db:push` after database is available
   - If you encounter data-loss warnings, use `npm run db:push --force`
   - Ensure drizzle-kit is available (installed via `npm ci`)
   - Application uses schema push, not migration files

5. **Connection Timeouts**: The app handles database timeouts gracefully with retry logic

6. **Memory Issues**: Monitor memory usage due to file uploads stored in memory as base64 in database

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

```bash
# Start container
sudo lxc-start -n mower-app

# Stop container
sudo lxc-stop -n mower-app

# Attach to running container
sudo lxc-attach -n mower-app

# Container info
sudo lxc-info -n mower-app

# Delete container (be careful!)
sudo lxc-destroy -n mower-app
```

The application will run with all features including mower management, service records, file attachments, and task management.