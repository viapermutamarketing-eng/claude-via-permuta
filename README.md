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

## Plataforma de Insights (`public/insights.html`)

Painel gamificado de ranking de performance no Instagram/Meta das contas da
Via Permuta (Master, Franca, Araxá, Curitiba, Uberlândia 1, Uberaba, contas
pessoais do time e o Podcast Ruptura Empreendedores) — orgânico e tráfego
pago lado a lado, com ranking automático 2x/dia. O pedido completo e o
checklist de cobertura estão em [`docs/PLATAFORMA_INSIGHTS.md`](docs/PLATAFORMA_INSIGHTS.md)
— consulte sempre que for evoluir a plataforma.

Roda num **projeto Supabase dedicado** — `qkukcyrglfmlacwqvbay`,
**separado** do projeto do CRM de vendas — de propósito: dado de rede
social nunca se mistura com dado de lead. Zero custo extra mesmo assim
(free tier cobre os dois projetos).

### 1. Deploy automático (GitHub Actions)

`.github/workflows/deploy-supabase.yml` aplica as migrations e publica a
Edge Function sozinho a cada push na `main` que mexer em `supabase/`
(ou rodando manualmente na aba **Actions** → *Deploy Supabase* → **Run
workflow**). Existe porque sandboxes de agente costumam ter a rede pro
Supabase bloqueada — o workflow roda no runner do GitHub, que tem
internet livre.

Só precisa cadastrar **3 segredos** uma vez, em
*Settings → Secrets and variables → Actions → New repository secret*:

| Nome do secret | Onde conseguir |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → Generate new token |
| `SUPABASE_DB_PASSWORD` | Supabase → Project Settings → Database (a senha que você definiu ao criar o projeto — "Reset database password" se esqueceu) |
| `SYNC_SECRET` | Qualquer valor aleatório que você escolher (ex.: rode `openssl rand -base64 32` no terminal) — é só um handshake interno entre o cron e a Edge Function, nunca fica salvo no código |

Depois de cadastrar os três, um push (ou o "Run workflow" manual) já deixa
banco + Edge Function no ar sozinho — sem precisar rodar nada local.

### 2. Criar o login da equipe neste projeto

Como é um projeto novo, os usuários da equipe ainda não existem aqui
(são diferentes dos usuários do CRM). Supabase → **Authentication → Users
→ Add user**, um por pessoa do time (Social Sellers e Social Medias usam
o mesmo login pra entrar no `insights.html`).

### 3. Conectar cada conta do Instagram (uma vez por conta)

A Graph API exige que a conta do Instagram seja **Business/Creator**,
vinculada a uma Página do Facebook, dentro do Business Manager da Via
Permuta. Como é uso interno (você administrando suas próprias contas), dá
pra operar com um **token de sistema (System User)** do próprio Business
Manager, sem precisar passar pelo App Review completo da Meta:

