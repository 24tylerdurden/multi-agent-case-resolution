export type Alert = { id: string; customerId: string; suspectTxnId?: string | null; createdAt: string; risk: string; status: string };
export type AlertsPage = { items: Alert[]; nextCursor: string | null };

export async function fetchAlerts(cursor?: string, limit = 50): Promise<AlertsPage> {
  const url = new URL('/api/alerts', window.location.origin);
  if (cursor) url.searchParams.set('cursor', cursor);
  url.searchParams.set('limit', String(limit));
  const r = await fetch(url);
  if (!r.ok) throw new Error('failed_alerts');
  return r.json();
}

export type Txn = { id: string; cardId?: string | null; mcc: string; merchant: string; amountCents: number; currency: string; ts: string; deviceId?: string | null; country?: string | null; city?: string | null };
export type TxnPage = { items: Txn[]; nextCursor: string | null };

export async function fetchCustomerTxns(customerId: string, params: { from?: string; to?: string; cursor?: string; limit?: number } = {}): Promise<TxnPage> {
  const url = new URL(`/api/customer/${encodeURIComponent(customerId)}/transactions`, window.location.origin);
  if (params.from) url.searchParams.set('from', params.from);
  if (params.to) url.searchParams.set('to', params.to);
  if (params.cursor) url.searchParams.set('cursor', params.cursor);
  url.searchParams.set('limit', String(params.limit ?? 50));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error('failed_txns');
  return r.json();
}

export type Insights = { topMerchants: { merchant: string; count: number }[]; categories: { name: string; pct: number }[]; monthlyTrend: { month: string; sum: number }[]; anomalies: { ts: string; z: number; note: string }[] };
export async function fetchInsights(customerId: string, days = 180): Promise<Insights> {
  const url = new URL(`/api/insights/${encodeURIComponent(customerId)}/summary`, window.location.origin);
  url.searchParams.set('days', String(days));
  const r = await fetch(url);
  if (!r.ok) throw new Error('failed_insights');
  return r.json();
}

export async function startTriage(alertId: string): Promise<{ runId: string; alertId: string }> {
  const r = await fetch('/api/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertId }) });
  if (!r.ok) throw new Error('failed_triage');
  return r.json();
}

export async function actionFreezeCard(cardId: string, otp?: string): Promise<{ status: 'PENDING_OTP' | 'FROZEN'; requestId: string }> {
  const r = await fetch('/api/action/freeze-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test', 'Idempotency-Key': `fe-${Date.now()}-${Math.random()}` },
    body: JSON.stringify({ cardId, otp })
  });
  if (!r.ok) throw new Error('failed_freeze');
  return r.json();
}

export async function actionOpenDispute(txnId: string, reasonCode: string): Promise<{ caseId: string; status: 'OPEN' }> {
  const r = await fetch('/api/action/open-dispute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test', 'Idempotency-Key': `fe-${Date.now()}-${Math.random()}` },
    body: JSON.stringify({ txnId, reasonCode, confirm: true })
  });
  if (!r.ok) throw new Error('failed_open_dispute');
  return r.json();
}

export async function kbSearch(q: string): Promise<{ results: { docId: string; title: string; anchor: string; extract: string }[] }> {
  const url = new URL('/api/kb/search', window.location.origin);
  url.searchParams.set('q', q);
  const r = await fetch(url);
  if (!r.ok) throw new Error('failed_kb');
  return r.json();
}
