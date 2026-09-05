import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/llm';
import { FIX_SYSTEM, buildFixUserPrompt } from '@/lib/prompts';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Gera o prompt corretivo a partir do relatório.
// MVP: gratuito — o clique já foi registrado como evento de intenção em /api/lead.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report = body?.report;
    if (!report || !Array.isArray(report.achados)) {
      return NextResponse.json({ error: 'Relatório inválido.' }, { status: 400 });
    }
    if (report.achados.length === 0) {
      return NextResponse.json({
        prompt:
          'Boa notícia: a auditoria não encontrou falhas acionáveis nas categorias verificadas. ' +
          'Mantenha a rotina: rode uma nova análise a cada mudança grande no projeto.'
      });
    }

    const prompt = await chatCompletion(
      [
        { role: 'system', content: FIX_SYSTEM },
        { role: 'user', content: buildFixUserPrompt(report) }
      ],
      { maxTokens: 4000 }
    );

    return NextResponse.json({ prompt });
  } catch (err: any) {
    const msg =
      err?.message === 'LLM_NO_CREDIT'
        ? 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.'
        : 'Não foi possível gerar o prompt agora. Tente novamente.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
