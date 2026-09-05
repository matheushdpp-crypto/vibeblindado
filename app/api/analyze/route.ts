import { NextRequest } from 'next/server';
import { parseRepoUrl, fetchRepoBundle } from '@/lib/github';
import { chatCompletion, extractJson } from '@/lib/llm';
import { AUDIT_SYSTEM, buildAuditUserPrompt } from '@/lib/prompts';
import { checkRateLimit, getClientIp } from '@/lib/ratelimit';

export const maxDuration = 300; // streaming longo; Vercel ajusta ao teto do plano
export const dynamic = 'force-dynamic';

const ERROS: Record<string, string> = {
  REPO_NOT_FOUND: 'Repositório não encontrado. Confira o link: ele precisa ser público.',
  REPO_PRIVATE: 'Este repositório é privado. Torne-o público temporariamente ou use um fork público para a análise.',
  REPO_TOO_BIG: 'Repositório grande demais para a análise gratuita (limite ~500MB).',
  GITHUB_RATE_LIMIT: 'Limite da API do GitHub atingido. Tente novamente em alguns minutos.',
  LLM_NOT_CONFIGURED: 'O serviço de análise não está configurado. (Admin: defina LLM_API_KEY.)',
  LLM_AUTH: 'Falha de autenticação com o serviço de análise. (Admin: confira LLM_API_KEY.)',
  LLM_NO_CREDIT: 'O serviço de análise está sem créditos no momento. Deixe seu e-mail que avisamos quando voltar.',
  LLM_RATE_LIMIT: 'Muitas análises simultâneas. Tente novamente em um minuto.',
  LLM_BAD_JSON: 'A análise retornou um formato inesperado. Tente novamente. Se persistir, nos avise.'
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(ip);

  let body: any = {};
  try { body = await req.json(); } catch { /* segue com vazio */ }
  const parsed = typeof body.repo === 'string' ? parseRepoUrl(body.repo) : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const fail = (message: string) => {
        send({ type: 'error', message });
        controller.close();
      };

      try {
        if (!limit.ok) return fail(limit.reason!);
        if (!parsed) return fail('Link inválido. Use o formato github.com/usuario/repositorio.');

        send({ type: 'status', message: `Conectando ao GitHub: ${parsed.owner}/${parsed.repo}` });

        const bundle = await fetchRepoBundle(parsed.owner, parsed.repo, (msg) =>
          send({ type: 'status', message: msg })
        );

        if (bundle.files.length === 0) {
          return fail('Não encontramos arquivos de código analisáveis neste repositório.');
        }

        send({ type: 'status', message: `${bundle.files.length} arquivos selecionados para auditoria.` });
        send({ type: 'status', message: 'Detectando stack e mecanismos de autenticação...' });
        send({ type: 'status', message: 'Auditando: isolamento de dados, permissões, IDOR, chaves expostas, XSS...' });

        // Heartbeat de progresso enquanto a LLM gera (mantém a conexão viva)
        let tokens = 0;
        let lastBeat = Date.now();
        const raw = await chatCompletion(
          [
            { role: 'system', content: AUDIT_SYSTEM },
            { role: 'user', content: buildAuditUserPrompt(bundle) }
          ],
          {
            json: true,
            maxTokens: 6000,
            onToken: () => {
              tokens++;
              if (Date.now() - lastBeat > 6000) {
                lastBeat = Date.now();
                send({ type: 'status', message: `Escrevendo relatório... (${tokens} tokens)` });
              }
            }
          }
        );

        const report = extractJson(raw);
        report.projeto = report.projeto || bundle.fullName;
        report.arquivosAnalisados = bundle.files.length;
        if (!Array.isArray(report.achados)) report.achados = [];
        if (!Array.isArray(report.pontosFortes)) report.pontosFortes = [];
        if (!Array.isArray(report.recomendacoes)) report.recomendacoes = [];
        if (!Array.isArray(report.limitacoes)) report.limitacoes = [];

        send({ type: 'report', report });
        controller.close();
      } catch (err: any) {
        const msg = ERROS[err?.message] || 'Algo falhou durante a análise. Tente novamente em instantes.';
        fail(msg);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
