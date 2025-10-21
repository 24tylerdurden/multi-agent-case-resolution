// lib/orchestrator.ts
import { redactPII } from './redactor';
import { getProfile } from '../agents/profile';
import { analyzeRecentTransactions } from '../agents/tx';
import { runRiskSignals } from '../agents/risk';
import { lookupKB } from '../agents/kb';
import { decideAction } from '../agents/decider';
import prisma from './prisma';
import hub, { TriageEvent } from './triageHub';

const MAX_STEP_TIME_MS = 1000;
const TOTAL_BUDGET_MS = 5000;

export async function executeTriagePlan(runId: string, alertId: string, customerId: string) {
  const start = Date.now();
  const events: TriageEvent[] = [];
  let fallbackUsed = false;
  let seq = 0;

  const emit = (ev: TriageEvent) => {
    events.push(ev);
    hub.emit(runId, ev);
  };

  const step = async <T>(
    name: string,
    fn: () => Promise<T>,
    fallback: () => T | null = () => null
  ): Promise<T | null> => {
    const stepStart = Date.now();
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), MAX_STEP_TIME_MS)
      );
      const result = await Promise.race([fn(), timeout]);
      const duration = Date.now() - stepStart;
      await prisma.agentTrace.create({
        data: { runId, seq: ++seq, step: name, ok: true, durationMs: duration, detail: redactPII(result) as any }
      });
      return result as T;
    } catch (e) {
      const duration = Date.now() - stepStart;
      const fallbackResult = fallback();
      fallbackUsed = true;
      emit({
        type: 'fallback_triggered',
        ts: new Date().toISOString(),
        data: { tool: name, reason: (e as Error)?.message || 'unknown_failure' }
      });
      await prisma.agentTrace.create({
        data: { runId, seq: ++seq, step: 'fallback_' + name, ok: true, durationMs: duration, detail: redactPII(fallbackResult) as any }
      });
      return fallbackResult as T | null;
    }
  };

  // Fetch alert & customer
  const alert = await prisma.alert.findUnique({ where: { id: alertId }, include: { customer: true } });
  if (!alert) throw new Error('Alert not found');

  // Build plan
  const plan = ["getProfile", "recentTx", "riskSignals", "kbLookup", "decide", "proposeAction"];
  {
    const ev = { type: 'plan_built', ts: new Date().toISOString(), data: { plan } } as TriageEvent;
    emit(ev);
    try {
      await prisma.agentTrace.create({ data: { runId, seq: ++seq, step: ev.type, ok: true, durationMs: 0, detail: ev.data } });
    } catch {}
  }

  // Execute steps
  const profile = await step('getProfile', () => getProfile(customerId));
  const recentTx = await step('recentTx', () => analyzeRecentTransactions(customerId, 90));
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const recentRaw = await prisma.transaction.findMany({ where: { customerId, ts: { gte: since } }, orderBy: { ts: 'desc' } });
  const risk = await step('riskSignals', () => runRiskSignals((alert as any).suspectTxnId, recentRaw || []), () => ({ score: 0.4, reasons: ['risk_unavailable'], action: null } as any));
  const kb = await step('kbLookup', () => lookupKB(((risk as any)?.reasons || []).join(' ')), () => [] as any);

  // Decision
  const decision = await step('decide', () => decideAction(risk as any, recentRaw || [], kb as any), () => ({
    recommended: 'MONITOR' as const,
    risk: 'MEDIUM' as const,
    reasons: ['fallback_used']
  }));

  {
    const ev = { type: 'decision_finalized', ts: new Date().toISOString(), data: decision as any } as TriageEvent;
    emit(ev);
    try {
      await prisma.agentTrace.create({ data: { runId, seq: ++seq, step: ev.type, ok: true, durationMs: 0, detail: ev.data } });
    } catch {}
  }

  const latency = Date.now() - start;
  await prisma.triageRun.update({
    where: { id: runId },
    data: {
      endedAt: new Date(),
      risk: (decision as any)?.risk,
      reasons: (decision as any)?.reasons,
      fallbackUsed,
      latencyMs: latency
    }
  });
}