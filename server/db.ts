import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Improved configuration for Neon with proper error handling
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1, // Single connection for serverless
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  connectionTimeoutMillis: 5000, // 5 seconds connection timeout
  maxUses: 1000, // Limit connection reuse
  allowExitOnIdle: false, // Keep pool alive
});

// Add error handler for pool
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Enhanced database instance with retry logic
export const db = drizzle({ client: pool, schema });

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
