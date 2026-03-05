import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { createUser, findUserByEmailHash, getUserCount, setPasswordResetToken, findUserByResetToken, updateUserPassword } from '../db/queries';
import { encryptEmail, decryptEmail } from '../crypto';
import { sendPasswordResetEmail } from '../email';

const router = Router();

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '7d';
const MAX_USERS = 1000;

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function signToken(userId: string, pseudonym: string): string {
  return jwt.sign({ userId, pseudonym }, config.jwtSecret, { expiresIn: JWT_EXPIRY, algorithm: 'HS256' });
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, pseudonym } = req.body;

    if (!email || !password || !pseudonym) {
      res.status(400).json({ error: 'Email, password, and pseudonym are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    if (pseudonym.length > 50) {
      res.status(400).json({ error: 'Pseudonym must be 50 characters or fewer' });
      return;
    }

    const userCount = await getUserCount();
    if (userCount >= MAX_USERS) {
      res.status(403).json({ error: "Registration is currently closed — we've reached capacity for our beta." });
      return;
    }

    const emailHash = hashEmail(email);

    const existing = await findUserByEmailHash(emailHash);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const encryptedEmail = encryptEmail(email);
    const user = await createUser(pseudonym, emailHash, passwordHash, encryptedEmail);
    const token = signToken(user.id, user.pseudonym);

    res.status(201).json({ token, user: { id: user.id, pseudonym: user.pseudonym } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const emailHash = hashEmail(email);
    const user = await findUserByEmailHash(emailHash);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken(user.id, user.pseudonym);
    res.json({ token, user: { id: user.id, pseudonym: user.pseudonym } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const emailHash = hashEmail(email);
    const user = await findUserByEmailHash(emailHash);

    if (user && user.encrypted_email) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await setPasswordResetToken(user.id, token, expiresAt);

      const decryptedEmail = decryptEmail(user.encrypted_email);
      await sendPasswordResetEmail(decryptedEmail, token);
    }

    // Always return same message to avoid leaking account existence
    res.json({ message: "If an account exists with that email, we've sent a reset link." });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const user = await findUserByResetToken(token);
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updateUserPassword(user.id, passwordHash);

    res.json({ message: 'Password has been reset.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
