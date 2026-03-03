import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { initDb } from './db';
import { requireAuth } from './middleware/auth';
import authRoutes from './routes/auth';
import coupleRoutes from './routes/couple';
import chatRoutes from './routes/chat';
import sharedDocRoutes from './routes/shared-doc';
import accountRoutes from './routes/account';

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
});

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat requests, please try again later' },
});

app.use(globalLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/couple', requireAuth, coupleRoutes);
app.use('/chat', requireAuth, chatLimiter, chatRoutes);
app.use('/shared-doc', requireAuth, sharedDocRoutes);
app.use('/account', requireAuth, accountRoutes);

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
