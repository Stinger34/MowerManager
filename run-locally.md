# Running Locally with Docker

This guide provides instructions for running the Mower Management application locally using Docker.

## Application Overview

- **Type**: Full-stack Node.js application with React frontend and Express backend
- **Database**: PostgreSQL with Drizzle ORM
- **Main Technologies**: TypeScript, React, Express, Vite, TailwindCSS

## Prerequisites

- Docker and Docker Compose
- PostgreSQL database instance (or use Docker Compose to run one)

## Docker Setup Requirements

### Base Image & Runtime
- **Node.js**: Version 18+ (application uses ES modules)
- **Recommended Base Image**: `node:18-alpine` or `node:20-alpine`

### System Dependencies
- **PostgreSQL Client**: For database connections
- **Build tools**: For native dependencies (python3, make, g++)

## Environment Variables

The following environment variables must be configured:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | None |
| `PORT` | Application port | No | 5000 |
| `NODE_ENV` | Environment mode | No | development |

### Example DATABASE_URL
```
DATABASE_URL=postgresql://username:password@localhost:5432/mower_db
```

**Note**: The application is optimized for Neon PostgreSQL and other serverless database providers with enhanced connection stability and error handling.

## Build Process

The application requires the following build steps:

```bash
# Install dependencies (including dev dependencies for drizzle-kit)
npm ci

# Build the application
npm run build
# This runs: vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Push database schema (after database is available)
npm run db:push
# This requires drizzle-kit which is installed as a dev dependency
```

## Application Structure

- **Frontend**: React app built with Vite → serves from `/dist/public`
- **Backend**: Express server → compiled to `/dist/index.js`
- **Database**: PostgreSQL with Drizzle ORM using Neon driver
- **File uploads**: Multer with memory storage (10MB limit for PDF/images/documents)

## Sample Dockerfile

```dockerfile
FROM node:18-alpine

# Install system dependencies for native modules
RUN apk add --no-cache python3 make g++ postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including drizzle-kit for schema management)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Start command
CMD ["node", "dist/index.js"]
```

## Sample Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/mower_db
      - NODE_ENV=production
    depends_on:
      - db
    # Note: Application uses drizzle-kit push, not migration files

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=mower_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Database Schema

The application uses the following database tables:
- `mowers` - Main mower records
- `service_records` - Service history
- `attachments` - File attachments (stored as base64) with title and description metadata
- `tasks` - Maintenance tasks

### Schema Setup
```bash
# After the database is running, push the schema:
npm run db:push

# If you encounter data-loss warnings, use:
npm run db:push --force
```

### Database Connection Configuration

The application includes robust database connection handling:
- **Connection pooling**: Single connection optimized for serverless
- **Error handling**: Automatic reconnection and graceful error recovery
- **Health checks**: Database connectivity verification on startup
- **Timeout management**: Proper idle and connection timeouts for stability

## Runtime Configuration

- **Port Binding**: Application binds to `0.0.0.0:5000`
- **Database**: Requires PostgreSQL accessible via DATABASE_URL with improved connection stability
- **Memory**: Consider file upload limits (10MB per file stored in memory as base64)
- **File Storage**: Attachments stored in database as base64, not on disk
- **Connections**: Single pooled connection with automatic error recovery and health monitoring
- **Error Handling**: Graceful database disconnection handling and automatic reconnection

## Key Dependencies

### Production Dependencies (51 packages)
```json
{
  "@hookform/resolvers": "^3.10.0",
  "@jridgewell/trace-mapping": "^0.3.25",
  "@neondatabase/serverless": "^0.10.4",
  "@radix-ui/react-accordion": "^1.2.4",
  "@radix-ui/react-alert-dialog": "^1.1.7",
  "@radix-ui/react-aspect-ratio": "^1.1.3",
  "@radix-ui/react-avatar": "^1.1.4",
  "@radix-ui/react-checkbox": "^1.1.5",
  "@radix-ui/react-collapsible": "^1.1.4",
  "@radix-ui/react-context-menu": "^2.2.7",
  "@radix-ui/react-dialog": "^1.1.7",
  "@radix-ui/react-dropdown-menu": "^2.1.7",
  "@radix-ui/react-hover-card": "^1.1.7",
  "@radix-ui/react-label": "^2.1.3",
  "@radix-ui/react-menubar": "^1.1.7",
  "@radix-ui/react-navigation-menu": "^1.2.6",
  "@radix-ui/react-popover": "^1.1.7",
  "@radix-ui/react-progress": "^1.1.3",
  "@radix-ui/react-radio-group": "^1.2.4",
  "@radix-ui/react-scroll-area": "^1.2.4",
  "@radix-ui/react-select": "^2.1.7",
  "@radix-ui/react-separator": "^1.1.3",
  "@radix-ui/react-slider": "^1.2.4",
  "@radix-ui/react-slot": "^1.2.0",
  "@radix-ui/react-switch": "^1.1.4",
  "@radix-ui/react-tabs": "^1.1.4",
  "@radix-ui/react-toast": "^1.2.7",
  "@radix-ui/react-toggle": "^1.1.3",
  "@radix-ui/react-toggle-group": "^1.1.3",
  "@radix-ui/react-tooltip": "^1.2.0",
  "@tanstack/react-query": "^5.60.5",
  "@types/multer": "^2.0.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "cmdk": "^1.1.1",
  "connect-pg-simple": "^10.0.0",
  "date-fns": "^3.6.0",
  "drizzle-orm": "^0.39.1",
  "drizzle-zod": "^0.7.0",
  "dropbox": "^10.34.0",
  "embla-carousel-react": "^8.6.0",
  "express": "^4.21.2",
  "express-session": "^1.18.1",
  "framer-motion": "^11.13.1",
  "input-otp": "^1.4.2",
  "lucide-react": "^0.453.0",
  "memorystore": "^1.6.7",
  "multer": "^2.0.2",
  "next-themes": "^0.4.6",
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "react": "^18.3.1",
  "react-day-picker": "^8.10.1",
  "react-dom": "^18.3.1",
  "react-hook-form": "^7.55.0",
  "react-icons": "^5.4.0",
  "react-resizable-panels": "^2.1.7",
  "recharts": "^2.15.2",
  "tailwind-merge": "^2.6.0",
  "tailwindcss-animate": "^1.0.7",
  "tw-animate-css": "^1.2.5",
  "vaul": "^1.1.2",
  "wouter": "^3.3.5",
  "ws": "^8.18.0",
  "zod": "^3.24.2",
  "zod-validation-error": "^3.4.0"
}
```

