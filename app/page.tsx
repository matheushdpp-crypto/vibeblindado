'use client';

import { useEffect, useRef, useState } from 'react';
import Report from '@/components/Report';
import { downloadReport } from '@/lib/export';
import type { Relatorio } from '@/lib/types';

// ── terminal de demonstração do hero ──────────────────────────────
const DEMO_LINES: { text: string; cls: string }[] = [
  { text: '$ blindado scan github.com/ana/meu-saas', cls: 't-cmd' },
  { text: '▸ stack detectada: Next.js + Supabase', cls: 't-dim' },
  { text: '▸ 34 arquivos mapeados · priorizando rotas e auth', cls: 't-dim' },
  { text: '✓ middleware de sessão presente em todas as rotas /app', cls: 't-ok' },
  { text: '✗ RLS ausente na tabela public.orders            [CRÍTICA]', cls: 't-crit' },
  { text: '✗ chave service_role no bundle do frontend        [CRÍTICA]', cls: 't-crit' },
  { text: '✗ /api/invoices/[id] não checa dono do recurso    [ALTA]', cls: 't-alta' },
  { text: '✓ inputs sanitizados com DOMPurify', cls: 't-ok' },
  { text: '▸ nota geral: F (3 falhas exploráveis)', cls: 't-amber' },
  { text: '▸ relatório completo + prompt corretivo gerados', cls: 't-amber' }
];

