import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Simple MCC -> Category mapping fallback
const MCC_CATEGORIES: Record<string, string> = {
  '5411': 'Grocery',
  '4121': 'Transport',
  '5732': 'Electronics',
  '4511': 'Travel',
  '5812': 'Dining',
  '5921': 'Beverage',
  '5541': 'Fuel',
  '7299': 'Services',
};

router.get('/:customerId/summary', async (req, res) => {
  try {
    const customerId = String(req.params.customerId);
    const rangeDays = Math.min(parseInt(String(req.query.days || '180'), 10) || 180, 365);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const txns = await prisma.transaction.findMany({
      where: { customerId, ts: { gte: since } },
      select: { id: true, mcc: true, merchant: true, amountCents: true, ts: true },
      orderBy: { ts: 'desc' },
      take: 10000, // cap to keep response bounded
    });

    const total = txns.reduce((s, t) => s + t.amountCents, 0) || 1;

    // Categories share
    const catSums = new Map<string, number>();
    for (const t of txns) {
      const cat = MCC_CATEGORIES[t.mcc] || 'Other';
      catSums.set(cat, (catSums.get(cat) || 0) + t.amountCents);
    }
    const categories = Array.from(catSums.entries())
      .map(([name, sum]) => ({ name, pct: +(sum / total).toFixed(4) }))
      .sort((a, b) => b.pct - a.pct);

    // Top merchants
    const merchantCounts = new Map<string, number>();
    for (const t of txns) merchantCounts.set(t.merchant, (merchantCounts.get(t.merchant) || 0) + 1);
    const topMerchants = Array.from(merchantCounts.entries())
      .map(([merchant, count]) => ({ merchant, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Monthly trend
    const monthBuckets = new Map<string, number>();
    for (const t of txns) {
      const d = new Date(t.ts);
      const bucket = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(bucket, (monthBuckets.get(bucket) || 0) + t.amountCents);
    }
    const monthlyTrend = Array.from(monthBuckets.entries())
      .map(([month, sum]) => ({ month, sum }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));

    // Simple anomaly: z-score on daily sums
    const dayBuckets = new Map<string, number>();
    for (const t of txns) {
      const d = new Date(t.ts);
      const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      dayBuckets.set(day, (dayBuckets.get(day) || 0) + t.amountCents);
    }
    const dayVals = Array.from(dayBuckets.values());
    const mean = dayVals.reduce((s, v) => s + v, 0) / (dayVals.length || 1);
    const std = Math.sqrt(dayVals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (dayVals.length || 1));
    const anomalies = Array.from(dayBuckets.entries())
      .map(([day, sum]) => ({ ts: day, z: std ? +(Math.abs(sum - mean) / std).toFixed(2) : 0, note: sum > mean ? 'spike' : 'dip' }))
      .filter(a => a.z >= 3)
      .slice(0, 10);

    res.json({ topMerchants, categories, monthlyTrend, anomalies });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
