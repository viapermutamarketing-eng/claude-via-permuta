import { supabase, supabaseConfigurado } from "./supabase";
import { temperaturaDaPontuacao } from "./temperature";
import { CONTAS_MOCK, PERFIS_RANKEADOS_MOCK } from "./mock-data";
import type {
  ContaSocial,
  ConquistaPerfil,
  MetricaPublicacao,
  MetricaPublicacaoPaga,
  PerfilRankeado,
  Publicacao,
  PublicacaoAnalisada,
  RankingExecucao,
  RankingPerfil,
} from "./types";

export interface DashboardData {
  execucao: RankingExecucao | null;
  perfis: PerfilRankeado[];
  fonte: "supabase" | "demonstracao";
}

/**
 * Camada única de leitura do dashboard. Enquanto o Supabase não estiver
 * configurado (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
 * OU o usuário não tiver uma sessão autenticada (RLS só libera leitura pra
 * `authenticated`, ver supabase/migrations/0012_insights_rls.sql), cai pro
 * modo demonstração — o layout inteiro (Hero/Leaderboard/Cards) continua
 * 100% funcional e animado, só com dados fictícios.
 */
export async function getDashboardData(): Promise<DashboardData> {
  if (!supabaseConfigurado || !supabase) {
    return { execucao: null, perfis: PERFIS_RANKEADOS_MOCK, fonte: "demonstracao" };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { execucao: null, perfis: PERFIS_RANKEADOS_MOCK, fonte: "demonstracao" };
  }

  try {
    const real = await buscarDadosReais();
    if (!real) return { execucao: null, perfis: PERFIS_RANKEADOS_MOCK, fonte: "demonstracao" };
    return { ...real, fonte: "supabase" };
  } catch {
    return { execucao: null, perfis: PERFIS_RANKEADOS_MOCK, fonte: "demonstracao" };
  }
}

async function buscarDadosReais(): Promise<{ execucao: RankingExecucao; perfis: PerfilRankeado[] } | null> {
  if (!supabase) return null;

  const { data: execucoes } = await supabase
    .from("ranking_execucoes")
    .select("*")
    .eq("status", "concluido")
    .order("criado_em", { ascending: false })
    .limit(2);
  const execucaoAtual = execucoes?.[0] as RankingExecucao | undefined;
  const execucaoAnterior = execucoes?.[1] as RankingExecucao | undefined;
  if (!execucaoAtual) return null;

  const [{ data: perfisAtuais }, { data: perfisAnteriores }, { data: contas }, { data: conquistas }] = await Promise.all([
    supabase.from("ranking_perfis").select("*").eq("execucao_id", execucaoAtual.id).order("posicao", { ascending: true }),
    execucaoAnterior
      ? supabase.from("ranking_perfis").select("conta_id, posicao").eq("execucao_id", execucaoAnterior.id)
      : Promise.resolve({ data: [] as { conta_id: string; posicao: number }[] }),
    supabase.from("contas_sociais").select("*").eq("ativo", true),
    supabase.from("conquistas_perfil").select("*, conquista:conquistas(*)").order("conquistado_em", { ascending: false }).limit(300),
  ]);

  const contasPorId = new Map<string, ContaSocial>((contas ?? []).map((c) => [c.id, c as ContaSocial]));
  const posicaoAnteriorPorConta = new Map<string, number>((perfisAnteriores ?? []).map((p) => [p.conta_id, p.posicao]));
  const conquistasPorConta = new Map<string, ConquistaPerfil[]>();
  for (const cp of (conquistas ?? []) as ConquistaPerfil[]) {
    const lista = conquistasPorConta.get(cp.conta_id) ?? [];
    lista.push(cp);
    conquistasPorConta.set(cp.conta_id, lista);
  }

  const perfis: PerfilRankeado[] = await Promise.all(
    ((perfisAtuais ?? []) as RankingPerfil[]).map(async (rp) => {
      const conta = contasPorId.get(rp.conta_id) ?? CONTAS_MOCK[0];
      const posicaoAnterior = posicaoAnteriorPorConta.get(rp.conta_id);
      const variacaoPosicoes = posicaoAnterior != null ? posicaoAnterior - rp.posicao : 0;
      const scoreViews = rp.detalhamento?.views?.normalizado ?? 0;
      const crescimentoRelativo = Math.max(0, Math.min(100, variacaoPosicoes * 15 + 50));
      const melhorPost = await buscarMelhorPost(rp.conta_id, execucaoAtual.id);

      return {
        conta,
        posicao: rp.posicao,
        pontuacaoTotal: rp.pontuacao_total,
        destaque: rp.destaque,
        detalhamento: rp.detalhamento,
        temperatura: temperaturaDaPontuacao(scoreViews, crescimentoRelativo),
        variacaoPosicoes,
        badges: (conquistasPorConta.get(rp.conta_id) ?? []).map((cp) => cp.conquista!).filter(Boolean),
        melhorPost: melhorPost ?? undefined,
      } satisfies PerfilRankeado;
    }),
  );

  return { execucao: execucaoAtual, perfis };
}

async function buscarMelhorPost(contaId: string, execucaoId: string): Promise<PublicacaoAnalisada | null> {
  if (!supabase) return null;
  const { data: topo } = await supabase
    .from("ranking_publicacoes")
    .select("publicacao_id")
    .eq("execucao_id", execucaoId)
    .eq("conta_id", contaId)
    .eq("posicao", 1)
    .maybeSingle();
  if (!topo) return null;

  const [{ data: publicacao }, { data: metrica }, { data: paga }] = await Promise.all([
    supabase.from("publicacoes").select("*").eq("id", topo.publicacao_id).single(),
    supabase.from("metricas_publicacao").select("*").eq("publicacao_id", topo.publicacao_id).order("capturado_em", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("metricas_publicacao_paga").select("*").eq("publicacao_id", topo.publicacao_id).order("capturado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!publicacao) return null;

  const pub = publicacao as Publicacao;
  const met = (metrica ?? null) as MetricaPublicacao | null;
  const scoreViews = met ? Math.min(100, (met.visualizacoes / 1000) % 100) : 0;
  return {
    ...pub,
    metrica: met,
    paga: (paga ?? null) as MetricaPublicacaoPaga | null,
    temperatura: temperaturaDaPontuacao(scoreViews, 50),
  };
}
