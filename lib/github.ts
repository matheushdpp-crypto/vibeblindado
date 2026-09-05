// Busca o código de um repositório PÚBLICO do GitHub via API oficial,
// selecionando os arquivos mais relevantes para auditoria de segurança
// e respeitando limites de tamanho para caber no contexto da LLM.

const API = 'https://api.github.com';

const MAX_FILES = 45;
const MAX_FILE_BYTES = 60_000;      // arquivo individual maior que isso é truncado
const MAX_TOTAL_BYTES = 340_000;    // ~85k tokens de código no total

// Extensões de código que interessam à auditoria
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|php|go|rs|java|kt|cs|vue|svelte|sql|prisma|graphql|sh|yml|yaml|toml|json|env|tf|conf)$/i;

// Arquivos/pastas que nunca valem tokens
const IGNORE = /(^|\/)(node_modules|\.git|dist|build|out|\.next|coverage|vendor|__pycache__|\.venv|venv|target|\.turbo|\.cache|public\/assets|assets\/fonts)(\/|$)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Cargo\.lock|\.min\.(js|css)$|\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|mp4|pdf|map)$/i;

// Pontuação de prioridade: quanto maior, mais cedo o arquivo entra no orçamento
function priority(path: string): number {
  const p = path.toLowerCase();
  let score = 0;
  if (/\.env(\.|$)/.test(p) && !p.endsWith('.env.example')) score += 100;
  if (/docker-compose|dockerfile|\.github\/workflows|helm|terraform|\.tf$/.test(p)) score += 60;
  if (/(^|\/)(api|routes?|controllers?|handlers?|endpoints?|server|backend|functions)(\/|\.)/.test(p)) score += 55;
  if (/auth|login|session|token|jwt|middleware|guard|permission|role|rls|policy|policies/.test(p)) score += 50;
  if (/supabase|firebase|prisma|schema|migration|models?\//.test(p)) score += 45;
  if (/config|settings|secret|credential|key/.test(p)) score += 40;
  if (/admin|dashboard|billing|payment|checkout|webhook|upload/.test(p)) score += 35;
  if (/^(src|app|pages|server|lib|api)\//.test(p)) score += 15;
  if (/\.(sql|prisma)$/.test(p)) score += 20;
  if (/test|spec|__tests__|\.stories\./.test(p)) score -= 40;
  if (/readme|changelog|license|\.md$/.test(p)) score -= 20;
  // Profundidade menor = geralmente mais estrutural
  score -= p.split('/').length * 2;
  return score;
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'blindado-audit',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const m = cleaned.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[\/?#].*)?$/) ||
            cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export interface RepoFile { path: string; content: string; truncated: boolean; }
export interface RepoBundle {
  fullName: string;
  description: string | null;
  defaultBranch: string;
  totalFilesInRepo: number;
  files: RepoFile[];
  skippedForBudget: number;
}

export async function fetchRepoBundle(
  owner: string,
  repo: string,
  onStatus?: (msg: string) => void
): Promise<RepoBundle> {
  const meta = await fetch(`${API}/repos/${owner}/${repo}`, { headers: ghHeaders() });
  if (meta.status === 404) throw new Error('REPO_NOT_FOUND');
  if (meta.status === 403 || meta.status === 429) throw new Error('GITHUB_RATE_LIMIT');
  if (!meta.ok) throw new Error(`GITHUB_ERROR_${meta.status}`);
  const info = await meta.json();
  if (info.private) throw new Error('REPO_PRIVATE');
  if (info.size > 500_000) throw new Error('REPO_TOO_BIG'); // ~500MB

  onStatus?.(`Repositório localizado: ${info.full_name}`);

  const treeRes = await fetch(
    `${API}/repos/${owner}/${repo}/git/trees/${info.default_branch}?recursive=1`,
    { headers: ghHeaders() }
  );
  if (!treeRes.ok) throw new Error(`GITHUB_TREE_ERROR_${treeRes.status}`);
  const tree = await treeRes.json();

  const candidates = (tree.tree as any[])
    .filter((n) => n.type === 'blob')
    .filter((n) => !IGNORE.test(n.path))
    .filter((n) => CODE_EXT.test(n.path) || /(^|\/)\.env/.test(n.path) || /dockerfile/i.test(n.path))
    .filter((n) => (n.size ?? 0) < 400_000)
    .sort((a, b) => priority(b.path) - priority(a.path));

  onStatus?.(`${candidates.length} arquivos de código mapeados. Priorizando rotas, auth e configs...`);

  const files: RepoFile[] = [];
  let total = 0;
  let skipped = 0;

  for (const node of candidates) {
    if (files.length >= MAX_FILES || total >= MAX_TOTAL_BYTES) { skipped++; continue; }
    const raw = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${info.default_branch}/${node.path}`,
      { headers: { 'User-Agent': 'blindado-audit' } }
    );
    if (!raw.ok) continue;
    let content = await raw.text();
    let truncated = false;
    if (content.length > MAX_FILE_BYTES) {
      content = content.slice(0, MAX_FILE_BYTES);
      truncated = true;
    }
    total += content.length;
    files.push({ path: node.path, content, truncated });
    if (files.length % 10 === 0) onStatus?.(`${files.length} arquivos baixados...`);
  }

  return {
    fullName: info.full_name,
    description: info.description,
    defaultBranch: info.default_branch,
    totalFilesInRepo: candidates.length,
    files,
    skippedForBudget: skipped
  };
}
