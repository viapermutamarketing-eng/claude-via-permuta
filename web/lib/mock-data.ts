import type { ContaSocial, Conquista, PerfilRankeado, PublicacaoAnalisada } from "./types";

// Dados de demonstração — usados quando NEXT_PUBLIC_SUPABASE_URL não está
// configurado (ex.: rodando `npm run dev` local sem credenciais reais),
// pra sempre dar pra ver o dashboard funcionando. Assim que o Supabase
// estiver plugado (lib/supabase.ts), lib/data.ts troca isso pelos dados
// reais sem precisar mexer em nenhum componente.

export const CONTAS_MOCK: ContaSocial[] = [
  { id: "master", nome: "Via Permuta Master", tipo: "empresa", username_instagram: "@viapermuta", cor_destaque: "#B08D4F", ativo: true, ordem: 1 },
  { id: "franca", nome: "Via Permuta Franca", tipo: "empresa", username_instagram: "@viapermutafranca", cor_destaque: "#5B9FE4", ativo: true, ordem: 2 },
  { id: "araxa", nome: "Via Permuta Araxá", tipo: "empresa", username_instagram: "@viapermutaaraxa", cor_destaque: "#3FBF7F", ativo: true, ordem: 3 },
  { id: "curitiba", nome: "Via Permuta Curitiba", tipo: "empresa", username_instagram: "@viapermutacuritiba", cor_destaque: "#B98BE0", ativo: true, ordem: 4 },
  { id: "uberlandia1", nome: "Via Permuta Uberlândia 1", tipo: "empresa", username_instagram: "@viapermutauberlandia", cor_destaque: "#E0A83F", ativo: true, ordem: 5 },
  { id: "uberaba", nome: "Via Permuta Uberaba", tipo: "empresa", username_instagram: "@viapermutauberaba", cor_destaque: "#E4685B", ativo: true, ordem: 6 },
  { id: "julio", nome: "Julio Dario", tipo: "pessoal", username_instagram: "@juliodario", cor_destaque: "#D9BD82", ativo: true, ordem: 7 },
  { id: "igor", nome: "Igor Beirigo", tipo: "pessoal", username_instagram: "@igorbeirigo", cor_destaque: "#8FC1F0", ativo: true, ordem: 8 },
  { id: "anna", nome: "Anna Karoliny", tipo: "pessoal", username_instagram: "@annakaroliny", cor_destaque: "#FF8A3D", ativo: true, ordem: 9 },
  { id: "podcast", nome: "Podcast Ruptura Empreendedores", tipo: "podcast", username_instagram: "@rupturapodcast", cor_destaque: "#7A5E30", ativo: true, ordem: 10 },
];

const CONQUISTAS_MOCK: Record<string, Conquista> = {
  mestre_direct: { id: "mestre_direct", chave: "mestre_direct", nome: "Mestre do Direct", descricao: "Tempo médio de resposta abaixo de 5 min", icone: "⚡" },
  rei_retencao: { id: "rei_retencao", chave: "rei_retencao", nome: "Rei da Retenção", descricao: "Maior retenção média em Reels", icone: "🎯" },
  trafego_sniper: { id: "trafego_sniper", chave: "trafego_sniper", nome: "Tráfego Sniper", descricao: "Melhor custo por resultado no pago", icone: "🎯" },
  top1: { id: "top1", chave: "top1", nome: "Perfil do momento", descricao: "1º lugar na última execução", icone: "👑" },
  viral: { id: "viral", chave: "viral", nome: "Viral", descricao: "Reels acima de 100 mil views", icone: "🚀" },
};

function pontuacaoMock(seed: number) {
  return Math.round((100 - seed * 7.4 + Math.sin(seed) * 6) * 10) / 10;
}

