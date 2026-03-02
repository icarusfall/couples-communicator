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

// --- Couple queries ---

export interface CoupleRow {
  id: string;
  pairing_code: string | null;
  pairing_code_expires_at: Date | null;
  couple_salt: Buffer;
  created_at: Date;
}

export async function createCouple(
  coupleSalt: Buffer,
  pairingCode: string,
  expiresAt: Date
): Promise<CoupleRow> {
  const result = await pool.query(
    `INSERT INTO couples (couple_salt, pairing_code, pairing_code_expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [coupleSalt, pairingCode, expiresAt]
  );
  return result.rows[0];
}

export async function findCoupleByPairingCode(code: string): Promise<CoupleRow | null> {
  const result = await pool.query(
    `SELECT * FROM couples WHERE pairing_code = $1`,
    [code]
  );
  return result.rows[0] || null;
}

export async function updateUserCoupleId(userId: string, coupleId: string): Promise<void> {
  await pool.query(
    `UPDATE users SET couple_id = $1 WHERE id = $2`,
    [coupleId, userId]
  );
}

export async function clearPairingCode(coupleId: string): Promise<void> {
  await pool.query(
    `UPDATE couples SET pairing_code = NULL, pairing_code_expires_at = NULL WHERE id = $1`,
    [coupleId]
  );
}

export async function getCoupleMembers(coupleId: string): Promise<UserRow[]> {
  const result = await pool.query(
    `SELECT * FROM users WHERE couple_id = $1`,
    [coupleId]
  );
  return result.rows;
}

export async function getUserCouple(userId: string): Promise<{ couple: CoupleRow; partner: UserRow | null } | null> {
  const user = await findUserById(userId);
  if (!user || !user.couple_id) return null;

  const coupleResult = await pool.query(
    `SELECT * FROM couples WHERE id = $1`,
    [user.couple_id]
  );
  const couple: CoupleRow | undefined = coupleResult.rows[0];
  if (!couple) return null;

  const partnerResult = await pool.query(
    `SELECT * FROM users WHERE couple_id = $1 AND id != $2`,
    [user.couple_id, userId]
  );
  const partner: UserRow | null = partnerResult.rows[0] || null;

  return { couple, partner };
}
