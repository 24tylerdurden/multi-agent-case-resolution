// agents/kb.ts
import prisma from '../lib/prisma';

export async function lookupKB(query: string): Promise<Array<{ title: string; anchor: string; extract: string }>> {
  // Simple keyword match (offline, deterministic)
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (keywords.length === 0) return [];

  const conditions = keywords.map(k => `content_text ILIKE '%${k}%'`).join(' AND ');
  const results = await prisma.$queryRawUnsafe(`
    SELECT title, anchor, LEFT(content_text, 200) as extract
    FROM kb_docs
    WHERE ${conditions}
    LIMIT 3
  `);
  return results;
}