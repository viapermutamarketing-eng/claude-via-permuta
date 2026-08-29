// ════════════════════════════════════════════════════════════════
// Edge Function: diagnostico-lead
// Recebe as respostas do formulário público public/diagnostico.html
// (site Via Permuta) e grava/atualiza um lead na tabela `leads` do
// CRM — MESMO se a pessoa não terminar de preencher (upsert
// progressivo por session_id, chamado a cada etapa).
//
// Roda com SERVICE_ROLE_KEY (bypassa RLS) — o site público nunca
// fala direto com `leads` (RLS só libera pra `authenticated`), só
// com esta função. Verify JWT desligado no deploy (--no-verify-jwt):
// é um endpoint público, o visitante não está logado.
//
// DEDUPLICAÇÃO POR TELEFONE: se a mesma pessoa voltar em outra visita
// (session_id novo) e o telefone bater com um lead que já veio desse
// mesmo formulário antes, reaproveita o MESMO lead em vez de criar um
// duplicado. Se ela já tinha completado o formulário uma vez e agora
// completa de novo com respostas diferentes, a resposta ANTERIOR é
// arquivada em `diagnostico_historico` antes de sobrescrever — nada
// se perde.
//
// E-MAILS: só dispara quando `completo:true` chega de verdade (não a
// cada etapa) — um aviso pro time interno com TODOS os dados
// respondidos, e uma confirmação pro próprio lead (se ele informou
// e-mail). Reenvios idênticos (duplo clique, retry de rede) são
// ignorados — só dispara de novo se os dados realmente mudaram desde
// a última vez, ou se o envio anterior falhou (retry automático).
//
// Deploy: npx supabase functions deploy diagnostico-lead --no-verify-jwt
// Secrets: RESEND_API_KEY (opcional — sem ele os e-mails só não saem,
// o lead continua sendo salvo normalmente). SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY já ficam disponíveis automaticamente
// dentro de toda Edge Function do projeto, não precisa configurar.
// ════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? ""

// ── TODO: troque estes 4 valores antes de publicar em produção ──
const FROM_INTERNO     = "Via Permuta · Diagnóstico <leads@SEU_DOMINIO_AQUI>"
const FROM_LEAD        = "Via Permuta <contato@SEU_DOMINIO_AQUI>"
const DEST_EMAILS      = ["SEU_EMAIL_AQUI@exemplo.com"]
const PAINEL_URL       = "https://SEU_PAINEL_AQUI.vercel.app"
// ──────────────────────────────────────────────────────────────

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } })

// ── saneamento de entrada (endpoint público — nunca confiar no payload) ──
function str(v: unknown, max = 500): string {
  if (typeof v !== "string") return ""
  return v.trim().slice(0, max)
}
function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function soDigitos(s: string): string {
  return (s || "").replace(/\D/g, "")
}

type CamposDiag = {
  decisor: string; telefone: string; email: string | null; cargo: string | null
  segmento: string | null; faturamento_medio: string | null; socios: string | null
  objetivo_credito: string | null; tempo_negocio: string | null; urgencia: string | null
  instagram_linkedin: string | null; diagnostico_etapa: number; diagnostico_completo: boolean
  atualizado_em: string
}

// campos que definem "a resposta é a mesma ou mudou" (ignora metadados como etapa/timestamps)
function assinatura(c: Record<string, unknown>): string {
  return JSON.stringify({
    decisor: c.decisor || null, telefone: c.telefone || null, email: c.email || null,
    cargo: c.cargo || null, segmento: c.segmento || null, faturamento_medio: c.faturamento_medio || null,
    socios: c.socios || null, objetivo_credito: c.objetivo_credito || null, tempo_negocio: c.tempo_negocio || null,
    urgencia: c.urgencia || null, instagram_linkedin: c.instagram_linkedin || null,
  })
}

