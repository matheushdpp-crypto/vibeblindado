// Cliente mínimo para qualquer API compatível com OpenAI (DeepSeek, OpenAI, etc.)
// Sem SDK: uma dependência a menos, controle total do streaming.

interface ChatMessage { role: 'system' | 'user'; content: string; }

export async function chatCompletion(
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; onToken?: (chunk: string) => void } = {}
): Promise<string> {
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'deepseek-chat';
  if (!apiKey) throw new Error('LLM_NOT_CONFIGURED');

  const body: any = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 6000,
    stream: true
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('LLM_AUTH');
    if (res.status === 402 || errText.includes('insufficient')) throw new Error('LLM_NO_CREDIT');
    if (res.status === 429) throw new Error('LLM_RATE_LIMIT');
    throw new Error(`LLM_ERROR_${res.status}`);
  }

  // Consome o stream SSE da API e concatena os tokens
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content || '';
        if (token) { full += token; opts.onToken?.(token); }
      } catch { /* linha parcial, ignora */ }
    }
  }
  return full;
}

// Extrai JSON de uma resposta que pode vir com cercas de código ou texto ao redor
export function extractJson(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* tenta recorte */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* cai no erro abaixo */ }
  }
  throw new Error('LLM_BAD_JSON');
}
