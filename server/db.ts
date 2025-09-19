import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

let pool: any = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  // Configuration for local PostgreSQL
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20, // Multiple connections for local PostgreSQL
    idleTimeoutMillis: 30000, // 30 seconds idle timeout
    connectionTimeoutMillis: 5000, // 5 seconds connection timeout
  });

  // Add error handler for pool
  pool.on('error', (err: any) => {
    console.error('Unexpected database pool error:', err);
  });

  // Database instance for PostgreSQL
  db = drizzle(pool, { schema });
} else {
  console.log('No DATABASE_URL provided, database connections will not be available');
}

// Export pool and db (may be null if no DATABASE_URL)
export { pool, db };

// Database health check function
export async function testDatabaseConnection() {
  try {
    if (!pool) {
      console.log('No database pool available');
      return false;
    }
    const result = await pool.query('SELECT 1 as test');
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  if (pool) {
    console.log('Closing database pool...');
    await pool.end();
  }
});

process.on('SIGINT', async () => {
  if (pool) {
    console.log('Closing database pool...');
    await pool.end();
  }
});