// Campo a campo: só troca o valor antigo pelo novo quando o novo veio
// preenchido de verdade. Protege contra uma visita parcial (a pessoa volta,
// preenche só metade e some de novo) apagar respostas boas de uma visita
// anterior já completa.
const CAMPOS_MESCLAVEIS = [
  "decisor", "telefone", "email", "cargo", "segmento", "faturamento_medio",
  "socios", "objetivo_credito", "tempo_negocio", "urgencia", "instagram_linkedin",
] as const
function mesclarCampos(velho: Record<string, unknown>, novo: CamposDiag): CamposDiag {
  const resultado = { ...novo } as Record<string, unknown>
  for (const campo of CAMPOS_MESCLAVEIS) {
    const v = (novo as Record<string, unknown>)[campo]
    if (v === null || v === undefined || v === "") resultado[campo] = velho[campo] ?? null
  }
  return resultado as CamposDiag
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch (_) { return json({ error: "JSON inválido" }, 400) }

  const sessionId = str(body.session_id, 100)
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(sessionId)) return json({ ok: true, skipped: true })

  const a = (body.answers && typeof body.answers === "object") ? body.answers as Record<string, unknown> : {}
  const nome      = str(a.nomeConfirma) || str(a.nome)
  const telefone  = str(a.whatsappConfirma) || str(a.whatsapp)
  const etapaRaw  = Number(body.etapa)
  const etapa     = Number.isFinite(etapaRaw) ? Math.max(0, Math.min(11, Math.round(etapaRaw))) : 0
  const completo  = body.completo === true

  if (!nome || !telefone) return json({ ok: true, skipped: true, reason: "sem nome/telefone ainda" })
  const telNormalizado = soDigitos(telefone)

  const camposDiagnostico: CamposDiag = {
    decisor:             nome,
    telefone,
    email:               str(a.email) || null,
    cargo:               str(a.perfil) || null,
    segmento:            str(a.segmento) || null,
    faturamento_medio:   str(a.faturamento) || null,
    socios:              str(a.socios) || null,
    objetivo_credito:    str(a.objetivo_credito, 2000) || null,
    tempo_negocio:       str(a.tempo_negocio) || null,
    urgencia:            str(a.urgencia) || null,
    instagram_linkedin:  str(a.social) || null,
    diagnostico_etapa:   etapa,
    diagnostico_completo: completo,
    atualizado_em:       new Date().toISOString(),
  }

  try {
    // 1) tenta achar o rascunho DESSA visita (mesmo session_id)
    let { data: existente, error: buscaErr } = await db
      .from("leads")
      .select("id, notificado_em, confirmacao_enviada_em, diagnostico_etapa, diagnostico_completo, diagnostico_session_id, diagnostico_historico, decisor, telefone, email, cargo, segmento, faturamento_medio, socios, objetivo_credito, tempo_negocio, urgencia, instagram_linkedin")
      .eq("diagnostico_session_id", sessionId).maybeSingle()
    if (buscaErr) throw buscaErr

    // 2) se não achou (visita nova), procura pelo TELEFONE entre leads que vieram desse mesmo formulário antes
    if (!existente) {
      const { data: porTelefone, error: telErr } = await db
        .from("leads")
        .select("id, notificado_em, confirmacao_enviada_em, diagnostico_etapa, diagnostico_completo, diagnostico_session_id, diagnostico_historico, decisor, telefone, email, cargo, segmento, faturamento_medio, socios, objetivo_credito, tempo_negocio, urgencia, instagram_linkedin")
        .not("diagnostico_session_id", "is", null)
        .order("criado_em", { ascending: false })
        .limit(50)
      if (telErr) throw telErr
      existente = (porTelefone || []).find(l => soDigitos(l.telefone || "") === telNormalizado) || null
    }

    let isNovo = !existente
    let jaEstavaCompleto = !!existente?.diagnostico_completo
    let mudouDados = isNovo ? true : assinatura(existente as Record<string, unknown>) !== assinatura(camposDiagnostico)

    let leadId = ""
    let historico = (existente?.diagnostico_historico as unknown[]) || []
    let precisaAtualizar = !isNovo

    if (isNovo) {
      const hoje = new Date().toISOString().slice(0, 10)
      const { data: novo, error: insErr } = await db.from("leads").insert({
        ...camposDiagnostico,
        empresa: nome,
        canal: "Diagnóstico Site",
        tipo_lead: "inbound",
        estagio: "potencial",
        estagio_desde: hoje,
        lgpd_consentimento: true,
        lgpd_data: hoje,
        diagnostico_session_id: sessionId,
      }).select("id").single()
      if (insErr) {
        // Duas chamadas quase simultâneas da MESMA visita nova (ex: primeira
        // e segunda etapa disparando quase juntas) podem tentar criar o
        // mesmo lead ao mesmo tempo — o índice único em diagnostico_session_id
        // barra a segunda. Trata como "na verdade já existe", vira UPDATE.
        if (String(insErr.message || "").includes("diagnostico_session_id")) {
          const { data: jaExiste } = await db.from("leads")
            .select("id, notificado_em, confirmacao_enviada_em, diagnostico_etapa, diagnostico_completo, diagnostico_historico, decisor, telefone, email, cargo, segmento, faturamento_medio, socios, objetivo_credito, tempo_negocio, urgencia, instagram_linkedin")
            .eq("diagnostico_session_id", sessionId).single()
          if (!jaExiste) throw insErr
          existente = jaExiste
          isNovo = false
          jaEstavaCompleto = !!existente.diagnostico_completo
          mudouDados = assinatura(existente as Record<string, unknown>) !== assinatura(camposDiagnostico)
          historico = (existente.diagnostico_historico as unknown[]) || []
          precisaAtualizar = true
        } else throw insErr
      } else {
        leadId = novo!.id
      }
    }

    if (precisaAtualizar) {
      leadId = existente!.id
      // revisão completa de verdade: já tinha completado antes E completou
      // de novo agora E as respostas são diferentes → arquiva a resposta
      // ANTERIOR (nada se perde) e substitui tudo pela nova
      const revisaoCompleta = completo && jaEstavaCompleto && mudouDados
      if (revisaoCompleta) {
        historico = [...historico, {
          arquivado_em: new Date().toISOString(),
          decisor: existente!.decisor, telefone: existente!.telefone, email: existente!.email,
          cargo: existente!.cargo, segmento: existente!.segmento, faturamento_medio: existente!.faturamento_medio,
          socios: existente!.socios, objetivo_credito: existente!.objetivo_credito, tempo_negocio: existente!.tempo_negocio,
          urgencia: existente!.urgencia, instagram_linkedin: existente!.instagram_linkedin,
        }]
      }

      // Fora do caso de revisão completa (ex: a pessoa volta, abre o
      // formulário nas primeiras etapas de novo e some antes de re-terminar),
      // NUNCA deixa um campo em branco desta visita apagar uma resposta boa
      // que já existia — só troca campo a campo quando a nova resposta
      // realmente veio preenchida.
      const camposParaSalvar = revisaoCompleta
        ? camposDiagnostico
        : mesclarCampos(existente as Record<string, unknown>, camposDiagnostico)

      // Guarda ATÔMICA contra requisições fora de ordem: duas chamadas em
      // segundo plano da MESMA visita podem estar "em voo" ao mesmo tempo
      // (ex: etapa 9 e a etapa final 10 quase juntas) — só ler o estado
      // antes de escrever (checar e DEPOIS gravar) tem uma brecha onde as
      // duas leem o mesmo estado antigo e a mais nova pode ser sobrescrita
      // pela mais velha. Por isso o filtro `lte` vai DENTRO da própria
      // instrução UPDATE do banco: só grava se, NO MOMENTO EXATO da escrita,
      // a etapa aqui é >= a que já está salva.
      //
      // Isso só faz sentido comparando a MESMA visita contra ela mesma —
      // quando o lead foi achado por TELEFONE (visita nova reaproveitando
      // um lead antigo já mais avançado/completo), a etapa dessa visita
      // nova começa baixa de propósito e não pode ser barrada por causa da
      // etapa alta de uma visita ANTERIOR e diferente.
      const mesmaVisitaContinuando = existente!.diagnostico_session_id === sessionId
      let query = db.from("leads").update({
        ...camposParaSalvar,
        // uma vez completo, nunca "descompleta": se a pessoa voltar e abandonar
        // no meio de um novo preenchimento, o rascunho atualiza os campos mas
        // não apaga o status de "já completou uma vez" que o time já viu.
        diagnostico_completo: completo || jaEstavaCompleto,
        diagnostico_session_id: sessionId, // reassocia essa visita nova ao mesmo lead
        diagnostico_historico: historico,
      }).eq("id", leadId)
      if (mesmaVisitaContinuando) query = query.lte("diagnostico_etapa", etapa)
      const { data: atualizado, error: updErr } = await query.select("id")
      if (updErr) throw updErr
      if (!atualizado || atualizado.length === 0) {
        return json({ ok: true, skipped: true, reason: "superada por uma requisição mais nova" })
      }
    }

    // ── e-mails: só quando REALMENTE completou (etapa final), e só se é novidade ──
    const completouAgora = completo && (isNovo || !jaEstavaCompleto || mudouDados)
    const retryNotificacao = completo && !completouAgora && existente && !existente.notificado_em
    const retryConfirmacao = completo && !completouAgora && existente && !existente.confirmacao_enviada_em && !!camposDiagnostico.email

    if (completouAgora || retryNotificacao) {
      const ok = await enviarNotificacaoInterna(leadId, nome, camposDiagnostico, mudouDados && jaEstavaCompleto)
      if (ok) await db.from("leads").update({ notificado_em: new Date().toISOString() }).eq("id", leadId)
    }
    if ((completouAgora || retryConfirmacao) && camposDiagnostico.email) {
      const ok = await enviarConfirmacaoLead(nome, camposDiagnostico.email)
      if (ok) await db.from("leads").update({ confirmacao_enviada_em: new Date().toISOString() }).eq("id", leadId)
    }

    return json({ ok: true })
  } catch (e) {
    console.error("diagnostico-lead error:", e)
    // nunca deixa o formulário do site quebrar por causa disso
    return json({ ok: false, error: String(e) }, 200)
  }
})

