import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
});

export async function initDb(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
}
