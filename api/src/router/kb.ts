import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/kb/search?q=
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });

    const results = await prisma.kbDoc.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
          { anchor: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, anchor: true, content: true },
      take: 20,
    });

    const shaped = results.map((r) => ({
      docId: r.id,
      title: r.title,
      anchor: r.anchor,
      extract: snippet(r.content, q, 140),
    }));

    res.json({ results: shaped });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal error' });
  }
});

function snippet(text: string, q: string, size: number) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, size);
  const start = Math.max(0, i - Math.floor(size / 3));
  const end = Math.min(text.length, start + size);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

export default router;