// ── proteção simples contra flood no e-mail (dados continuam sendo salvos sempre) ──
async function excedeuLimiteDeEmails(): Promise<boolean> {
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await db.from("leads").select("id", { count: "exact", head: true })
    .eq("canal", "Diagnóstico Site").gte("criado_em", umaHoraAtras)
  return (count || 0) > 20
}

async function enviarResend(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) { console.error("Resend error:", await res.text()); return false }
    return true
  } catch (e) {
    console.error("erro ao chamar Resend:", e)
    return false
  }
}

// declara explicitamente "só modo claro" pro Gmail/Apple Mail não tentarem
// "adaptar" as cores pro dark mode automático deles.
const EMAIL_HEAD = `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<style>:root{color-scheme:light;supported-color-schemes:light;}</style>`

async function enviarNotificacaoInterna(leadId: string, nome: string, c: CamposDiag, ehReenvio: boolean): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  if (await excedeuLimiteDeEmails()) { console.log("Limite de notificações/hora atingido — pulando e-mail, lead salvo normalmente."); return false }

  const telDigits = soDigitos(c.telefone)
  const wppLink = telDigits ? `https://wa.me/55${telDigits.replace(/^55/, "")}` : ""

  const linha = (label: string, val: string | null) => val
    ? `<tr><td bgcolor="#1a1012" style="background:#1a1012;padding:9px 0;border-bottom:1px solid #3a2a24;font-size:12px;color:#c9ac86;width:150px;vertical-align:top;">${esc(label)}</td><td bgcolor="#1a1012" style="background:#1a1012;padding:9px 0;border-bottom:1px solid #3a2a24;font-size:14px;color:#f7f0e4;font-weight:600;">${esc(val)}</td></tr>`
    : ""

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">${EMAIL_HEAD}</head>
<body style="margin:0;padding:0;background:#170D0E;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#170D0E" style="background:#170D0E;padding:28px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td bgcolor="#7A5E30" style="background-color:#7A5E30;background-image:linear-gradient(135deg,#B08D4F 0%,#5C4522 100%);padding:34px 36px;border-radius:14px 14px 0 0;text-align:center;">
    <div style="font-size:34px;line-height:1;margin-bottom:10px;">${ehReenvio ? "🔁" : "🦁"}</div>
    <div style="font-size:11px;font-weight:800;color:#F7F0E4;text-transform:uppercase;letter-spacing:.2em;margin-bottom:8px;">${ehReenvio ? "LEAD ATUALIZOU AS RESPOSTAS" : "NOVO LEAD · DIAGNÓSTICO PROTAGONISTA"}</div>
    <div style="font-size:28px;font-weight:800;color:#ffffff !important;margin-bottom:4px;">${esc(nome)}</div>
    ${c.cargo ? `<div style="font-size:14px;color:#F0E2C4;">${esc(c.cargo)}</div>` : ""}
  </td></tr>

  <tr><td bgcolor="#201315" style="background:#201315;padding:8px 36px;text-align:center;border-bottom:1px solid #3a2a24;">
    <span style="display:inline-block;background-color:#1c3b2c;color:#4EDB93;border:1px solid #2f6b4a;border-radius:20px;padding:6px 16px;font-size:11px;font-weight:700;margin:10px 0;">
      ⚡ ${ehReenvio ? "Preencheu de novo com respostas diferentes" : "Preencheu o diagnóstico completo agora"}
    </span>
  </td></tr>

  <tr><td bgcolor="#1a1012" style="background:#1a1012;padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${linha("📱 WhatsApp", c.telefone)}
      ${linha("✉️ E-mail", c.email)}
      ${linha("💼 Perfil", c.cargo)}
      ${linha("📸 Instagram", c.instagram_linkedin)}
      ${linha("🏷 Segmento", c.segmento)}
      ${linha("💰 Faturamento", c.faturamento_medio)}
      ${linha("🕐 Tempo de negócio", c.tempo_negocio)}
      ${linha("⏱ Urgência", c.urgencia)}
      ${linha("🤝 Tem sócios", c.socios)}
    </table>

    ${c.objetivo_credito ? `<div style="margin-top:20px;background-color:#3a2411;border:1px solid #7A5E30;border-radius:12px;padding:16px 18px;">
      <div style="font-size:10px;font-weight:700;color:#D9BD82;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;">Objetivo do crédito (resposta do lead)</div>
      <div style="font-size:14px;color:#f7f0e4;line-height:1.5;">${esc(c.objetivo_credito)}</div>
    </div>` : ""}

    <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
      <tr>
        ${wppLink ? `<td style="padding:4px;"><a href="${wppLink}" style="display:inline-block;background-color:#25D366;color:#ffffff;text-decoration:none;font-weight:800;font-size:13px;padding:13px 24px;border-radius:30px;">💬 Chamar no WhatsApp</a></td>` : ""}
        <td style="padding:4px;"><a href="${PAINEL_URL}/#lead=${leadId}" style="display:inline-block;background-color:#B08D4F;color:#170D0E;text-decoration:none;font-weight:800;font-size:13px;padding:13px 24px;border-radius:30px;">→ Ver lead no painel</a></td>
      </tr>
    </table>

    <div style="margin-top:30px;padding-top:18px;border-top:1px solid #3a2a24;text-align:center;">
      <div style="font-size:10px;color:#8a7361;">Via Permuta · notificação automática do formulário de diagnóstico</div>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return enviarResend({
    from: FROM_INTERNO,
    to: DEST_EMAILS,
    subject: `${ehReenvio ? "🔁 Lead atualizou respostas" : "🦁 Novo lead"}: ${nome}${c.cargo ? " (" + c.cargo + ")" : ""} · Diagnóstico Via Permuta`,
    html,
  })
}

