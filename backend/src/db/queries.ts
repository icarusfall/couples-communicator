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

// --- Shared document queries ---

export interface SharedDocumentRow {
  id: string;
  user_id: string;
  couple_id: string;
  encrypted_content: Buffer;
  iv: Buffer;
  updated_at: Date;
}

export async function getSharedDocuments(coupleId: string): Promise<SharedDocumentRow[]> {
  const result = await pool.query(
    `SELECT * FROM shared_documents WHERE couple_id = $1`,
    [coupleId]
  );
  return result.rows;
}

export async function upsertSharedDocument(
  userId: string,
  coupleId: string,
  encryptedContent: Buffer,
  iv: Buffer
): Promise<SharedDocumentRow> {
  const result = await pool.query(
    `INSERT INTO shared_documents (user_id, couple_id, encrypted_content, iv)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, couple_id)
     DO UPDATE SET encrypted_content = EXCLUDED.encrypted_content,
                   iv = EXCLUDED.iv,
                   updated_at = NOW()
     RETURNING *`,
    [userId, coupleId, encryptedContent, iv]
  );
  return result.rows[0];
}

export async function deleteSharedDocument(userId: string, coupleId: string): Promise<void> {
  await pool.query(
    `DELETE FROM shared_documents WHERE user_id = $1 AND couple_id = $2`,
    [userId, coupleId]
  );
}

export async function deleteUser(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get user's couple_id before deleting
    const userResult = await client.query('SELECT couple_id FROM users WHERE id = $1', [userId]);
    const coupleId = userResult.rows[0]?.couple_id;

    // Delete user's shared documents
    await client.query('DELETE FROM shared_documents WHERE user_id = $1', [userId]);

    // Unlink user from couple
    await client.query('UPDATE users SET couple_id = NULL WHERE id = $1', [userId]);

    // Delete user
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    // If user was in a couple, check if partner remains
    if (coupleId) {
      const remaining = await client.query(
        'SELECT id FROM users WHERE couple_id = $1',
        [coupleId]
      );
      if (remaining.rows.length === 0) {
        // No partner left — clean up couple and any orphaned docs
        await client.query('DELETE FROM shared_documents WHERE couple_id = $1', [coupleId]);
        await client.query('DELETE FROM couples WHERE id = $1', [coupleId]);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
