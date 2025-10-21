import { Router } from 'express';
import prisma from '../lib/prisma';
import hub, { TriageEvent } from '../lib/triageHub';
import { getRedis } from '../lib/redis';
import { executeTriagePlan } from '../lib/orchestrator';

const router = Router();

function nowIso() { return new Date().toISOString(); }

// POST /api/triage -> { runId, alertId }
router.post('/', async (req, res) => {
  try {
    const { alertId } = req.body || {};
    if (!alertId) return res.status(400).json({ error: 'alertId required' });

    // Rate limit per alertId to avoid spam triage
    try {
      const redis = await getRedis();
      const key = `triage:cooldown:${alertId}`;
      // TTL for 5 minutes
      const ttlSeconds = 5;
      const set = await redis.set(key, '1', { NX: true, EX: ttlSeconds });
      if (set !== 'OK') {
        const pttl = await redis.pTTL(key);
        const ms = Math.max(0, pttl);
        const sec = Math.ceil(ms / 1000);
        res.setHeader('Retry-After', String(sec));
        return res.status(429).json({ error: 'rate_limited', retryAfterMs: ms });
      }
    } catch (e) {
      // If Redis not available, do not block; proceed without rate limit
    }

    // Create run record
    const runId = `run_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    await prisma.triageRun.create({ data: { id: runId, alertId, fallbackUsed: false } });

    // Load alert to obtain customerId
    const alert = await prisma.alert.findUnique({ where: { id: alertId }, include: { customer: true } });
    if (!alert) {
      return res.status(404).json({ error: 'alert_not_found' });
    }

    // Create stream in hub
    const emitter = hub.create(runId);

    setImmediate(() => {
      executeTriagePlan(runId, alertId, (alert as any).customerId).catch(console.error);
    });

    res.json({ runId, alertId });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/triage/:runId/stream (SSE)
router.get('/:runId/stream', async (req, res) => {
  const runId = String(req.params.runId);
  const stream = hub.get(runId) || hub.create(runId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Helper to send SSE event
  const send = (ev: TriageEvent) => {
    res.write(`event: ${ev.type}\n`);
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };

  // Replay history
  for (const ev of stream.history) send(ev);

  // Subscribe
  const onEvent = (ev: TriageEvent) => send(ev);
  stream.emitter.on('event', onEvent);

  req.on('close', () => {
    stream.emitter.off('event', onEvent);
  });
});

export default router;