### Development Dependencies (Required for Container) - 20 packages
```json
{
  "@replit/vite-plugin-cartographer": "^0.3.0",
  "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
  "@tailwindcss/typography": "^0.5.15",
  "@tailwindcss/vite": "^4.1.3",
  "@types/connect-pg-simple": "^7.0.3",
  "@types/express": "4.17.21",
  "@types/express-session": "^1.18.0",
  "@types/node": "20.16.11",
  "@types/passport": "^1.0.16",
  "@types/passport-local": "^1.0.38",
  "@types/react": "^18.3.11",
  "@types/react-dom": "^18.3.1",
  "@types/ws": "^8.5.13",
  "@vitejs/plugin-react": "^4.3.2",
  "autoprefixer": "^10.4.20",
  "drizzle-kit": "^0.30.4",
  "esbuild": "^0.25.0",
  "postcss": "^8.4.47",
  "tailwindcss": "^3.4.17",
  "tsx": "^4.19.1",
  "typescript": "5.6.3",
  "vite": "^5.4.19"
}
```

### Optional Dependencies
```json
{
  "bufferutil": "^4.0.8"
}
```

**Note**: Dev dependencies are included in the Docker build to enable schema management with `drizzle-kit`, frontend building with Vite, and TypeScript compilation.

## Running the Container

### Build and Run
```bash
# Build the image
docker build -t mower-app .

# Run with external database
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  mower-app

# Or run with Docker Compose
docker-compose up --build
```

### Access the Application
- **Frontend**: http://localhost:5000
- **API**: http://localhost:5000/api/*

## File Structure in Container

```
/app
├── dist/               # Built application
│   ├── public/        # Frontend build (React)
│   └── index.js       # Backend build (Express)
├── client/            # React frontend source
│   ├── src/          # React components, pages, hooks
│   ├── public/       # Static assets
│   └── index.html    # HTML template
├── server/            # Express backend source
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API routes
│   ├── db.ts         # Database connection
│   ├── storage.ts    # Data access layer
│   └── vite.ts       # Vite integration
├── shared/            # Shared TypeScript schemas
│   └── schema.ts     # Drizzle schema definitions
├── package.json       # Dependencies
├── drizzle.config.ts  # Database configuration
├── vite.config.ts     # Vite build configuration
├── tailwind.config.ts # Tailwind CSS configuration
├── tsconfig.json      # TypeScript configuration
├── postcss.config.js  # PostCSS configuration
└── node_modules/      # Dependencies
```

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
   - Ensure drizzle-kit is available in the container (installed via `npm ci`)
   - Application uses schema push, not migration files
5. **Connection Timeouts**: The app now handles database timeouts gracefully with retry logic
6. **Memory Issues**: Monitor memory usage due to file uploads stored in memory as base64 in database

### Logs
```bash
# View container logs
docker logs <container-id>

# Follow logs
docker logs -f <container-id>

# Look for these key startup messages:
# "Testing database connection..."
# "Database connection successful"
# "serving on port 5000"
```

### Database Stability Improvements

The application now includes several stability improvements:
- **Connection Health Checks**: Verifies database connectivity before starting
- **Error Recovery**: Handles connection drops and administrator terminations
- **Proper Timeouts**: 30s idle timeout, 5s connection timeout
- **Graceful Shutdown**: Properly closes database connections on exit
- **Connection Monitoring**: Logs database errors for debugging

## Development vs Production

- **Development**: Uses Vite dev server with hot reload
- **Production**: Serves built static files through Express
- **Database**: Same PostgreSQL setup for both environments