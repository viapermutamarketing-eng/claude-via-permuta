// ════════════════════════════════════════════════════════════════
// Edge Function: sync-meta-insights
//
// Coração da Plataforma de Insights. Roda 2x/dia via pg_cron (00h00 e
// 12h00 BRT, ver supabase/migrations/0014_insights_cron.sql) ou sob
// demanda pelo botão "Atualizar agora" em public/insights.html. Pra
// cada conta ativa em `contas_sociais` (com token em `contas_tokens`):
//
//   1. Busca as mídias recentes via Graph API (Instagram Business) e
//      grava/atualiza em `publicacoes`.
//   2. Busca os insights nativos de cada mídia (views, curtidas,
//      envios/aviãozinho, salvamentos, retenção, seguidores ganhos) e
//      grava um snapshot novo em `metricas_publicacao`.
//   3. Busca os insights nativos de conta (seguidores, alcance,
//      visitas de perfil) e grava em `metricas_conta_diaria`.
//   4. Se a conta tem `ad_account_id`, busca na Marketing API os
//      anúncios ativos/recentes, cruza pelo `effective_object_story_id`
//      com a mídia orgânica correspondente, marca `origem =
//      'impulsionado'` e grava o gasto/impressões pagas em
//      `metricas_publicacao_paga` — SEM misturar com o número orgânico.
//   5. Calcula o ranking da execução (pesos de `criterios_ranking`,
//      normalizados 0–100 entre as contas) e grava em
//      `ranking_execucoes` / `ranking_perfis` / `ranking_publicacoes`.
//   6. Concede conquistas simples (`conquistas_perfil`) com base no
//      resultado da execução.
//
// LIMITAÇÕES DA API (não são bug, são a Meta — ver
// docs/PLATAFORMA_INSIGHTS.md):
//   - Repost de terceiros no Story de outra conta não é rastreável.
//   - Atribuição de seguidor novo a um post específico só é nativa em
//     Reels (metric `follows`); pra foto/carrossel usamos uma
//     heurística (variação de seguidores do dia atribuída ao post de
//     maior alcance do dia) e marcamos `seguidores_estimado = true`.
//
// AUTENTICAÇÃO: aceita OU o SYNC_SECRET (cron, via pg_net) OU um JWT
// válido de usuário autenticado do painel (botão manual). Nunca aceita
// chamada anônima.
//
// Deploy: npx supabase functions deploy sync-meta-insights --no-verify-jwt
// Secrets necessários:
//   npx supabase secrets set SYNC_SECRET=<escolha-um-segredo>
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm automáticos)
// Tokens de cada conta: gravados em `contas_tokens` (ver README).
// ════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? ""
// Nome da env var muda conforme o sistema de chaves do projeto (legado
// "service_role" vs. o novo "secret key") — aceita qualquer um dos dois,
// ambos vêm automáticos, nunca precisam ser setados manualmente.
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? ""
const SYNC_SECRET      = Deno.env.get("SYNC_SECRET") ?? ""
const GRAPH_VERSION    = "v21.0"

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } })

// ── autenticação: SYNC_SECRET (cron) ou JWT de usuário logado (manual) ──
async function autorizado(req: Request): Promise<{ ok: boolean; uid?: string; nome?: string }> {
  const auth = req.headers.get("Authorization") || ""
  const token = auth.replace(/^Bearer\s+/i, "")
  if (!token) return { ok: false }
  if (SYNC_SECRET && token === SYNC_SECRET) return { ok: true }
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) return { ok: false }
  return { ok: true, uid: data.user.id, nome: data.user.email ?? undefined }
}

// ── helpers Graph API ──
async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  const data = await res.json()
  if (!res.ok || data?.error) {
    throw new Error(`Graph API ${path}: ${data?.error?.message || res.statusText}`)
  }
  return data
}

function metricMap(insights: { name: string; values?: { value: number }[]; total_value?: { value: number } }[]) {
  const m: Record<string, number> = {}
  for (const i of insights || []) {
    const v = i.total_value?.value ?? i.values?.[0]?.value
    if (typeof v === "number") m[i.name] = v
  }
  return m
}

