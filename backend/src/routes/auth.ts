import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { createUser, findUserByEmailHash } from '../db/queries';

const router = Router();

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '7d';

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function signToken(userId: string, pseudonym: string): string {
  return jwt.sign({ userId, pseudonym }, config.jwtSecret, { expiresIn: JWT_EXPIRY });
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

    const emailHash = hashEmail(email);

    const existing = await findUserByEmailHash(emailHash);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await createUser(pseudonym, emailHash, passwordHash);
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

export default router;
