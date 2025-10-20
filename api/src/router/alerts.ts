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

export default router;