1. [developers.facebook.com](https://developers.facebook.com) → criar um
   App tipo "Business".
2. No Business Manager → **Usuários do sistema** → criar um System User
   com papel Admin → gerar token com as permissões:
   `instagram_basic`, `instagram_manage_insights`,
   `pages_read_engagement`, `pages_show_list`, e `ads_read` (se for
   cruzar com tráfego pago).
3. Pegar o **Instagram Business Account ID** de cada perfil (Graph API
   Explorer: `GET /{page-id}?fields=instagram_business_account`) e, se for
   cruzar pago, o **Ad Account ID** (`act_XXXXXXXXX`).
4. No SQL Editor do Supabase, preencher a conta já criada pelo seed da
   `0008` e gravar o token (só a Edge Function, com a service_role key,
   consegue ler esta tabela — RLS bloqueia geral, ver `0012_insights_rls.sql`):
   ```sql
   update contas_sociais
     set instagram_business_id = '17841400...',
         facebook_page_id = '10000...',
         ad_account_id = 'act_1234567890', -- opcional, só se for cruzar pago
         username_instagram = '@viapermuta'
     where nome = 'Via Permuta Master';

   insert into contas_tokens (conta_id, access_token, escopos)
     select id, 'EAAG...', 'instagram_basic,instagram_manage_insights,pages_read_engagement,ads_read'
     from contas_sociais where nome = 'Via Permuta Master';
   ```
   Repita pra cada uma das 10 contas do seed. Token de System User dura
   60 dias — marque uma recorrência pra renovar (`token_expira_em` ajuda a
   lembrar).

### 4. Aba Campanhas (decisão de mídia)

As abas Ranking/Perfis respondem *qual post performou*. A aba
**Campanhas** responde a outra pergunta, que é de mídia e não de
conteúdo: **pra onde vai o orçamento e qual campanha escala.**

Ela só popula pra contas com `ad_account_id` preenchido e token com
escopo `ads_read`. A cada sincronização, a Edge Function espelha as
campanhas da conta de anúncio (`campanhas`) com orçamento diário, nº de
conjuntos ativos e função no funil, e grava insights em duas
granularidades:

| Tabela | Granularidade | Pra que serve |
| --- | --- | --- |
| `metricas_campanha_diaria` | 1 linha por campanha por dia | tendência |
| `metricas_campanha_janela` | 1 linha por campanha por janela (7d, 30d) | **alcance e frequência corretos** |

As duas existem por um motivo concreto: `reach` desduplica pessoas
*dentro da janela pedida*. Somar o alcance de 7 dias diários dá um
número maior que o alcance real de 7 dias, e a frequência calculada
sobre essa soma sai **subestimada** — justo a métrica que decide se o
remarketing saturou. Então frequência vem sempre da janela agregada.

O veredito de cada campanha sai da view `v_diagnostico_campanha`
(migration `0015`), não do front-end, pra que painel e SQL nunca
divirjam. Ordem de avaliação, a primeira que bate decide:

| Veredito | Dispara quando | Ação |
| --- | --- | --- |
| `trocar_objetivo` | objetivo é de alcance/awareness | o leilão não persegue conversão nem seguidor; custo por seguidor ali é divisão aritmética. Duplicar pra Engajamento → visitas ao perfil |
| `cortar_conjuntos` | mais de 1 conjunto **e** teto sustentável < conjuntos ativos | desligar os de pior custo até caber |
| `ampliar_publico` | frequência 7d > `limite_frequencia` | ampliar janela/listas ou baixar verba |
| `sem_resultado` | gastou e não registrou resultado | evento de conversão provavelmente quebrado |
| `pausar_refazer` | custo > 150% da meta | criativo e público novos |
| `corrigir` | custo > meta | trocar criativo antes de mexer em verba |
| `subir_orcamento` | verba < mínimo de aprendizado pra **um** conjunto | trava é de volume, não de eficiência |
| `escalar` | custo ≤ 80% da meta, sem travas | +20–25% a cada 3–4 dias |
| `manter` | resto | nada esta semana |

O limiar de aprendizado é regra da plataforma: cada conjunto precisa de
~50 eventos de otimização por semana. Daí sai o teto de conjuntos que um
orçamento sustenta num dado custo:

```
conjuntos sustentáveis = (orçamento/dia × 7) ÷ (50 × custo por resultado)
```

`cortar_conjuntos` exige mais de um conjunto ativo de propósito: com um
conjunto só não existe o que cortar, e aí o problema é o custo
(`pausar_refazer`/`corrigir`) ou a verba (`subir_orcamento`).

As metas são do negócio, não benchmark de mercado — ficam em
`metas_campanha` (linha única) e são editáveis na própria aba:
`meta_cpl`, `meta_custo_seguidor`, `limite_frequencia`,
`eventos_aprendizado`.

Em CBO o orçamento diário vem da campanha; em ABO a campanha vem sem
orçamento e o valor real é a soma dos conjuntos ativos — a sincronização
cobre os dois casos e registra a origem em `orcamento_origem`.

A função no funil (`prospeccao` / `remarketing` / `alcance` / `outro`) é
inferida do objetivo + nome. Quando a nomenclatura mentir, preencha
`campanhas.funcao_manual` — ela ganha sempre.

### 5. Testar

No painel (`insights.html` → aba Ranking), clique **"Atualizar agora"** —
dispara a Edge Function na hora, sem esperar o cron. Se alguma conta ainda
não tiver token conectado, ela é simplesmente pulada (não quebra a
sincronização das outras).

O cron (`pg_cron`, migration `0014`) já fica agendado pra rodar sozinho
todo dia às 00h00 e 12h00 (horário de Brasília).

### Dashboard gamificado (Next.js + Tailwind + Framer Motion)

Além do `insights.html` (zero-build, já em produção), existe uma segunda
versão de UI em [`web/`](web/) — Next.js 14 + TypeScript + Tailwind CSS +
Framer Motion, com o mesmo backend, focada 100% em gamificação/dopamina:
pódio com medalhas SVG, confete quando o #1 muda, aura de fogo pra perfis
"estourando", cards de conteúdo com Flip Effect (frente: métricas de
vaidade / verso: análise deep). Ver [`web/README.md`](web/README.md) pra
rodar (`cd web && npm install && npm run dev` — sobe com dados de
demonstração mesmo sem nenhuma credencial configurada).

**Pra publicar** (é um projeto Vercel separado do `public/` — frameworks
diferentes não dividem projeto):
1. Vercel → **Add New → Project** → importar o mesmo repositório de novo.
2. **Root Directory: `web`**, framework detectado automaticamente como
   Next.js.
3. Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://qkukcyrglfmlacwqvbay.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_rJkaMu3McCheeddi27vwPg_5CZQLsV4
   ```
4. Deploy. Fica num domínio `.vercel.app` próprio (dá pra apontar um
   domínio customizado depois, igual o site principal).

### Limitações da API do Meta

Documentadas em detalhe no `docs/PLATAFORMA_INSIGHTS.md` — a mais
relevante: a Graph API não expõe repost de terceiros no Story de outra
conta, e não atribui seguidor novo a uma Foto/Carrossel específico (só a
Reels, nativamente) — o app usa uma heurística marcada como estimativa
nesses casos.

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
