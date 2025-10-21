import prisma from "../lib/prisma";
import {z} from 'zod';
import {redactPII} from '../lib/redactor'


export const TransactionInsightSchema = z.object({
  topMerchants: z.array(z.object({
    merchant: z.string(),
    count: z.number(),
    totalCents: z.number()
  })),
  categories: z.array(z.object({
    name: z.string(),
    pct: z.number(),
    totalCents: z.number()
  })),
  monthlyTrend: z.array(z.object({
    month: z.string(), // "2025-07"
    sum: z.number()    // in cents
  })),
  anomalies: z.array(z.object({
    ts: z.string(),
    zScore: z.number(),
    note: z.string(),
    amountCents: z.number()
  })),
  riskSignals: z.array(z.string()),
  summary: z.string()
});


export type TransactionInsights = z.infer<typeof TransactionInsightSchema>;

function getCategory(mcc: string | null): string {
  if (!mcc) return 'Other';
  return MCC_CATEGORIES[mcc] || MCC_CATEGORIES['default'];
}

const MCC_CATEGORIES: Record<string, string> = {
  '4121': 'Transport',
  '5411': 'Groceries',
  '5812': 'Restaurants',
  '5977': 'Health',
  '5964': 'Online Shopping',
  '7995': 'Entertainment',
  '4814': 'Utilities',
  'default': 'Other'
};


export async function analyzeRecentTransactions(customerId: string, days = 90): Promise<TransactionInsights> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Fetch transactions (optimized with index)
  const txns = await prisma.transaction.findMany({
    where: {
      customerId,
      ts: { gte: since }
    },
    orderBy: { ts: 'desc' }
  });

  if (txns.length === 0) {
    return TransactionInsightSchema.parse({
      topMerchants: [],
      categories: [],
      monthlyTrend: [],
      anomalies: [],
      riskSignals: ['no_recent_activity'],
      summary: 'No transactions in the last ' + days + ' days.'
    });
  }

  // === 1. Top Merchants ===
  const merchantMap = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    const key = t.merchant || 'Unknown';
    const entry = merchantMap.get(key) || { count: 0, total: 0 };
    entry.count++;
    entry.total += t.amountCents;
    merchantMap.set(key, entry);
  }
  const topMerchants = Array.from(merchantMap.entries())
    .map(([merchant, { count, total }]) => ({ merchant, count, totalCents: total }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 5);

  // === 2. Categories ===
  const categoryMap = new Map<string, { total: number }>();
  for (const t of txns) {
    const cat = getCategory(t.mcc);
    const entry = categoryMap.get(cat) || { total: 0 };
    entry.total += t.amountCents;
    categoryMap.set(cat, entry);
  }
  const totalSpend = txns.reduce((sum, t) => sum + t.amountCents, 0);
  const categories = Array.from(categoryMap.entries())
    .map(([name, { total }]) => ({
      name,
      totalCents: total,
      pct: totalSpend ? Number((total / totalSpend).toFixed(3)) : 0
    }))
    .sort((a, b) => b.pct - a.pct);

  // === 3. Monthly Trend ===
  const monthly = new Map<string, number>();
  for (const t of txns) {
    const month = t.ts.toISOString().slice(0, 7); // "2025-07"
    monthly.set(month, (monthly.get(month) || 0) + t.amountCents);
  }
  const monthlyTrend = Array.from(monthly.entries())
    .map(([month, sum]) => ({ month, sum }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // === 4. Anomaly Detection (Z-score on daily spend) ===
  const dailySpend = new Map<string, number>();
  for (const t of txns) {
    const day = t.ts.toISOString().slice(0, 10);
    dailySpend.set(day, (dailySpend.get(day) || 0) + t.amountCents);
  }
  const dailyAmounts = Array.from(dailySpend.values());
  const mean = dailyAmounts.reduce((a, b) => a + b, 0) / dailyAmounts.length;
  const variance = dailyAmounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyAmounts.length;
  const stdDev = Math.sqrt(variance);
  const anomalies: Array<{ ts: string; zScore: number; note: string; amountCents: number }> = [];

  if (stdDev > 0) {
    for (const t of txns) {
      const day = t.ts.toISOString().slice(0, 10);
      const dayTotal = dailySpend.get(day)!;
      const z = (dayTotal - mean) / stdDev;
      if (z > 2.5) {
        anomalies.push({
          ts: t.ts.toISOString(),
          zScore: Number(z.toFixed(2)),
          note: 'Unusual daily spend spike',
          amountCents: t.amountCents
        });
      }
    }
  }

  // === 5. Risk Signals ===
  const riskSignals: string[] = [];

  // High single transaction
  const maxTx = txns.reduce((a, b) => (a.amountCents > b.amountCents ? a : b));
  if (maxTx.amountCents > 400000) { // > $4000
    riskSignals.push('high_single_transaction');
  }

  // Foreign country (non-US first time)
  const usTxns = txns.filter(t => t.country === 'US');
  const foreignTxns = txns.filter(t => t.country !== 'US');
  if (foreignTxns.length > 0 && usTxns.length === txns.length - 1) {
    riskSignals.push('first_foreign_transaction');
  }

  // Velocity: >5 txns in 1 hour
  const sorted = [...txns].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  for (let i = 0; i <= sorted.length - 5; i++) {
    const window = sorted.slice(i, i + 5);
    const diffMs = window[4].ts.getTime() - window[0].ts.getTime();
    if (diffMs < 60 * 60 * 1000) { // 1 hour
      riskSignals.push('high_velocity');
      break;
    }
  }

  // === 6. Summary (deterministic template) ===
  let summary = `Analyzed ${txns.length} transactions over ${days} days.`;
  if (riskSignals.length > 0) {
    summary += ` Detected ${riskSignals.length} risk signal(s): ${riskSignals.join(', ')}.`;
  }
  if (anomalies.length > 0) {
    summary += ` Found ${anomalies.length} spending anomaly(ies).`;
  }

  const result = {
    topMerchants,
    categories,
    monthlyTrend,
    anomalies,
    riskSignals,
    summary
  };

  // Validate & redact (safe for logs/UI)
  return TransactionInsightSchema.parse(redactPII(result));
}