// e-mail de confirmação pro PRÓPRIO LEAD, quando ele informa e-mail e completa o formulário
async function enviarConfirmacaoLead(nome: string, emailLead: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  const primeiroNome = (nome || "").trim().split(/\s+/)[0] || "tudo bem"

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">${EMAIL_HEAD}</head>
<body style="margin:0;padding:0;background:#170D0E;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#170D0E" style="background:#170D0E;padding:28px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td bgcolor="#7A5E30" style="background-color:#7A5E30;background-image:linear-gradient(135deg,#B08D4F 0%,#5C4522 100%);padding:36px 36px;border-radius:14px 14px 0 0;text-align:center;">
    <div style="font-size:38px;line-height:1;margin-bottom:12px;">✅</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff !important;margin-bottom:6px;">Recebemos seu diagnóstico, ${esc(primeiroNome)}!</div>
    <div style="font-size:14px;color:#F0E2C4;">Um especialista da Via Permuta vai te chamar em breve</div>
  </td></tr>

  <tr><td bgcolor="#1a1012" style="background:#1a1012;padding:32px;">
    <p style="font-size:15px;color:#EFE6D8;line-height:1.7;margin:0 0 18px;">Oi, ${esc(primeiroNome)}! Sua Reunião Protagonista gratuita já está sendo preparada. Nosso time analisa suas respostas e entra em contato pelo WhatsApp em até 24 horas úteis pra agendar o melhor horário.</p>

    <div style="background-color:#3a2411;border:1px solid #7A5E30;border-radius:14px;padding:20px 22px;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:700;color:#D9BD82;text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;">Na reunião você recebe</div>
      <div style="font-size:14px;color:#f7f0e4;line-height:1.9;">
        ✓ Simulação do seu crédito Via Permuta<br>
        ✓ Diagnóstico do seu negócio hoje<br>
        ✓ Acesso à Rede Protagonistas<br>
        ✓ Direção prática dos próximos passos
      </div>
    </div>

    <p style="font-size:13.5px;color:#c9ac86;line-height:1.6;margin:0 0 24px;">Se preferir adiantar a conversa, é só chamar a gente direto:</p>

    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr><td><a href="https://wa.me/SEU_WHATSAPP_AQUI" style="display:inline-block;background-color:#25D366;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:14px 28px;border-radius:30px;">💬 Chamar no WhatsApp</a></td></tr>
    </table>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #3a2a24;text-align:center;">
      <div style="font-size:10px;color:#8a7361;">Via Permuta · A liberdade é uma decisão · contato@SEU_DOMINIO_AQUI</div>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return enviarResend({
    from: FROM_LEAD,
    to: [emailLead],
    subject: `✅ Recebemos seu diagnóstico, ${primeiroNome}! Próximos passos`,
    html,
  })
}
