import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { initDb } from './db';
import { requireAuth } from './middleware/auth';
import authRoutes from './routes/auth';
import coupleRoutes from './routes/couple';
import chatRoutes from './routes/chat';
import sharedDocRoutes from './routes/shared-doc';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/couple', requireAuth, coupleRoutes);
app.use('/chat', requireAuth, chatRoutes);
app.use('/shared-doc', requireAuth, sharedDocRoutes);

// Protected test endpoint (useful for verifying JWT works)
app.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initDb();
  console.log('Database schema initialised');

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
