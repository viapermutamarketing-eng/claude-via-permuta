# CRM Via Permuta

CRM de prospecção da Via Permuta — captação e qualificação de "Protagonistas"
(pequenos empreendedores) pro crédito pago com produto/serviço (permuta),
com painel de pipeline em tempo real.

Construído do zero seguindo a arquitetura de referência (formulário público
+ Edge Function + banco Postgres + painel realtime) documentada nos anexos
de handoff, com identidade visual e vocabulário adaptados ao manual de marca
da Via Permuta ("A liberdade é uma decisão", comunidade Protagonistas).

## Arquitetura

```
public/diagnostico.html  --POST JSON-->  Edge Function diagnostico-lead  --grava-->  tabela leads (Postgres)
   (formulário público)                    (supabase/functions)                            |
                                                                                    +--Realtime--> public/index.html
                                                                                    |             (painel, só p/ authenticated)
                                                                                    +--e-mails via Resend (aviso interno + confirmação pro lead)
```

- **`public/diagnostico.html`** — formulário multi-etapa (quiz) público, sem
  framework, sem build step. Qualifica o lead (perfil, objetivo do crédito,
  faturamento, segmento, urgência…) e salva o progresso a cada etapa —
  mesmo quem abandona no meio vira um lead aproveitável.
- **`supabase/functions/diagnostico-lead/index.ts`** — Edge Function (Deno)
  que recebe o POST do formulário e grava na tabela `leads`, com upsert
  progressivo por sessão, dedup por telefone, merge campo a campo (nunca
  perde uma resposta boa por causa de uma visita parcial) e e-mails via
  Resend só quando o formulário é completado de verdade.
- **`supabase/migrations/`** — schema completo do CRM: `leads` (tabela
  central), `pipeline_etapas`, `atividades_crm`, `historico_lead`,
  `anotacoes`, `listas`/`leads_lista`, `atividades`/`atividades_vendedor`,
  `clientes`, RLS (só `authenticated`) e Realtime.
- **`public/index.html`** — painel de prospecção (login + 6 telas: Hoje,
  Pipeline, Leads, Diagnóstico, Listas, Atividades), atualizado em tempo
  real via um único canal do Supabase Realtime, sem F5 e sem polling.

## Antes de publicar — troque estes placeholders

| Onde | O quê | Onde conseguir |
|---|---|---|
| `public/diagnostico.html` (topo do `<script>`) | `WHATSAPP_NUM` — WhatsApp da Via Permuta, só dígitos com DDI+DDD | — |
| `public/diagnostico.html` (topo do `<script>`) | `LEAD_ENDPOINT` — URL da Edge Function | Supabase → Project Settings → API → Functions |
| `public/diagnostico.html` (rodapé, botão flutuante) | `var num` — mesmo número do `WHATSAPP_NUM` acima | — |
| `public/index.html` (topo do `<script>`) | `SUPABASE_URL` e `SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `public/index.html` (topo do `<script>`) | `WHATSAPP_NUM` | — |
| `supabase/functions/diagnostico-lead/index.ts` | `FROM_INTERNO`, `FROM_LEAD`, `DEST_EMAILS`, `PAINEL_URL` | domínio verificado no Resend + e-mail do time |

A **anon key** do Supabase é pra ficar pública mesmo (a segurança real está
na RLS — ver `0006_rls.sql`). A **service_role key** nunca entra em nenhum
arquivo deste repositório: ela já fica disponível automaticamente dentro de
toda Edge Function do projeto, via `SUPABASE_SERVICE_ROLE_KEY`.

## Deploy — passo a passo

### 1. Supabase

1. [supabase.com](https://supabase.com) → **New Project**.
2. Guardar em *Project Settings → API*: **Project URL** e **anon/publishable key**.
3. Rodar as migrations, na ordem (`SQL Editor` do Supabase ou `supabase db push`):
   `0001_leads.sql` → `0002_pipeline_atividades.sql` → `0003_listas.sql` →
   `0004_atividades_diarias.sql` → `0005_clientes.sql` → `0006_rls.sql` →
   `0007_realtime.sql`.
4. Criar os usuários da equipe em *Authentication → Users* (login do painel
   é e-mail/senha via Supabase Auth).
5. Deploy da Edge Function:
   ```bash
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase functions deploy diagnostico-lead --no-verify-jwt
   ```
   O `--no-verify-jwt` é obrigatório — o visitante do formulário não está
   logado.
6. (Opcional, pra e-mails de notificação) `npx supabase secrets set RESEND_API_KEY=re_xxxxxxxx`.
   Sem isso a function continua salvando o lead normalmente, só os e-mails
   não saem.

### 2. Vercel

Site 100% estático (HTML puro, sem build):

1. Subir este repositório pro GitHub.
2. Vercel → **New Project** → importar o repositório.
3. **Framework Preset: "Other"**, sem Build Command, **Output Directory: `public`**.
4. Deploy. Não precisa configurar variável de ambiente nenhuma — as chaves
   que o site usa (anon key) já estão escritas direto no HTML.
5. (Opcional) domínio próprio em *Project → Settings → Domains*.

## Erros comuns

- **401 no fetch do formulário** → esqueceu o `--no-verify-jwt` no deploy da function.
- **Function "funciona" mas não salva nada** → checar se `SUPABASE_URL`/`SUPABASE_ANON_KEY` no `index.html` batem com o projeto certo.
- **Lead salva mas e-mail não chega** → normal se `RESEND_API_KEY` não foi configurado; é o fallback de propósito, não é erro.
- **Painel não atualiza sozinho** → confirmar que a migration `0007_realtime.sql` rodou (tabelas precisam estar na publication `supabase_realtime`).

## Identidade visual

Paleta e tipografia derivadas do manual de marca da Via Permuta (bordô/preto
profundo `#170D0E`, dourado `#B08D4F`, creme `#F7F0E4`; serif Fraunces para
títulos, Nunito para o corpo, JetBrains Mono para rótulos). O emblema usado
no cabeçalho é uma peça original inspirada na descrição do símbolo da marca
(leão em movimento, caminhos convergentes) — não é o logotipo oficial da
Via Permuta, então troque pelo arquivo de logo real assim que ele estiver
disponível em formato vetorial.
