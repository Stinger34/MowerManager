import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configuration for local PostgreSQL
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Multiple connections for local PostgreSQL
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  connectionTimeoutMillis: 5000, // 5 seconds connection timeout
});

// Add error handler for pool
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Database instance for PostgreSQL
export const db = drizzle(pool, { schema });

// Database health check function
export async function testDatabaseConnection() {
  try {
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
  console.log('Closing database pool...');
  await pool.end();
});

process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
});
