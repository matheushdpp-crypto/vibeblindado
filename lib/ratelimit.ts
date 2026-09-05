// Rate limit em memória. Em serverless cada instância tem seu próprio Map,
// então isso é um freio de mão, não uma tranca — suficiente para MVP.
// Se o produto validar, trocar por Upstash Redis (grátis) — ver README.

const ipHits = new Map<string, number[]>();
let dailyCount = 0;
let dailyDate = '';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function checkRateLimit(ip: string): { ok: boolean; reason?: string } {
  const perHour = parseInt(process.env.RATE_LIMIT_PER_HOUR || '3', 10);
  const dailyCap = parseInt(process.env.DAILY_ANALYSIS_CAP || '100', 10);

  if (dailyDate !== today()) { dailyDate = today(); dailyCount = 0; }
  if (dailyCount >= dailyCap) {
    return { ok: false, reason: 'Atingimos o limite diário de análises gratuitas. Volte amanhã, ou deixe seu e-mail que avisamos.' };
  }

  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (hits.length >= perHour) {
    return { ok: false, reason: `Limite de ${perHour} análises por hora atingido. Tente novamente em breve.` };
  }
  hits.push(now);
  ipHits.set(ip, hits);
  dailyCount++;

  // higiene: não deixar o Map crescer sem limite
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (v.every((t) => now - t > 3_600_000)) ipHits.delete(k);
    }
  }
  return { ok: true };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'unknown';
}
