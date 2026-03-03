import { Router, Request, Response } from 'express';
import { findUserById, deleteSharedDocument, deleteUser } from '../db/queries';

const router = Router();

// Delete user's shared document
router.delete('/shared-doc', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await findUserById(userId);
    if (!user?.couple_id) {
      res.status(400).json({ error: 'You are not in a couple' });
      return;
    }

    await deleteSharedDocument(userId, user.couple_id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete shared doc error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user account
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    await deleteUser(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
