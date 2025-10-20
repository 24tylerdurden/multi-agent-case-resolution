import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function requireApiKey(req: any, res: any): string | undefined {
  const key = req.header('X-API-Key') || req.header('x-api-key');
  if (!key) {
    res.status(401).json({ error: 'missing_api_key' });
    return undefined;
  }
  // For now accept any non-empty key; extend with RBAC later.
  return key as string;
}

// Simple in-memory idempotency cache for demo purposes (per-process)
const idemCache = new Map<string, any>();
function idempotencyKey(req: any): string | undefined {
  return (req.header('Idempotency-Key') || req.header('idempotency-key')) as string | undefined;
}

// POST /api/action/freeze-card
// Req: { cardId, otp? } → { status:"PENDING_OTP"|"FROZEN", requestId }
router.post('/freeze-card', async (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;
    const key = idempotencyKey(req);
    if (key && idemCache.has(key)) return res.json(idemCache.get(key));

    const { cardId, otp } = req.body || {};
    if (!cardId) return res.status(400).json({ error: 'cardId required' });

    const card = await prisma.card.findUnique({ where: { id: String(cardId) } });
    if (!card) return res.status(404).json({ error: 'card_not_found' });

    const requestId = `req_${Date.now()}_${Math.floor(Math.random()*1e6)}`;

    // Policy: require OTP unless already FROZEN
    if (card.status !== 'FROZEN') {
      if (otp !== '123456') {
        const resp = { status: 'PENDING_OTP', requestId };
        if (key) idemCache.set(key, resp);
        // Audit event (no case id, create a case-less event?) Create small case for audit trail
        await prisma.case.create({
          data: {
            id: `case_${Date.now()}_${Math.floor(Math.random()*1e6)}`,
            customerId: card.customerId,
            type: 'FRAUD',
            status: 'OPEN',
            reasonCode: 'otp_required',
            events: {
              create: [{ actor: 'agent', action: 'freeze_card', payload: { otpRequired: true, requestId } }]
            }
          }
        });
        return res.json(resp);
      }
    }

    // Freeze card
    await prisma.card.update({ where: { id: card.id }, data: { status: 'FROZEN' } });

    // Append audit event to a case (create if missing)
    const caseId = `case_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    await prisma.case.create({
      data: {
        id: caseId,
        customerId: card.customerId,
        type: 'FRAUD',
        status: 'OPEN',
        reasonCode: 'freeze_card',
        events: {
          create: [{ actor: 'agent', action: 'freeze_card', payload: { status: 'FROZEN', requestId } }]
        }
      }
    });

    const resp = { status: 'FROZEN', requestId } as const;
    if (key) idemCache.set(key, resp);
    return res.json(resp);
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/action/open-dispute
// Req: { txnId, reasonCode, confirm } → { caseId, status:"OPEN" }
router.post('/open-dispute', async (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;
    const key = idempotencyKey(req);
    if (key && idemCache.has(key)) return res.json(idemCache.get(key));

    const { txnId, reasonCode, confirm } = req.body || {};
    if (!txnId || !reasonCode || confirm !== true) {
      return res.status(400).json({ error: 'txnId, reasonCode and confirm=true required' });
    }

    const txn = await prisma.transaction.findUnique({ where: { id: String(txnId) } });
    if (!txn) return res.status(404).json({ error: 'transaction_not_found' });

    const caseId = `case_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    await prisma.case.create({
      data: {
        id: caseId,
        customerId: txn.customerId,
        txnId: txn.id,
        type: 'DISPUTE',
        status: 'OPEN',
        reasonCode: String(reasonCode),
        events: { create: [{ actor: 'agent', action: 'open_dispute', payload: { txnId: txn.id, reasonCode } }] }
      }
    });

    const resp = { caseId, status: 'OPEN' } as const;
    if (key) idemCache.set(key, resp);
    return res.json(resp);
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
