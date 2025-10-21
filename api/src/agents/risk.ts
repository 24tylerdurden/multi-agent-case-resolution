// agents/risk.ts
import prisma from '../lib/prisma';
import { z } from 'zod';

const RiskOutput = z.object({
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  action: z.enum(['FREEZE_CARD', 'OPEN_DISPUTE', 'CONTACT_CUSTOMER', 'MONITOR']).optional()
});

export async function runRiskSignals(txnId: string, recentTx: any[]) {
  const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
  if (!txn) throw new Error('Transaction not found');

  const reasons: string[] = [];
  let score = 0.2;

  // Rule 1: High amount
  if (txn.amountCents > 400000) { // > $4000
    reasons.push('high_amount');
    score += 0.3;
  }

  // Rule 2: Rare MCC
  const mccCount = recentTx.filter(t => t.mcc === txn.mcc).length;
  if (mccCount === 1) {
    reasons.push('mcc_rarity');
    score += 0.25;
  }

  // Rule 3: Device change
  const lastDevice = recentTx[1]?.deviceId;
  if (lastDevice && lastDevice !== txn.deviceId) {
    reasons.push('device_change');
    score += 0.2;
  }

  // Rule 4: Foreign country
  if (txn.country !== 'US' && !recentTx.some(t => t.country === txn.country)) {
    reasons.push('foreign_first_time');
    score += 0.15;
  }

  let action: string | undefined;
  if (score >= 0.75) action = 'FREEZE_CARD';
  else if (score >= 0.6) action = 'OPEN_DISPUTE';

  return RiskOutput.parse({ score: Math.min(score, 1.0), reasons, action });
}