function DemoTerminal() {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setVisible(DEMO_LINES.length); return; }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setVisible(i);
      if (i < DEMO_LINES.length) timer = setTimeout(tick, i === 1 ? 900 : 620);
      else timer = setTimeout(() => { i = 0; setVisible(0); timer = setTimeout(tick, 500); }, 6500);
    };
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="terminal" aria-hidden="true">
      <div className="scan-sweep" />
      <div className="terminal-bar">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="title">blindado · auditoria</span>
        <span className="badge">DEMONSTRAÇÃO</span>
      </div>
      <div className="terminal-body">
        {DEMO_LINES.map((l, i) => (
          <div key={i} className={`tline ${l.cls} ${i < visible ? 'on' : ''}`}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

// ── conteúdo estático ─────────────────────────────────────────────
const CATEGORIAS = [
  {
    n: '01', t: 'Banco sem tranca',
    d: 'Tabelas sem RLS ou queries que devolvem dados de todos os usuários. O vazamento clássico de app feito com Supabase/Firebase.'
  },
  {
    n: '02', t: 'Permissão só no navegador',
    d: 'O botão de admin some da tela, mas o endpoint aceita qualquer um. Verificamos se o servidor valida cada privilégio.'
  },
  {
    n: '03', t: 'IDOR',
    d: 'Trocar o número no final da URL e ver o pedido de outro cliente. Cruzamos cada rota por ID com a checagem de dono.'
  },
  {
    n: '04', t: 'Chaves expostas',
    d: 'API keys, tokens e segredos commitados no código ou embutidos no bundle do frontend, prontos para serem copiados.'
  },
  {
    n: '05', t: 'Inputs sem tratamento',
    d: 'HTML renderizado sem sanitização, links javascript:, markdown cru. As portas de entrada do XSS.'
  }
];

type View = 'landing' | 'scanning' | 'report';

export default function Home() {
  const [view, setView] = useState<View>('landing');
  const [repo, setRepo] = useState('');
  const [formError, setFormError] = useState('');

  const [leadOpen, setLeadOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const [leadError, setLeadError] = useState('');

  const [scanLines, setScanLines] = useState<{ text: string; cls: string }[]>([]);
  const [scanError, setScanError] = useState('');
  const [report, setReport] = useState<Relatorio | null>(null);

  const [fixOpen, setFixOpen] = useState(false);
  const [fixText, setFixText] = useState('');
  const [fixLoading, setFixLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const scanRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scanRef.current?.scrollTo({ top: scanRef.current.scrollHeight });
  }, [scanLines]);

  const repoLooksValid = (v: string) =>
    /github\.com\/[\w.-]+\/[\w.-]+/i.test(v) || /^[\w.-]+\/[\w.-]+$/.test(v.trim());

  function handleSubmitTarget(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!repoLooksValid(repo)) {
      setFormError('Cole o link de um repositório público do GitHub (github.com/usuario/projeto).');
      return;
    }
    setLeadOpen(true);
  }

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLeadError('');
    if (!nome.trim() || !/.+@.+\..+/.test(email)) {
      setLeadError('Preencha nome e um e-mail válido.');
      return;
    }
    if (!autoriza) {
      setLeadError('Confirme que o repositório é seu (ou que você tem autorização).');
      return;
    }
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: 'lead', nome, email, whatsapp, repo })
    }).catch(() => null);
    setLeadOpen(false);
    startScan();
  }

  async function startScan() {
    setView('scanning');
    setScanError('');
    setScanLines([{ text: `$ blindado scan ${repo.trim()}`, cls: 't-cmd' }]);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo })
      });
      if (!res.ok || !res.body) throw new Error('network');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          let evt: any;
          try { evt = JSON.parse(line.slice(5)); } catch { continue; }
          if (evt.type === 'status') {
            setScanLines((prev) => [...prev, { text: `▸ ${evt.message}`, cls: 't-dim' }]);
          } else if (evt.type === 'report') {
            setScanLines((prev) => [...prev, { text: '✓ relatório pronto', cls: 't-ok' }]);
            setReport(evt.report);
            setTimeout(() => setView('report'), 650);
          } else if (evt.type === 'error') {
            setScanError(evt.message);
            setScanLines((prev) => [...prev, { text: `✗ ${evt.message}`, cls: 't-crit' }]);
          }
        }
      }
    } catch {
      setScanError('Falha de conexão durante a análise. Tente novamente.');
      setScanLines((prev) => [...prev, { text: '✗ conexão interrompida', cls: 't-crit' }]);
    }
  }

  async function handleRequestFix() {
    setFixOpen(true);
    setFixLoading(true);
    setFixText('');
    setCopied(false);
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: 'fix_prompt_click', nome, email, whatsapp, repo, nota: report?.nota })
    }).catch(() => null);
    try {
      const res = await fetch('/api/fix-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report })
      });
      const data = await res.json();
      setFixText(data.prompt || data.error || 'Não foi possível gerar o prompt. Tente novamente.');
    } catch {
      setFixText('Não foi possível gerar o prompt. Tente novamente.');
    } finally {
      setFixLoading(false);
    }
  }

  async function copyFix() {
    try {
      await navigator.clipboard.writeText(fixText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard bloqueado */ }
  }

  function handleDownload() {
    if (!report) return;
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: 'download_relatorio', nome, email, whatsapp, repo, nota: report.nota })
    }).catch(() => null);
    downloadReport(report);
  }

  function resetAll() {
    setView('landing');
    setReport(null);
    setRepo('');
    setScanLines([]);
    setScanError('');
  }

  return (
    <>
      <div className="grid-bg" />
      <div className="wrap">
        <nav className="topbar">
          <a className="wordmark" href="#" onClick={(e) => { e.preventDefault(); resetAll(); }}>
            BLINDADO<span className="cursor-block" />
          </a>
          <span className="topbar-tag">auditoria de segurança p/ vibecoders</span>
        </nav>
      </div>

      {view === 'landing' && (
        <main>
          <div className="wrap">
            <section className="hero">
              <div>
                <div className="eyebrow">{'// AUDITORIA DE SEGURANÇA POR IA · GRÁTIS'}</div>
                <h1>
                  Seu app subiu em dias.<br />
                  <span className="dim">Uma falha derruba em minutos.</span>
                </h1>
                <p className="hero-sub">
                  Apps criados com <strong>Lovable, Cursor, Bolt e v0</strong> nascem rápido.
                  E quase sempre com dados vazando, permissões furadas e chaves expostas.
                  Cole o link do seu repositório e receba a auditoria em minutos.
                </p>
                <form className="target-form" onSubmit={handleSubmitTarget}>
                  <div className="target-field">
                    <div className="scan-sweep" />
                    <span className="prefix">▸</span>
                    <input
                      type="text"
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                      placeholder="github.com/voce/seu-projeto"
                      aria-label="Link do repositório público no GitHub"
                      spellCheck={false}
                    />
                    <button className="btn-primary" type="submit">AUDITAR GRÁTIS</button>
                  </div>
                  {formError && <div className="form-error">{formError}</div>}
                  <div className="target-note">
                    repositório <em>público</em> do GitHub
                  </div>
                </form>
              </div>
              <DemoTerminal />
            </section>
          </div>

          <div className="wrap">
            <section className="section" id="categorias">
              <div className="section-head">
                <div className="section-eyebrow">{'// AS 5 VERIFICAÇÕES'}</div>
                <h2>As falhas que a IA comete quando ninguém revisa</h2>
                <p className="section-sub">
                  A auditoria detecta a stack do seu projeto e procura as cinco classes de falha
                  mais comuns em apps vibecodados, arquivo por arquivo, com linha e evidência.
                </p>
              </div>
              <div className="cats">
                {CATEGORIAS.map((c) => (
                  <div className="cat" key={c.n}>
                    <div className="cat-hit" />
                    <div className="cat-num">VER-{c.n}</div>
                    <h3>{c.t}</h3>
                    <p>{c.d}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-head">
                <div className="section-eyebrow">{'// COMO FUNCIONA'}</div>
                <h2>Do link ao plano de correção</h2>
              </div>
              <div className="steps">
                <div className="step">
                  <h3>Cole o repositório</h3>
                  <p>Link do repo público no GitHub. Selecionamos os arquivos que importam: rotas, auth, configs e banco.</p>
                </div>
                <div className="step">
                  <h3>A IA audita o código</h3>
                  <p>Só entra no relatório o que foi verificado no código, com arquivo, linha e trecho. Sem achismo, sem alarme falso.</p>
                </div>
                <div className="step">
                  <h3>Relatório + prompt corretivo</h3>
                  <p>Nota geral, achados por severidade e um prompt pronto para colar na sua ferramenta de IA e corrigir tudo.</p>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="honest">
                <div className="section-eyebrow">{'// SEM TEATRO'}</div>
                <ul>
                  <li><span><strong>Análise por IA, não pentest.</strong> É a primeira camada de defesa: encontra o que derruba apps vibecodados todo dia, mas não substitui um especialista para sistemas críticos.</span></li>
                  <li><span><strong>Só analisamos o que é seu.</strong> Você declara ser dono ou ter autorização sobre o repositório antes de qualquer análise.</span></li>
                  <li><span><strong>Seu código não fica conosco.</strong> Os arquivos são lidos para a análise e descartados; guardamos apenas seu contato e o resultado.</span></li>
                </ul>
              </div>
            </section>
          </div>

          <div className="wrap">
            <footer>
              <span>BLINDADO © {new Date().getFullYear()}</span>
              <span>feito para quem constrói rápido</span>
            </footer>
          </div>
        </main>
      )}

      {view === 'scanning' && (
        <main className="wrap">
          <div className="scan-screen">
            <div className="terminal">
              {!scanError && <div className="scan-sweep" />}
              <div className="terminal-bar">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span className="title">blindado · auditoria em execução</span>
                <span className="badge">{scanError ? 'ERRO' : 'AO VIVO'}</span>
              </div>
              <div className="terminal-body" ref={scanRef} style={{ maxHeight: 420, overflowY: 'auto' }}>
                {scanLines.map((l, i) => (
                  <div key={i} className={`tline ${l.cls} on`}>{l.text}</div>
                ))}
                {!scanError && <div className="tline t-dim on">█</div>}
              </div>
            </div>
            {scanError && (
              <div style={{ marginTop: 20 }}>
                <button className="btn-ghost" onClick={resetAll}>← voltar e tentar de novo</button>
              </div>
            )}
            {!scanError && (
              <p className="target-note" style={{ marginTop: 16 }}>
                a auditoria leva de 1 a 3 minutos, dependendo do tamanho do projeto. não feche esta aba
              </p>
            )}
          </div>
        </main>
      )}

      {view === 'report' && report && (
        <main>
          <Report report={report} onRequestFix={handleRequestFix} onBack={resetAll} onDownload={handleDownload} />
        </main>
      )}

      {leadOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setLeadOpen(false); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setLeadOpen(false)} aria-label="Fechar">✕</button>
            <div className="modal-eyebrow">{'// ÚLTIMO PASSO'}</div>
            <h3>Para onde enviamos o resultado?</h3>
            <p className="modal-sub">A auditoria começa assim que você confirmar. O relatório abre aqui mesmo.</p>
            <form onSubmit={handleLeadSubmit}>
              <label htmlFor="lead-nome">NOME</label>
              <input id="lead-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como te chamamos" />
              <label htmlFor="lead-email">E-MAIL</label>
              <input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
              <label htmlFor="lead-zap">WHATSAPP (OPCIONAL)</label>
              <input id="lead-zap" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 90000-0000" />
              <div className="check-row">
                <input id="lead-auth" type="checkbox" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} />
                <label htmlFor="lead-auth" style={{ margin: 0, fontFamily: 'var(--font-body)', letterSpacing: 0 }}>
                  <span>Declaro que este repositório é meu ou que tenho autorização do dono para analisá-lo.</span>
                </label>
              </div>
              {leadError && <div className="form-error" style={{ marginBottom: 14 }}>{leadError}</div>}
              <button className="btn-primary" type="submit">INICIAR AUDITORIA</button>
            </form>
          </div>
        </div>
      )}

      {fixOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setFixOpen(false); }}>
          <div className="modal wide">
            <button className="modal-close" onClick={() => setFixOpen(false)} aria-label="Fechar">✕</button>
            <div className="modal-eyebrow">{'// PROMPT CORRETIVO'}</div>
            <h3>Cole na sua ferramenta de IA</h3>
            <p className="modal-sub">
              Funciona no Cursor, Claude Code, Lovable, Bolt e em qualquer IA que edite seu código.
              Ele corrige as falhas na ordem certa e verifica cada uma no final.
            </p>
            {fixLoading ? (
              <div className="terminal" style={{ boxShadow: 'none' }}>
                <div className="scan-sweep" />
                <div className="terminal-body" style={{ minHeight: 120 }}>
                  <div className="tline t-dim on">▸ escrevendo o prompt corretivo do seu projeto...</div>
                  <div className="tline t-dim on">█</div>
                </div>
              </div>
            ) : (
              <>
                <textarea className="fix-output" value={fixText} readOnly aria-label="Prompt corretivo" />
                <div className="copy-row">
                  <button className="btn-primary" style={{ padding: '13px 24px' }} onClick={copyFix}>
                    {copied ? 'COPIADO ✓' : 'COPIAR PROMPT'}
                  </button>
                  <span className="target-note" style={{ margin: 0 }}>
                    rode a auditoria de novo depois de aplicar, para confirmar que fechou
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
