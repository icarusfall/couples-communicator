import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  createCouple,
  findCoupleByPairingCode,
  updateUserCoupleId,
  clearPairingCode,
  getCoupleMembers,
  getUserCouple,
  findUserById,
} from '../db/queries';

const router = Router();

function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

router.post('/create', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.couple_id) {
      res.status(409).json({ error: 'You are already in a couple' });
      return;
    }

    const coupleSalt = crypto.randomBytes(32);
    const pairingCode = generatePairingCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const couple = await createCouple(coupleSalt, pairingCode, expiresAt);
    await updateUserCoupleId(userId, couple.id);

    res.status(201).json({
      coupleId: couple.id,
      pairingCode,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('Create couple error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { pairingCode } = req.body;

    if (!pairingCode) {
      res.status(400).json({ error: 'Pairing code is required' });
      return;
    }

    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.couple_id) {
      res.status(409).json({ error: 'You are already in a couple' });
      return;
    }

    const couple = await findCoupleByPairingCode(pairingCode.toUpperCase());
    if (!couple) {
      res.status(404).json({ error: 'Invalid pairing code' });
      return;
    }

    if (couple.pairing_code_expires_at && couple.pairing_code_expires_at < new Date()) {
      res.status(410).json({ error: 'Pairing code has expired' });
      return;
    }

    const members = await getCoupleMembers(couple.id);
    if (members.length >= 2) {
      res.status(409).json({ error: 'This couple already has two members' });
      return;
    }

    await updateUserCoupleId(userId, couple.id);
    await clearPairingCode(couple.id);

    const partner = members[0];
    res.json({
      coupleId: couple.id,
      partnerPseudonym: partner?.pseudonym ?? null,
    });
  } catch (err) {
    console.error('Join couple error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await getUserCouple(userId);
    if (!result) {
      res.json({ paired: false });
      return;
    }

    const { couple, partner } = result;
    const response: Record<string, unknown> = {
      paired: !!partner,
      coupleId: couple.id,
      coupleSalt: couple.couple_salt.toString('base64'),
      partnerPseudonym: partner?.pseudonym ?? null,
      waitingForPartner: !partner,
    };
    if (!partner && couple.pairing_code) {
      response.pairingCode = couple.pairing_code;
    }
    res.json(response);
  } catch (err) {
    console.error('Couple status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
