// Gera um arquivo HTML autocontido do relatório, para download no navegador.
// Na tela: mesmo design escuro da plataforma. Na impressão (Ctrl+P → PDF):
// vira automaticamente a versão clara, legível no papel.

import type { Relatorio, Severidade } from './types';

const SEV: Record<Severidade, { label: string; dark: string; print: string }> = {
  critica: { label: 'Crítica', dark: '#f87171', print: '#B91C1C' },
  alta: { label: 'Alta', dark: '#fb923c', print: '#EA580C' },
  media: { label: 'Média', dark: '#fbbf24', print: '#D97706' },
  baixa: { label: 'Baixa', dark: '#60a5fa', print: '#2563EB' },
  informativa: { label: 'Informativa', dark: '#94a3b8', print: '#64748B' }
};
const GRADE: Record<string, { dark: string; print: string }> = {
  A: { dark: '#34d399', print: '#059669' },
  B: { dark: '#60a5fa', print: '#2563EB' },
  C: { dark: '#fbbf24', print: '#D97706' },
  D: { dark: '#fb923c', print: '#EA580C' },
  F: { dark: '#f87171', print: '#B91C1C' }
};
const ORDER: Severidade[] = ['critica', 'alta', 'media', 'baixa', 'informativa'];

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildReportHtml(r: Relatorio): string {
  const grade = GRADE[r.nota] || GRADE.C;
  const counts = { critica: 0, alta: 0, media: 0, baixa: 0, informativa: 0 } as Record<Severidade, number>;
  for (const a of r.achados) if (counts[a.severidade] !== undefined) counts[a.severidade]++;
  const total = r.achados.length;
  const data = new Date().toLocaleDateString('pt-BR');

  const sevRow = ORDER.map(
    (s) => `<div class="sev-box sev-${s}"><div class="sev-n">${counts[s]}</div><div class="sev-l">${SEV[s].label}</div></div>`
  ).join('');

  const sorted = [...r.achados].sort((a, b) => ORDER.indexOf(a.severidade) - ORDER.indexOf(b.severidade));
  const achados = sorted.map((a, i) => `
    <div class="achado">
      <div class="achado-head">
        <span class="chip sev-${a.severidade}">${esc(SEV[a.severidade]?.label || a.severidade)}</span>
        <span class="cat">${esc(a.categoria)}</span>
      </div>
      <h3>${i + 1}. ${esc(a.titulo)}</h3>
      ${a.arquivo ? `<div class="loc">${esc(a.arquivo)}${a.linha ? ':' + esc(a.linha) : ''}</div>` : ''}
      ${a.evidencia ? `<pre>${esc(a.evidencia)}</pre>` : ''}
      <p>${esc(a.descricao)}</p>
      ${a.impacto ? `<p><b>Impacto:</b> ${esc(a.impacto)}</p>` : ''}
      ${a.correcao ? `<p><b>Correção:</b> ${esc(a.correcao)}</p>` : ''}
    </div>`).join('');

  const fortes = r.pontosFortes.map(
    (p) => `<li><b>${esc(p.titulo)}</b><br><span class="ev">${esc(p.evidencia)}</span></li>`
  ).join('');

  const recs = [...r.recomendacoes].sort((a, b) => a.prioridade - b.prioridade).map(
    (rec) => `<li><span class="pri">P${esc(rec.prioridade)}</span> ${esc(rec.texto)}</li>`
  ).join('');

  const limits = r.limitacoes.map((l) => `<li>${esc(l)}</li>`).join('');

  const sevVars = ORDER.map((s) => `--sev-${s}: ${SEV[s].dark};`).join(' ');
  const sevVarsPrint = ORDER.map((s) => `--sev-${s}: ${SEV[s].print};`).join(' ');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório de Auditoria de Segurança · ${esc(r.projeto)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Archivo:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0e14; --surface: #0e141d; --line: #1c2632; --line-bright: #2b3848;
    --text: #dce5ee; --muted: #8494a8; --faint: #56657a;
    --amber: #ffb454; --forte: #34d399;
    --grade: ${grade.dark};
    ${sevVars}
    --evid-bg: #070b10;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: var(--bg); color: var(--text);
    font-family: 'Archivo', 'Segoe UI', system-ui, sans-serif;
    line-height: 1.6; font-size: 15px;
  }
  .display { font-family: 'Chakra Petch', 'Segoe UI', sans-serif; }
  .mono { font-family: 'IBM Plex Mono', Consolas, monospace; }
  .page { max-width: 860px; margin: 0 auto; padding: 44px 32px 60px; }
  header {
    display:flex; justify-content:space-between; align-items:center;
    border-bottom: 1px solid var(--line-bright); padding-bottom: 16px; margin-bottom: 30px;
  }
  .brand { font-family:'Chakra Petch', sans-serif; font-weight:700; font-size:17px; letter-spacing:.14em; }
  .brand .cur { color: var(--amber); margin-left: 2px; }
  .brand small {
    font-family:'IBM Plex Mono', monospace; font-weight:400; font-size:11px;
    letter-spacing:.05em; color: var(--faint); margin-left: 12px;
  }
  .date { font-family:'IBM Plex Mono', monospace; font-size:12px; color: var(--faint); }
  h1 { font-family:'Chakra Petch', sans-serif; font-size:24px; word-break:break-all; margin-bottom:4px; }
  .stack { font-family:'IBM Plex Mono', monospace; font-size:12.5px; color: var(--faint); margin-bottom:24px; }
  .topgrid {
    display:flex; gap:28px; align-items:flex-start; margin-bottom:26px;
    background: var(--surface); border: 1px solid var(--line-bright); padding: 26px 30px;
  }
  .grade {
    font-family:'Chakra Petch', sans-serif; font-size:58px; font-weight:700;
    color: var(--grade); border:1px solid var(--grade); padding:2px 22px; line-height:1.3;
  }
  .resumo { flex:1; font-size:14.5px; color: var(--muted); }
  .sev-row { display:flex; gap:10px; margin-bottom:38px; flex-wrap:wrap; }
  .sev-box {
    flex:1; min-width:100px; background: var(--surface); border:1px solid var(--line);
    border-top:3px solid currentColor; padding:10px 0 8px; text-align:center;
  }
  .sev-box.sev-critica { color: var(--sev-critica); } .sev-box.sev-alta { color: var(--sev-alta); }
  .sev-box.sev-media { color: var(--sev-media); } .sev-box.sev-baixa { color: var(--sev-baixa); }
  .sev-box.sev-informativa { color: var(--sev-informativa); }
  .sev-n { font-family:'Chakra Petch', sans-serif; font-size:24px; font-weight:700; color: var(--text); }
  .sev-l { font-family:'IBM Plex Mono', monospace; font-size:10px; color: var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  h2 {
    font-family:'IBM Plex Mono', monospace; font-size:12px; font-weight:500;
    text-transform:uppercase; letter-spacing:.11em; color: var(--faint);
    border-bottom:1px solid var(--line); padding-bottom:9px; margin:38px 0 20px;
  }
  .achado { margin-bottom:26px; page-break-inside:avoid; }
  .achado-head { display:flex; gap:12px; align-items:center; margin-bottom:5px; }
  .chip {
    font-family:'IBM Plex Mono', monospace; font-size:10px; font-weight:500;
    text-transform:uppercase; letter-spacing:.09em; padding:3px 9px; border:1px solid currentColor;
  }
  .chip.sev-critica { color: var(--sev-critica); } .chip.sev-alta { color: var(--sev-alta); }
  .chip.sev-media { color: var(--sev-media); } .chip.sev-baixa { color: var(--sev-baixa); }
  .chip.sev-informativa { color: var(--sev-informativa); }
  .cat { font-family:'IBM Plex Mono', monospace; font-size:10.5px; color: var(--faint); text-transform:uppercase; letter-spacing:.08em; }
  h3 { font-family:'Chakra Petch', sans-serif; font-size:16px; font-weight:600; margin-bottom:2px; }
  .loc { font-family:'IBM Plex Mono', monospace; font-size:12.5px; color: var(--amber); margin-bottom:8px; word-break:break-all; }
  pre {
    font-family:'IBM Plex Mono', monospace; font-size:12px; background: var(--evid-bg);
    border:1px solid var(--line); border-left:2px solid var(--amber);
    padding:11px 13px; margin:8px 0; white-space:pre-wrap; word-break:break-word; color: var(--muted);
  }
  p { margin-bottom:5px; font-size:14px; color: var(--muted); }
  p b { color: var(--text); }
  ul { list-style:none; }
  .fortes li { padding:9px 0; border-bottom:1px solid var(--line); font-size:14px; }
  .fortes li b { color: var(--text); }
  .fortes li::before { content:'✓  '; color: var(--forte); font-family:'IBM Plex Mono', monospace; }
  .ev { color: var(--faint); font-size:12px; font-family:'IBM Plex Mono', monospace; }
  .recs li { padding:9px 0; border-bottom:1px solid var(--line); font-size:14px; color: var(--muted); }
  .pri {
    display:inline-block; font-family:'IBM Plex Mono', monospace; font-size:11px;
    color: var(--amber); border:1px solid var(--line-bright); padding:1px 8px; margin-right:10px;
  }
  .limits li { font-size:13px; color: var(--faint); padding:3px 0 3px 16px; position:relative; }
  .limits li::before { content:'▸'; position:absolute; left:0; color: var(--faint); }
  footer {
    margin-top:48px; border-top:1px solid var(--line-bright); padding-top:14px;
    display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;
    font-family:'IBM Plex Mono', monospace; font-size:11.5px; color: var(--faint);
  }
  @media (max-width:640px) {
    .page { padding:28px 16px; }
    .topgrid { flex-direction:column; gap:16px; }
  }
  @media print {
    :root {
      --bg:#ffffff; --surface:#f8fafc; --line:#e2e8f0; --line-bright:#cbd5e1;
      --text:#0f172a; --muted:#334155; --faint:#64748b;
      --amber:#B45309; --forte:#059669;
      --grade: ${grade.print};
      ${sevVarsPrint}
      --evid-bg:#f8fafc;
    }
    body { background:#fff; }
    .page { max-width:none; padding:0; }
    @page { margin:2cm; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand">BLINDADO<span class="cur">▮</span><small>relatório de auditoria de segurança</small></div>
    <div class="date">${data}</div>
  </header>

  <h1>${esc(r.projeto)}</h1>
  <div class="stack">${esc(r.stack)} · ${r.arquivosAnalisados} arquivos auditados</div>

  <div class="topgrid">
    <div class="grade">${esc(r.nota)}</div>
    <div class="resumo">${esc(r.resumo)}</div>
  </div>

  <div class="sev-row">${sevRow}</div>

  <h2>Achados detalhados (${total})</h2>
  ${achados || '<p>Nenhuma falha verificada nas cinco categorias auditadas.</p>'}

  ${fortes ? `<h2>O que já está protegido</h2><ul class="fortes">${fortes}</ul>` : ''}

  ${recs ? `<h2>Plano de ação priorizado</h2><ul class="recs">${recs}</ul>` : ''}

  ${limits ? `<h2>Limitações desta análise</h2><ul class="limits">${limits}</ul>` : ''}

  <footer>
    <span>Gerado por BLINDADO</span>
    <span>Para salvar em PDF: abra este arquivo e use Ctrl+P (a versão impressa sai clara)</span>
  </footer>
</div>
</body>
</html>`;
}

export function downloadReport(r: Relatorio) {
  const safe = (r.projeto || 'projeto').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const blob = new Blob([buildReportHtml(r)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `blindado-relatorio-${safe}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