type Conta = {
  id: string; nome: string; instagram_business_id: string | null
  ad_account_id: string | null
}

async function buscarPublicacoesDaConta(conta: Conta, accessToken: string) {
  if (!conta.instagram_business_id) return []
  const media = await graphGet(`${conta.instagram_business_id}/media`, {
    fields: "id,media_type,media_product_type,permalink,thumbnail_url,caption,timestamp",
    limit: "25",
    access_token: accessToken,
  })
  return (media?.data || []) as Array<{
    id: string; media_type: string; media_product_type?: string
    permalink?: string; thumbnail_url?: string; caption?: string; timestamp?: string
  }>
}

function tipoPublicacao(m: { media_type: string; media_product_type?: string }): string {
  if (m.media_product_type === "REELS") return "reels"
  if (m.media_type === "CAROUSEL_ALBUM") return "carrossel"
  if (m.media_product_type === "STORY") return "story"
  return "imagem"
}

// métricas por tipo (nem todo metric existe pra todo tipo de mídia)
function metricasParaTipo(tipo: string): string[] {
  const base = ["reach", "likes", "comments", "saved", "shares", "total_interactions"]
  if (tipo === "reels") {
    return [...base, "plays", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time", "follows", "profile_visits"]
  }
  return base
}

async function sincronizarConta(conta: Conta, accessToken: string, executionStart: Date) {
  const publicacoesApi = await buscarPublicacoesDaConta(conta, accessToken)
  const publicacoesSalvas: { id: string; media_id: string; tipo: string }[] = []

  for (const p of publicacoesApi) {
    const tipo = tipoPublicacao(p)

    const { data: pubRow, error: upsertErr } = await db
      .from("publicacoes")
      .upsert({
        conta_id: conta.id,
        media_id: p.id,
        tipo,
        permalink: p.permalink ?? null,
        thumbnail_url: p.thumbnail_url ?? null,
        legenda: p.caption ?? null,
        publicado_em: p.timestamp ?? null,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "conta_id,media_id" })
      .select("id, media_id, tipo")
      .single()
    if (upsertErr || !pubRow) continue
    publicacoesSalvas.push(pubRow)

    // insights nativos da mídia — best effort, uma mídia com erro não derruba o resto
    try {
      const metricNames = metricasParaTipo(tipo)
      const ins = await graphGet(`${p.id}/insights`, {
        metric: metricNames.join(","),
        access_token: accessToken,
      })
      const m = metricMap(ins?.data || [])
      const alcance = m.reach || 0
      const interacoes = m.total_interactions || (m.likes || 0) + (m.comments || 0) + (m.saved || 0) + (m.shares || 0)

      await db.from("metricas_publicacao").insert({
        publicacao_id: pubRow.id,
        visualizacoes: m.plays || 0,
        alcance,
        impressoes: m.impressions || 0,
        curtidas: m.likes || 0,
        comentarios: m.comments || 0,
        salvamentos: m.saved || 0,
        envios: m.shares || 0,
        compartilhamentos: m.reshares || 0,
        interacoes_totais: interacoes,
        visitas_perfil: m.profile_visits || 0,
        seguidores_ganhos: m.follows || 0,
        seguidores_estimado: tipo !== "reels",
        retencao_media_seg: m.ig_reels_avg_watch_time ?? null,
        tempo_total_visto_seg: m.ig_reels_video_view_total_time ?? null,
        taxa_engajamento: alcance > 0 ? interacoes / alcance : null,
      })
    } catch (e) {
      console.error(`insights de mídia ${p.id} (${conta.nome}):`, (e as Error).message)
    }
  }

  // insights de conta (seguidores, alcance, visitas de perfil)
  try {
    const acctIns = await graphGet(`${conta.instagram_business_id}/insights`, {
      metric: "reach,profile_views,accounts_engaged",
      period: "day",
      metric_type: "total_value",
      access_token: accessToken,
    })
    const fields = await graphGet(`${conta.instagram_business_id}`, {
      fields: "followers_count",
      access_token: accessToken,
    })
    const m = metricMap(acctIns?.data || [])
    const hoje = new Date().toISOString().slice(0, 10)

    const { data: ontem } = await db
      .from("metricas_conta_diaria")
      .select("seguidores_total")
      .eq("conta_id", conta.id)
      .lt("data_referencia", hoje)
      .order("data_referencia", { ascending: false })
      .limit(1)
      .maybeSingle()

    const seguidoresTotal = fields?.followers_count ?? null
    const ganhoDia = seguidoresTotal != null && ontem?.seguidores_total != null
      ? Math.max(0, seguidoresTotal - ontem.seguidores_total)
      : 0

    await db.from("metricas_conta_diaria").upsert({
      conta_id: conta.id,
      data_referencia: hoje,
      seguidores_total: seguidoresTotal,
      seguidores_ganho_dia: ganhoDia,
      alcance_contas: m.reach || 0,
      visitas_perfil: m.profile_views || 0,
      capturado_em: new Date().toISOString(),
    }, { onConflict: "conta_id,data_referencia" })

    // heurística: quando o ganho de seguidores do dia não veio de metric
    // nativo por post (foto/carrossel), atribui ao post de maior alcance
    // capturado nesta execução — só uma estimativa, marcada como tal.
    if (ganhoDia > 0) {
      const { data: candidato } = await db
        .from("metricas_publicacao")
        .select("id, publicacao_id, alcance, seguidores_estimado")
        .eq("seguidores_estimado", true)
        .gte("capturado_em", executionStart.toISOString())
        .in("publicacao_id", publicacoesSalvas.map((p) => p.id))
        .order("alcance", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (candidato) {
        await db.from("metricas_publicacao")
          .update({ seguidores_ganhos: ganhoDia })
          .eq("id", candidato.id)
      }
    }
  } catch (e) {
    console.error(`insights de conta (${conta.nome}):`, (e as Error).message)
  }

  // tráfego pago — cruza anúncio ativo com a mídia orgânica correspondente
  if (conta.ad_account_id) {
    try {
      await sincronizarPago(conta, accessToken, publicacoesSalvas)
    } catch (e) {
      console.error(`insights pagos (${conta.nome}):`, (e as Error).message)
    }
  }
}

async function sincronizarPago(
  conta: Conta,
  accessToken: string,
  publicacoesSalvas: { id: string; media_id: string }[],
) {
  const ads = await graphGet(`${conta.ad_account_id}/ads`, {
    fields: "id,effective_object_story_id,insights{spend,impressions,reach,clicks,cpm,cpc,actions}",
    effective_status: JSON.stringify(["ACTIVE", "PAUSED"]),
    limit: "50",
    access_token: accessToken,
  })

  for (const ad of ads?.data || []) {
    const storyId: string | undefined = ad.effective_object_story_id
    if (!storyId) continue
    // effective_object_story_id vem como "{page-id}_{media-id}" — o
    // media_id orgânico é a parte depois do "_".
    const mediaId = storyId.split("_").pop()
    const pub = publicacoesSalvas.find((p) => p.media_id === mediaId)
    if (!pub) continue

    await db.from("publicacoes")
      .update({ origem: "impulsionado" })
      .eq("id", pub.id)

    const insightsAd = ad.insights?.data?.[0]
    if (!insightsAd) continue
    const acoes: { action_type: string; value: string }[] = insightsAd.actions || []
    const resultados = acoes.reduce((sum, a) => sum + (Number(a.value) || 0), 0)
    const gasto = Number(insightsAd.spend) || 0

    await db.from("metricas_publicacao_paga").insert({
      publicacao_id: pub.id,
      ad_id: ad.id,
      gasto,
      impressoes: Number(insightsAd.impressions) || 0,
      alcance: Number(insightsAd.reach) || 0,
      cliques_link: Number(insightsAd.clicks) || 0,
      cpm: insightsAd.cpm ? Number(insightsAd.cpm) : null,
      cpc: insightsAd.cpc ? Number(insightsAd.cpc) : null,
      resultados,
      custo_por_resultado: resultados > 0 ? gasto / resultados : null,
    })
  }
}

// ── ranking: normaliza cada critério 0–100 entre as contas da execução ──
async function calcularRanking(execucaoId: string, janelaInicio: string) {
  const { data: contas } = await db.from("contas_sociais").select("id, nome").eq("ativo", true)
  const { data: criterios } = await db.from("criterios_ranking").select("*").eq("ativo", true)
  if (!contas?.length || !criterios?.length) return

  type Agregado = Record<string, number | null>
  const porConta = new Map<string, Agregado>()
  for (const c of contas) porConta.set(c.id, {})

  for (const conta of contas) {
    const { data: pubs } = await db.from("publicacoes").select("id").eq("conta_id", conta.id)
    const pubIds = (pubs || []).map((p) => p.id)
    const agg: Agregado = { views: 0, seguidores: 0, curtidas: 0, envios: 0, salvamentos: 0, retencao: 0 }

    if (pubIds.length) {
      const { data: metricas } = await db
        .from("metricas_publicacao")
        .select("visualizacoes,curtidas,envios,salvamentos,seguidores_ganhos,retencao_media_seg,publicacao_id")
        .in("publicacao_id", pubIds)
        .gte("capturado_em", janelaInicio)
      let retSoma = 0, retN = 0
      for (const m of metricas || []) {
        agg.views += m.visualizacoes || 0
        agg.curtidas += m.curtidas || 0
        agg.envios += m.envios || 0
        agg.salvamentos += m.salvamentos || 0
        agg.seguidores += m.seguidores_ganhos || 0
        if (m.retencao_media_seg != null) { retSoma += m.retencao_media_seg; retN++ }
      }
      agg.retencao = retN > 0 ? retSoma / retN : 0
    }

    const { data: manual } = await db
      .from("metricas_manuais")
      .select("tempo_resposta_medio_min")
      .eq("conta_id", conta.id)
      .order("data_referencia", { ascending: false })
      .limit(1)
      .maybeSingle()
    agg.direct = manual?.tempo_resposta_medio_min ?? null

    porConta.set(conta.id, agg)
  }

  // normalização min-max por critério entre as contas ativas
  const scores = new Map<string, { total: number; detalhe: Record<string, unknown> }>()
  for (const conta of contas) scores.set(conta.id, { total: 0, detalhe: {} })

  const pesoTotal = criterios.reduce((s, c) => s + Number(c.peso), 0) || 1
  for (const crit of criterios) {
    const valores = contas.map((c) => porConta.get(c.id)?.[crit.chave])
    const validos = valores.filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
    const min = validos.length ? Math.min(...validos) : 0
    const max = validos.length ? Math.max(...validos) : 0
    contas.forEach((conta, idx) => {
      const raw = valores[idx]
      let norm = 0
      if (typeof raw === "number" && max > min) {
        norm = crit.direcao === "menor_melhor" ? (max - raw) / (max - min) : (raw - min) / (max - min)
      } else if (typeof raw === "number" && max === min && validos.length) {
        norm = 1 // todo mundo empatado no critério — todos ganham o peso cheio
      }
      const contribuicao = norm * 100 * (Number(crit.peso) / pesoTotal)
      const s = scores.get(conta.id)!
      s.total += contribuicao
      s.detalhe[crit.chave] = { valor: raw ?? null, normalizado: Math.round(norm * 100), contribuicao: Math.round(contribuicao * 10) / 10 }
    })
  }

  const ranked = contas
    .map((c) => ({ conta: c, ...scores.get(c.id)! }))
    .sort((a, b) => b.total - a.total)

  const rows = ranked.map((r, idx) => ({
    execucao_id: execucaoId,
    conta_id: r.conta.id,
    posicao: idx + 1,
    pontuacao_total: Math.round(r.total * 10) / 10,
    destaque: idx === 0,
    detalhamento: r.detalhe,
  }))
  if (rows.length) await db.from("ranking_perfis").insert(rows)
  if (rows.length) {
    await db.from("pontos_historico").insert(
      rows.map((r) => ({ conta_id: r.conta_id, execucao_id: execucaoId, pontos: r.pontuacao_total, posicao: r.posicao })),
    )
  }

  // melhor publicação de cada conta nesta janela (por views)
  for (const conta of contas) {
    const { data: pubs } = await db.from("publicacoes").select("id").eq("conta_id", conta.id)
    const pubIds = (pubs || []).map((p) => p.id)
    if (!pubIds.length) continue
    const { data: top } = await db
      .from("metricas_publicacao")
      .select("publicacao_id, visualizacoes")
      .in("publicacao_id", pubIds)
      .gte("capturado_em", janelaInicio)
      .order("visualizacoes", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (top) {
      await db.from("ranking_publicacoes").insert({
        execucao_id: execucaoId,
        conta_id: conta.id,
        publicacao_id: top.publicacao_id,
        posicao: 1,
        pontuacao: top.visualizacoes || 0,
        motivo_destaque: "Maior nº de visualizações no período",
      })
    }
  }

  // conquistas simples
  const topo = ranked[0]
  if (topo) {
    try {
      const { data: conquistaTop1 } = await db
        .from("conquistas").select("id").eq("chave", "top1_ranking").single()
      if (conquistaTop1) {
        await db.from("conquistas_perfil").insert({
          conta_id: topo.conta.id,
          execucao_id: execucaoId,
          conquista_id: conquistaTop1.id,
        })
      }
    } catch (e) {
      console.error("conquista top1_ranking:", (e as Error).message)
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })

  const auth = await autorizado(req)
  if (!auth.ok) return json({ error: "não autorizado" }, 401)

  let body: { tipo?: string } = {}
  try { body = await req.json() } catch { /* sem body é ok, default manual */ }
  const tipo = body.tipo === "auto_00h" || body.tipo === "auto_12h" ? body.tipo : "manual"

  const { data: execucao, error: execErr } = await db
    .from("ranking_execucoes")
    .insert({
      tipo,
      status: "em_andamento",
      executado_por: auth.uid ?? null,
      executado_por_nome: auth.nome ?? null,
    })
    .select()
    .single()
  if (execErr || !execucao) return json({ error: "falha ao registrar execução" }, 500)

  const executionStart = new Date()
  try {
    const { data: contas } = await db
      .from("contas_sociais")
      .select("id, nome, instagram_business_id, ad_account_id")
      .eq("ativo", true)

    const { data: tokens } = await db.from("contas_tokens").select("conta_id, access_token")
    const tokenPorConta = new Map((tokens || []).map((t) => [t.conta_id, t.access_token]))

    for (const conta of contas || []) {
      const token = tokenPorConta.get(conta.id)
      if (!token || !conta.instagram_business_id) continue // conta ainda sem token conectado — pula, não quebra o resto
      try {
        await sincronizarConta(conta, token, executionStart)
      } catch (e) {
        console.error(`sync falhou pra ${conta.nome}:`, (e as Error).message)
      }
    }

    const janelaInicioRes = await db
      .from("ranking_execucoes")
      .select("criado_em")
      .lt("criado_em", execucao.criado_em)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle()
    const janelaInicio = janelaInicioRes.data?.criado_em ?? new Date(0).toISOString()

    await calcularRanking(execucao.id, janelaInicio)

    await db.from("ranking_execucoes")
      .update({ status: "concluido", janela_inicio: janelaInicio, janela_fim: new Date().toISOString() })
      .eq("id", execucao.id)

    return json({ ok: true, execucao_id: execucao.id })
  } catch (e) {
    await db.from("ranking_execucoes")
      .update({ status: "erro", erro_detalhe: (e as Error).message })
      .eq("id", execucao.id)
    return json({ error: (e as Error).message, execucao_id: execucao.id }, 500)
  }
})
