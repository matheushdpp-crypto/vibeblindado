import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// Grava o lead na planilha do Google via webhook do Apps Script.
// Nunca falha para o usuário: se a planilha estiver fora, o fluxo continua.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lead = {
      timestamp: new Date().toISOString(),
      evento: String(body.evento || 'lead').slice(0, 40),          // 'lead' | 'fix_prompt_click'
      nome: String(body.nome || '').slice(0, 120),
      email: String(body.email || '').slice(0, 160),
      whatsapp: String(body.whatsapp || '').slice(0, 40),
      repo: String(body.repo || '').slice(0, 300),
      nota: String(body.nota || '').slice(0, 4),
      ip: getClientIp(req)
    };

    const webhook = process.env.SHEETS_WEBHOOK_URL;
    if (webhook) {
      // Apps Script responde com redirect 302; seguimos e ignoramos o corpo
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
        redirect: 'follow'
      }).catch(() => null);
    } else {
      console.log('[lead] (SHEETS_WEBHOOK_URL não configurada)', lead);
    }
  } catch { /* nunca bloqueia o funil */ }

  return NextResponse.json({ ok: true });
}
