import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/customer/:id/transactions?from=&to=&cursor=&limit=
// Keyset pagination using (ts,id) cursor encoded as base64 JSON
router.get('/:id/transactions', async (req, res) => {
  try {
    const customerId = String(req.params.id);
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const cursorRaw = req.query.cursor ? String(req.query.cursor) : undefined;

    let cursor: { ts: Date; id: string } | undefined = undefined;
    if (cursorRaw) {
      try {
        const decoded = JSON.parse(Buffer.from(cursorRaw, 'base64').toString('utf8'));
        cursor = { ts: new Date(decoded.ts), id: String(decoded.id) };
      } catch {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
    }

    // Build where clause
    const where: any = { customerId };
    if (from || to) {
      where.ts = {};
      if (from) where.ts.gte = from;
      if (to) where.ts.lte = to;
    }

    // If cursor provided, only fetch older than cursor (descending order)
    if (cursor) {
      where.OR = [
        { ts: { lt: cursor.ts } },
        { AND: [{ ts: cursor.ts }, { id: { lt: cursor.id } }] },
      ];
    }

    const items = await prisma.transaction.findMany({
      where,
      orderBy: [{ ts: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        cardId: true,
        mcc: true,
        merchant: true,
        amountCents: true,
        currency: true,
        ts: true,
        deviceId: true,
        country: true,
        city: true,
      },
    });

    let nextCursor: string | null = null;
    if (items.length === limit) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ ts: last.ts.toISOString(), id: last.id }), 'utf8').toString('base64');
    }

    res.json({ items, nextCursor });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
