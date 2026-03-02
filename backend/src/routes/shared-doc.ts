import { Router, Request, Response } from 'express';
import { findUserById, getUserCouple, getSharedDocuments, upsertSharedDocument } from '../db/queries';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await findUserById(userId);
    if (!user?.couple_id) {
      res.status(400).json({ error: 'You are not in a couple' });
      return;
    }

    const docs = await getSharedDocuments(user.couple_id);
    const result = docs.map((doc) => ({
      userId: doc.user_id,
      encryptedContent: doc.encrypted_content.toString('base64'),
      iv: doc.iv.toString('base64'),
      updatedAt: doc.updated_at,
    }));

    res.json({ documents: result });
  } catch (err) {
    console.error('Get shared docs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { encryptedContent, iv } = req.body;

    if (!encryptedContent || !iv) {
      res.status(400).json({ error: 'encryptedContent and iv are required' });
      return;
    }

    const user = await findUserById(userId);
    if (!user?.couple_id) {
      res.status(400).json({ error: 'You are not in a couple' });
      return;
    }

    const contentBuf = Buffer.from(encryptedContent, 'base64');
    const ivBuf = Buffer.from(iv, 'base64');

    const doc = await upsertSharedDocument(userId, user.couple_id, contentBuf, ivBuf);

    res.json({
      userId: doc.user_id,
      encryptedContent: doc.encrypted_content.toString('base64'),
      iv: doc.iv.toString('base64'),
      updatedAt: doc.updated_at,
    });
  } catch (err) {
    console.error('Upsert shared doc error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
