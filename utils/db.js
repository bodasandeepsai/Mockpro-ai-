import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema'

// Implement connection caching to avoid recreating connections
let _db = null;

export function getDb() {
  if (!_db) {
    const sql = neon(process.env.NEXT_PUBLIC_DRIZZLE_DB_URL);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// Keep the existing export for backward compatibility
const sql = neon(process.env.NEXT_PUBLIC_DRIZZLE_DB_URL);
export const db = drizzle(sql, { schema });