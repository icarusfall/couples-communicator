import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { buildSystemPrompt } from '../prompts/system';

const router = Router();

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { messages, myDocument, partnerDocument } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required and must not be empty' });
      return;
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
        res.status(400).json({ error: 'Each message must have a valid role ("user" or "assistant") and content' });
        return;
      }
    }

    const pseudonym = req.user!.pseudonym;
    const systemPrompt = buildSystemPrompt(pseudonym, myDocument, partnerDocument);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages as ChatMessage[],
    }, {
      headers: {
        'anthropic-beta': 'zero-data-retention-2025-04-01',
      },
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
    });

    stream.on('error', (error) => {
      console.error('Anthropic stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'An error occurred while generating a response' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    req.on('close', () => {
      stream.abort();
    });
  } catch (err) {
    console.error('Chat endpoint error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

export default router;
