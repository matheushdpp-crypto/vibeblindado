'use client';

import type { Relatorio, Achado, Severidade } from '@/lib/types';

const SEV_ORDER: Severidade[] = ['critica', 'alta', 'media', 'baixa', 'informativa'];
const SEV_LABEL: Record<Severidade, string> = {
  critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa', informativa: 'Info'
};
const SEV_COLOR: Record<Severidade, string> = {
  critica: 'var(--sev-critica)', alta: 'var(--sev-alta)', media: 'var(--sev-media)',
  baixa: 'var(--sev-baixa)', informativa: 'var(--sev-info)'
};
const GRADE_COLOR: Record<string, string> = {
  A: 'var(--forte)', B: 'var(--sev-baixa)', C: 'var(--sev-media)',
  D: 'var(--sev-alta)', F: 'var(--sev-critica)'
};

function sevRank(s: Severidade) { return SEV_ORDER.indexOf(s); }

function Donut({ counts }: { counts: Record<Severidade, number> }) {
  const total = SEV_ORDER.reduce((acc, s) => acc + counts[s], 0);
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" role="img"
      aria-label={`${total} achados por severidade`}>
      <circle cx="75" cy="75" r={R} fill="none" stroke="var(--line)" strokeWidth="16" />
      {total > 0 && SEV_ORDER.map((s) => {
        if (!counts[s]) return null;
        const frac = counts[s] / total;
        const seg = (
          <circle key={s} cx="75" cy="75" r={R} fill="none"
            stroke={SEV_COLOR[s]} strokeWidth="16"
            strokeDasharray={`${frac * C - 2} ${C - frac * C + 2}`}
            strokeDashoffset={-offset * C + C / 4}
            style={{ transition: 'stroke-dashoffset .4s' }} />
        );
        offset += frac;
        return seg;
      })}
      <text x="75" y="70" textAnchor="middle" fill="var(--text)"
        style={{ font: '600 28px var(--font-display)' }}>{total}</text>
      <text x="75" y="92" textAnchor="middle" fill="var(--faint)"
        style={{ font: '11px var(--font-mono)', letterSpacing: '0.08em' }}>ACHADOS</text>
    </svg>
  );
}

function Finding({ a }: { a: Achado }) {
  return (
    <article className="finding">
      <div className="finding-top">
        <span className="chip" style={{ color: SEV_COLOR[a.severidade] }}>{SEV_LABEL[a.severidade]}</span>
        <span className="cat-label">{a.categoria}</span>
      </div>
      <h4>{a.titulo}</h4>
      {(a.arquivo || a.linha) && (
        <div className="finding-loc">{a.arquivo}{a.linha ? `:${a.linha}` : ''}</div>
      )}
      {a.evidencia && <pre className="evidence">{a.evidencia}</pre>}
      <p>{a.descricao}</p>
      {a.impacto && <p><strong>Impacto:</strong> {a.impacto}</p>}
      {a.correcao && <p><strong>Correção:</strong> {a.correcao}</p>}
    </article>
  );
}

export default function Report({
  report, onRequestFix, onBack, onDownload
}: {
  report: Relatorio;
  onRequestFix: () => void;
  onBack: () => void;
  onDownload: () => void;
}) {
  const counts = { critica: 0, alta: 0, media: 0, baixa: 0, informativa: 0 } as Record<Severidade, number>;
  for (const a of report.achados) {
    if (counts[a.severidade] !== undefined) counts[a.severidade]++;
  }
  const sorted = [...report.achados].sort((x, y) => sevRank(x.severidade) - sevRank(y.severidade));
  const grade = GRADE_COLOR[report.nota] ? report.nota : 'C';

  return (
    <div className="report wrap">
      <button className="back-link" onClick={onBack}>← analisar outro projeto</button>

      <header className="report-head">
        <div className="grade" style={{ color: GRADE_COLOR[grade] }}>{grade}</div>
        <div className="report-title">
          <h2>{report.projeto}</h2>
          <div className="report-meta">
            {report.stack} · {report.arquivosAnalisados} arquivos auditados · {new Date().toLocaleDateString('pt-BR')}
          </div>
          <p className="report-summary">{report.resumo}</p>
          <div className="report-actions">
            <button className="btn-ghost" onClick={onDownload}>⬇ baixar relatório</button>
            <span className="target-note" style={{ margin: 0 }}>
              arquivo HTML que abre em qualquer navegador. para PDF, abra e use Ctrl+P
            </span>
          </div>
        </div>
      </header>

      <div className="report-grid">
        <div>
          <section className="panel">
            <div className="panel-title">Achados por severidade</div>
            <div className="donut-wrap">
              <Donut counts={counts} />
              <div className="donut-legend">
                {SEV_ORDER.map((s) => (
                  <div key={s}>
                    <span className="sw" style={{ background: SEV_COLOR[s] }} />
                    {SEV_LABEL[s]} <span className="n">{counts[s]}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {report.pontosFortes.length > 0 && (
            <section className="panel">
              <div className="panel-title">O que já está protegido</div>
              {report.pontosFortes.map((p, i) => (
                <div className="strong-item" key={i}>
                  <span className="mark">✓</span>
                  <span>{p.titulo}<span className="ev">{p.evidencia}</span></span>
                </div>
              ))}
            </section>
          )}

          {report.limitacoes.length > 0 && (
            <section className="panel">
              <div className="panel-title">Limitações desta análise</div>
              <ul className="limits">
                {report.limitacoes.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </section>
          )}
        </div>

        <div>
          <section className="panel">
            <div className="panel-title">
              {sorted.length > 0 ? `Achados detalhados (${sorted.length})` : 'Achados detalhados'}
            </div>
            {sorted.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>
                Nenhuma falha verificada nas cinco categorias auditadas. Continue assim, e rode
                uma nova análise a cada mudança grande no projeto.
              </p>
            )}
            {sorted.map((a, i) => <Finding a={a} key={i} />)}
          </section>

          {report.recomendacoes.length > 0 && (
            <section className="panel">
              <div className="panel-title">Plano de ação priorizado</div>
              {[...report.recomendacoes].sort((a, b) => a.prioridade - b.prioridade).map((r, i) => (
                <div className="rec-item" key={i}>
                  <span className="p">P{r.prioridade}</span>
                  <span>{r.texto}</span>
                </div>
              ))}
            </section>
          )}

          {sorted.length > 0 && (
            <div className="fix-cta">
              <div>
                <h3>Prompt que resolve</h3>
                <p>
                  Geramos um prompt pronto para você colar no Cursor, Lovable ou Claude.
                  Ele corrige cada falha deste relatório, na ordem certa, com critérios de verificação.
                </p>
              </div>
              <button className="btn-primary" onClick={onRequestFix}>Gerar prompt corretivo</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
