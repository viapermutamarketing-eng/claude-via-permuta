// Tipos espelham 1:1 o schema do Supabase em supabase/migrations/0008-0014.
// Mantém o dashboard "preparado pra Meta Graph API e backend serverless"
// sem acoplar a UI a nenhum formato de resposta específico da API — a Edge
// Function (supabase/functions/sync-meta-insights) já normaliza tudo antes
// de gravar aqui.

export type OrigemPublicacao = "organico" | "impulsionado" | "distribuido";
export type TipoPublicacao = "reels" | "imagem" | "carrossel" | "story";
export type TipoConta = "empresa" | "pessoal" | "podcast";
export type TipoExecucao = "auto_00h" | "auto_12h" | "manual";

export interface ContaSocial {
  id: string;
  nome: string;
  tipo: TipoConta;
  username_instagram: string | null;
  avatar_url?: string | null;
  cor_destaque: string | null;
  ativo: boolean;
  ordem: number | null;
}

export interface CriterioRanking {
  id: string;
  chave: string; // 'views' | 'seguidores' | 'curtidas' | 'envios' | 'salvamentos' | 'retencao' | 'direct'
  nome: string;
  peso: number;
  direcao: "maior_melhor" | "menor_melhor";
  ativo: boolean;
}

export interface DetalheCriterio {
  valor: number | null;
  normalizado: number; // 0-100
  contribuicao: number; // pontos que esse critério deu pro total
}

export interface RankingExecucao {
  id: string;
  tipo: TipoExecucao;
  janela_inicio: string | null;
  janela_fim: string;
  status: "em_andamento" | "concluido" | "erro";
  criado_em: string;
}

export interface RankingPerfil {
  id: string;
  execucao_id: string;
  conta_id: string;
  posicao: number;
  pontuacao_total: number;
  destaque: boolean;
  detalhamento: Record<string, DetalheCriterio>;
}

export interface Conquista {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
}

export interface ConquistaPerfil {
  id: string;
  conta_id: string;
  conquista_id: string;
  conquista?: Conquista;
  conquistado_em: string;
}

export interface Publicacao {
  id: string;
  conta_id: string;
  media_id: string;
  tipo: TipoPublicacao;
  permalink: string | null;
  thumbnail_url: string | null;
  legenda: string | null;
  publicado_em: string | null;
  origem: OrigemPublicacao;
  campanha_nome: string | null;
}

export interface MetricaPublicacao {
  id: string;
  publicacao_id: string;
  capturado_em: string;
  visualizacoes: number;
  alcance: number;
  impressoes: number;
  curtidas: number;
  comentarios: number;
  salvamentos: number;
  envios: number; // aviãozinho
  compartilhamentos: number;
  interacoes_totais: number;
  visitas_perfil: number;
  seguidores_ganhos: number;
  seguidores_estimado: boolean;
  retencao_media_seg: number | null;
  tempo_total_visto_seg: number | null;
  taxa_engajamento: number | null;
}

export interface MetricaPublicacaoPaga {
  id: string;
  publicacao_id: string;
  ad_id: string | null;
  gasto: number;
  impressoes: number;
  alcance: number;
  cliques_link: number;
  cpm: number | null;
  cpc: number | null;
  resultados: number;
  custo_por_resultado: number | null;
}

// ── shapes já "achatados" que os componentes consomem ──
// (a camada de dados — lib/data.ts — é quem transforma as tabelas acima
// nisto; troque só essa camada quando ligar no Supabase de verdade)
export type Temperatura = "estourando" | "quente" | "morno" | "frio";

export interface PerfilRankeado {
  conta: ContaSocial;
  posicao: number;
  pontuacaoTotal: number;
  destaque: boolean;
  detalhamento: Record<string, DetalheCriterio>;
  temperatura: Temperatura;
  variacaoPosicoes: number; // +2 subiu 2, -1 caiu 1, 0 manteve — dispara a animação de troca
  badges: Conquista[];
  melhorPost?: PublicacaoAnalisada;
}

export interface PublicacaoAnalisada extends Publicacao {
  metrica: MetricaPublicacao | null;
  paga: MetricaPublicacaoPaga | null;
  temperatura: Temperatura;
}
