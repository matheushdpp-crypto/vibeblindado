export type Severidade = 'critica' | 'alta' | 'media' | 'baixa' | 'informativa';

export interface Achado {
  categoria: string;       // ex: "Banco sem tranca", "IDOR", "Chaves expostas"
  severidade: Severidade;
  titulo: string;
  arquivo?: string;        // caminho/do/arquivo.ts
  linha?: string;          // "42" ou "42-58"
  evidencia?: string;      // trecho curto do código
  descricao: string;       // por que é explorável
  impacto: string;
  correcao: string;
}

export interface PontoForte {
  titulo: string;
  evidencia: string;
}

export interface Recomendacao {
  prioridade: number;      // 1, 2, 3...
  texto: string;
}

export interface Relatorio {
  projeto: string;
  stack: string;           // stack detectada, em uma frase
  nota: 'A' | 'B' | 'C' | 'D' | 'F';
  resumo: string;          // resumo executivo, 2-4 frases
  achados: Achado[];
  pontosFortes: PontoForte[];
  recomendacoes: Recomendacao[];
  limitacoes: string[];    // o que a análise não cobriu
  arquivosAnalisados: number;
}
