# BLINDADO — auditoria de segurança para apps vibecodados

MVP: o usuário cola o link de um repositório **público** do GitHub, deixa o contato
(lead → planilha do Google) e recebe na tela um relatório de auditoria de segurança
gerado por IA, com nota, achados por severidade e um **prompt corretivo** pronto para
colar no Cursor/Lovable/Claude.

Sem banco de dados. Sem e-mail. Deploy em minutos na Vercel.

---

## 1. Rodar localmente

```bash
cd blindado
copy .env.example .env.local     # (Windows) — depois edite o arquivo
npm install
npm run dev
```

Abra http://localhost:3000. Sem `LLM_API_KEY` o site abre normalmente,
mas a análise retorna erro amigável.

## 2. Variáveis de ambiente

| Variável | Obrigatória | O que é |
|---|---|---|
| `LLM_API_KEY` | ✅ | Chave da API de IA (DeepSeek, OpenAI...) |
| `LLM_BASE_URL` | — | Padrão `https://api.deepseek.com` |
| `LLM_MODEL` | — | Padrão `deepseek-chat` |
| `SHEETS_WEBHOOK_URL` | recomendada | Webhook do Apps Script que grava leads na planilha |
| `GITHUB_TOKEN` | recomendada | Token público do GitHub — sobe o limite de 60 para 5000 requisições/hora |
| `RATE_LIMIT_PER_HOUR` | — | Análises por IP/hora (padrão 3) |
| `DAILY_ANALYSIS_CAP` | — | Teto diário global de análises (padrão 100) — protege seu saldo |

**DeepSeek:** crie a chave em https://platform.deepseek.com → API Keys.
Custo por análise: centavos de real (o código enviado é limitado a ~85k tokens).

**GitHub token:** https://github.com/settings/tokens → "Generate new token (classic)"
→ marque apenas `public_repo`. Sem ele, ~60 análises/hora no total já estouram o limite do GitHub.

## 3. Planilha do Google (captação de leads)

1. Crie uma planilha no Google Sheets com os cabeçalhos na linha 1:
   `timestamp | evento | nome | email | whatsapp | repo | nota | ip`
2. Menu **Extensões → Apps Script**, apague o conteúdo e cole:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var d = JSON.parse(e.postData.contents);
  sheet.appendRow([d.timestamp, d.evento, d.nome, d.email, d.whatsapp, d.repo, d.nota, d.ip]);
  return ContentService.createTextOutput('ok');
}
```

3. **Implantar → Nova implantação → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Copie a URL gerada (termina em `/exec`) e coloque em `SHEETS_WEBHOOK_URL`.

Eventos gravados: `lead` (preencheu o modal) e `fix_prompt_click`
(clicou em "Gerar prompt corretivo" — sua métrica de intenção de compra).

## 4. Deploy na Vercel

1. Suba a pasta `blindado` para um repositório no GitHub (pode ser privado).
2. Em https://vercel.com → **Add New → Project** → importe o repositório.
3. Em **Environment Variables**, adicione as variáveis do passo 2.
4. Deploy. Pronto.

> A rota de análise usa streaming com `maxDuration = 300`. No plano gratuito da
> Vercel, ative **Fluid Compute** (padrão em projetos novos) para análises longas.

## 5. Segurança do próprio MVP

- Chave da LLM só existe no servidor; nunca vai ao navegador.
- Rate limit por IP + teto diário global (memória — suficiente para MVP;
  se escalar, trocar por Upstash Redis, plano grátis).
- Só aceita repositórios públicos do GitHub — nenhuma URL arbitrária é acessada.
- Código analisado não é armazenado.

## 6. Roadmap (fora do MVP)

- Análise de site no ar (URL) com framework próprio de verificação superficial.
- Cobrança do prompt corretivo (Stripe Payment Link / Kiwify) quando a taxa de
  clique em `fix_prompt_click` validar a demanda.
- E-mail com o relatório (Resend, grátis até 3k/mês) e PDF para download.
- Repositórios privados via GitHub App (leitura somente).
