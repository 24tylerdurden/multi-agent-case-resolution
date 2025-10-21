export function redactPII(input: any): any {
  try {
    if (!input || typeof input !== 'object') return input;
    const clone = JSON.parse(JSON.stringify(input));
    const redactKeys = new Set(['email', 'phone', 'ssn', 'pan', 'cardNumber']);
    const walk = (obj: any) => {
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v && typeof v === 'object') walk(v);
        if (redactKeys.has(k)) obj[k] = '***REDACTED***';
      }
    };
    walk(clone);
    return clone;
  } catch {
    return input;
  }
}
