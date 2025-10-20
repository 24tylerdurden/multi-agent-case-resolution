import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/alerts?cursor=&limit=
// Simple id-desc keyset pagination
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

  const where: any = {};
  if (cursor) {
    where.id = { lt: cursor };
  }

  const items = await prisma.alert.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit,
    select: { id: true, customerId: true, suspectTxnId: true, createdAt: true, risk: true, status: true }
  });

  const nextCursor = items.length === limit ? items[items.length - 1].id : null;
  res.json({ items, nextCursor });
});

// PATCH /api/alerts/:id { status: "open" | "resolved" }
router.patch('/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body || {};
    if (status !== 'open' && status !== 'resolved') {
      return res.status(400).json({ error: 'invalid_status' });
    }
    const updated = await prisma.alert.update({
      where: { id },
      data: { status },
      select: { id: true, customerId: true, suspectTxnId: true, createdAt: true, risk: true, status: true }
    });
    res.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'not_found' });
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
