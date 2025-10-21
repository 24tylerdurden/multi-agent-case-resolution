type Decision = { recommended: 'FREEZE_CARD' | 'OPEN_DISPUTE' | 'CONTACT_CUSTOMER' | 'MONITOR'; risk: 'HIGH' | 'MEDIUM' | 'LOW'; reasons?: string[] };

export async function decideAction(risk: any, recentTx: any[], kb: any[]): Promise<Decision> {
  const score = Number(risk?.score ?? 0);
  if (score >= 0.75) return { recommended: 'FREEZE_CARD', risk: 'HIGH', reasons: risk?.reasons || [] };
  if (score >= 0.6) return { recommended: 'OPEN_DISPUTE', risk: 'HIGH', reasons: risk?.reasons || [] };
  if (score >= 0.4) return { recommended: 'CONTACT_CUSTOMER', risk: 'MEDIUM', reasons: risk?.reasons || [] };
  return { recommended: 'MONITOR', risk: 'LOW', reasons: risk?.reasons || [] };
}