export const PERFIS_RANKEADOS_MOCK: PerfilRankeado[] = CONTAS_MOCK.map((conta, idx) => {
  const posicao = idx + 1;
  const pontuacaoTotal = Math.max(4, pontuacaoMock(idx));
  const scoreViews = Math.max(5, 96 - idx * 9 + (idx % 3) * 4);
  const temperatura = scoreViews >= 85 ? "estourando" : scoreViews >= 60 ? "quente" : scoreViews >= 35 ? "morno" : "frio";
  const badges: Conquista[] = [];
  if (posicao === 1) badges.push(CONQUISTAS_MOCK.top1);
  if (idx % 3 === 0) badges.push(CONQUISTAS_MOCK.mestre_direct);
  if (idx % 4 === 1) badges.push(CONQUISTAS_MOCK.rei_retencao);
  if (idx % 5 === 2) badges.push(CONQUISTAS_MOCK.trafego_sniper);
  if (scoreViews >= 90) badges.push(CONQUISTAS_MOCK.viral);

  return {
    conta,
    posicao,
    pontuacaoTotal,
    destaque: posicao === 1,
    detalhamento: {
      views: { valor: (10 - idx) * 42000, normalizado: scoreViews, contribuicao: Math.round(scoreViews * 0.25 * 10) / 10 },
      seguidores: { valor: (10 - idx) * 38, normalizado: Math.max(10, 90 - idx * 8), contribuicao: Math.round((90 - idx * 8) * 0.2 * 10) / 10 },
      curtidas: { valor: (10 - idx) * 1800, normalizado: Math.max(10, 88 - idx * 7), contribuicao: 6 },
      envios: { valor: (10 - idx) * 210, normalizado: Math.max(10, 80 - idx * 6), contribuicao: 5 },
      salvamentos: { valor: (10 - idx) * 150, normalizado: Math.max(10, 75 - idx * 6), contribuicao: 5 },
      retencao: { valor: 62 - idx * 2, normalizado: Math.max(10, 70 - idx * 5), contribuicao: 4 },
      direct: { valor: 3 + idx * 1.4, normalizado: Math.max(10, 82 - idx * 7), contribuicao: 6 },
    },
    temperatura,
    variacaoPosicoes: [2, -1, 0, 1, 0, -2, 0, 3, -1, 0][idx] ?? 0,
    badges,
    melhorPost: melhorPostMock(conta.id, idx),
  };
});

function melhorPostMock(contaId: string, idx: number): PublicacaoAnalisada {
  const views = (10 - idx) * 41000 + 8000;
  const impulsionado = idx % 3 === 1;
  return {
    id: `post-${contaId}`,
    conta_id: contaId,
    media_id: `mock-${contaId}`,
    tipo: idx % 2 === 0 ? "reels" : "carrossel",
    permalink: "#",
    thumbnail_url: null,
    legenda: "A liberdade é uma decisão — permuta que virou negócio fechado essa semana 🚀",
    publicado_em: new Date(Date.now() - idx * 86400000).toISOString(),
    origem: impulsionado ? "impulsionado" : "organico",
    campanha_nome: impulsionado ? "Remarketing — quente" : null,
    metrica: {
      id: `m-${contaId}`,
      publicacao_id: `post-${contaId}`,
      capturado_em: new Date().toISOString(),
      visualizacoes: views,
      alcance: Math.round(views * 0.72),
      impressoes: Math.round(views * 1.4),
      curtidas: Math.round(views * 0.08),
      comentarios: Math.round(views * 0.004),
      salvamentos: Math.round(views * 0.02),
      envios: Math.round(views * 0.015),
      compartilhamentos: Math.round(views * 0.006),
      interacoes_totais: Math.round(views * 0.11),
      visitas_perfil: Math.round(views * 0.03),
      seguidores_ganhos: Math.max(1, Math.round((10 - idx) * 3.4)),
      seguidores_estimado: idx % 2 !== 0,
      retencao_media_seg: idx % 2 === 0 ? 14.2 - idx * 0.6 : null,
      tempo_total_visto_seg: idx % 2 === 0 ? views * 6.1 : null,
      taxa_engajamento: 0.11,
    },
    paga: impulsionado
      ? {
          id: `pg-${contaId}`,
          publicacao_id: `post-${contaId}`,
          ad_id: `ad-${contaId}`,
          gasto: 180 + idx * 12,
          impressoes: Math.round(views * 0.9),
          alcance: Math.round(views * 0.55),
          cliques_link: Math.round(views * 0.02),
          cpm: 8.4,
          cpc: 0.62,
          resultados: Math.round(views * 0.018),
          custo_por_resultado: 1.3,
        }
      : null,
    temperatura: idx < 3 ? "estourando" : idx < 6 ? "quente" : "morno",
  };
}
