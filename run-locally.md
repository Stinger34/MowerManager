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
# Install dependencies
npm ci

# Build the application
npm run build
# This runs: vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Push database schema (after database is available)
npm run db:push
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

# Install dependencies
RUN npm ci --only=production

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
    volumes:
      - ./migrations:/app/migrations

  db:
    image: postgres:15-alpine
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
- `attachments` - File attachments (stored as base64)
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
- **Memory**: Consider file upload limits (10MB per file stored in memory)
- **Connections**: Single pooled connection with automatic error recovery and health monitoring
- **Error Handling**: Graceful database disconnection handling and automatic reconnection

## Key Production Dependencies

```json
{
  "express": "^4.21.2",
  "react": "^18.3.1", 
  "drizzle-orm": "^0.39.1",
  "@neondatabase/serverless": "^0.10.4",
  "multer": "^2.0.2",
  "ws": "^8.18.0"
}
```

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
├── shared/            # Shared TypeScript schemas
├── package.json       # Dependencies
├── drizzle.config.ts  # Database configuration
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
4. **Schema Errors**: Run `npm run db:push` after database is available
5. **Connection Timeouts**: The app now handles database timeouts gracefully with retry logic
6. **Memory Issues**: Monitor memory usage due to file uploads stored in memory

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