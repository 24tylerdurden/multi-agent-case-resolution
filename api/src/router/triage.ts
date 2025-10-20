import { Router } from 'express';
import prisma from '../lib/prisma';
import hub, { TriageEvent } from '../lib/triageHub';
import { getRedis } from '../lib/redis';

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

    // Create stream in hub
    const emitter = hub.create(runId);

    // Simulate async orchestration (planner + tools) with timeouts
    setTimeout(async () => {
      const ev1: TriageEvent = { type: 'plan_built', ts: nowIso(), data: { plan: ["getProfile","recentTx","riskSignals","kbLookup","decide","proposeAction"] } };
      hub.emit(runId, ev1);
      await prisma.agentTrace.create({ data: { runId, seq: 1, step: ev1.type, ok: true, durationMs: 50, detail: ev1.data } });
    }, 50);

    setTimeout(async () => {
      // Simulate risk tool; support forced failure via request body, otherwise 15% failure
      const forcedFail = !!(req.body && req.body.simulateRiskFail);
      const fail = forcedFail || (Math.random() < 0.15);
      if (fail) {
        const evF: TriageEvent = { type: 'fallback_triggered', ts: nowIso(), data: { tool: 'riskSignals', reason: 'risk_unavailable' } };
        hub.emit(runId, evF);
        await prisma.agentTrace.create({ data: { runId, seq: 2, step: evF.type, ok: true, durationMs: 900, detail: evF.data } });
        await prisma.triageRun.update({ where: { id: runId }, data: { fallbackUsed: true } });
      } else {
        const ev2: TriageEvent = { type: 'tool_update', ts: nowIso(), data: { tool: 'riskSignals', ok: true, score: 0.82, reasons: ['mcc_rarity','device_change'] } };
        hub.emit(runId, ev2);
        await prisma.agentTrace.create({ data: { runId, seq: 2, step: ev2.type, ok: true, durationMs: 180, detail: ev2.data } });
      }
    }, 300);

    setTimeout(async () => {
      // Finalize decision based on whether fallback was used
      const run = await prisma.triageRun.findUnique({ where: { id: runId } });
      if (run?.fallbackUsed) {
        const ev3: TriageEvent = { type: 'decision_finalized', ts: nowIso(), data: { recommended: 'MONITOR', risk: 'MEDIUM', reasons: ['risk_unavailable'] } };
        hub.emit(runId, ev3);
        await prisma.agentTrace.create({ data: { runId, seq: 3, step: ev3.type, ok: true, durationMs: 40, detail: ev3.data } });
        await prisma.triageRun.update({ where: { id: runId }, data: { endedAt: new Date(), risk: 'MEDIUM', reasons: { fallback: true, reason: 'risk_unavailable' }, latencyMs: 500 } });
      } else {
        const ev3: TriageEvent = { type: 'decision_finalized', ts: nowIso(), data: { recommended: 'FREEZE_CARD', risk: 'HIGH' } };
        hub.emit(runId, ev3);
        await prisma.agentTrace.create({ data: { runId, seq: 3, step: ev3.type, ok: true, durationMs: 40, detail: ev3.data } });
        await prisma.triageRun.update({ where: { id: runId }, data: { endedAt: new Date(), risk: 'HIGH', reasons: { recommended: 'FREEZE_CARD' }, latencyMs: 500 } });
      }
    }, 600);

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
