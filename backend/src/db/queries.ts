import { pool } from './index';

export interface UserRow {
  id: string;
  pseudonym: string;
  email_hash: string | null;
  password_hash: string;
  couple_id: string | null;
  created_at: Date;
}

export async function createUser(
  pseudonym: string,
  emailHash: string,
  passwordHash: string
): Promise<UserRow> {
  const result = await pool.query(
    `INSERT INTO users (pseudonym, email_hash, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [pseudonym, emailHash, passwordHash]
  );
  return result.rows[0];
}

export async function findUserByEmailHash(emailHash: string): Promise<UserRow | null> {
  const result = await pool.query(
    `SELECT * FROM users WHERE email_hash = $1`,
    [emailHash]
  );
  return result.rows[0] || null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await pool.query(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
