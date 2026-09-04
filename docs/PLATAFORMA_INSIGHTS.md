# Plataforma de Insights Via Permuta — memória do objetivo

> Este arquivo é a "caderneta" do objetivo pedido via `/goal`. Ele guarda o
> pedido original **na íntegra** (pra nunca perder nuance) e um checklist
> vivo de cobertura — toda vez que uma parte da plataforma avança, volte
> aqui, marque o que foi resolvido e confira o que ainda falta. Se algo
> deste texto ainda não tem uma linha correspondente no checklist, **ainda
> não foi considerado** — é o gatilho pra continuar.

## Pedido original (verbatim)

> Quero criar uma PLATAFORMA altamente inteligente e responsiva com sua
> análise dentro dela. Por ela eu e meu time (Social Sellings, Social
> Medias) terão acesso. Lá vou administrar e controlar todas as nossas
> contas Via Permuta (Via Permuta Master (Usada pra Remarketing
> atualmente, Via Permuta Franca, Araxá, Curitiba, Uberlândia 1, Uberaba,
> contas pessoais como do Julio Dario, Igor Beirigo, Anna Karoliny e o
> Podcast Ruptura Empreendedores). O objetivo dessa plataforma e puxarmos
> insigts fortes focados em plano de ação, com duas frentes: Performance
> no Orgânico/Performance no Tráfego Pago, pois dentro do Meta eu rodo
> criativos publicados lá. Precisaremos ter TODOs os INSIGHTS nativos do
> Meta, do Insta, mas também insights internos nossos, adaptados. Vou
> querer pra cada contra acesso a Número de vizualizações, curtidas,
> aviaozinhos (envios), compartilhamentos, reposts, retenção, analises
> bem deep, quantidade de seguidores que um reels, foto ou carrossel
> trouxe. Diferenciais, você com acesso ao meta sabe exatamente os que
> impulsiono e de quais perfis, você vai aproveitar esse acesso pra
> construirmos a plataforma, mas tambem vou te dar acesso as contas e aí
> busque meios de acessar os insigts, hoje existem sites que fazem isso,
> mas o nosso será interno e melhor. Busque todo recurso dentro e fora do
> seu alcance pra pormos isso de pé e rápido, custo zero. Quero um ranking
> que se atualiza 2x por dia, uma 12h00 e outra 00h00 automaticamente, mas
> eu posso atualizar manual também. Nele vai ter o destaque do melhor
> perfil (Vamos trabalhar os critérios, incluindo mais views, seguidores
> mas tambem o direct mais movimentado, tempo de resposta, etc...) - E
> tambem individualmente de cada perfil, o reels ou etc que trouxe/esta
> trazendo melhores resultados. Sempre lembrando que tem diferença entre
> orgÂnico/impulsionados/distribuidos no tráfego (é algo a se considerar).
> Precisa ser altamente GAMEFICADO/DOPAMINÉRGICO, responsividade extrema.

## Checklist de cobertura

### Contas a cadastrar (`contas_sociais`)
- [x] Via Permuta Master (remarketing)
- [x] Via Permuta Franca
- [x] Via Permuta Araxá
- [x] Via Permuta Curitiba
- [x] Via Permuta Uberlândia 1
- [x] Via Permuta Uberaba
- [x] Julio Dario (pessoal)
- [x] Igor Beirigo (pessoal)
- [x] Anna Karoliny (pessoal)
- [x] Podcast Ruptura Empreendedores
> Seed em `supabase/migrations/0008_insights_contas.sql` — falta só o
> `instagram_business_id` real e o token de cada uma (não temos acesso às
> contas de dentro deste ambiente; ver README seção "Plataforma de
> Insights").

### Acesso / equipe
- [x] Login único (reaproveita Supabase Auth já usado no CRM — Social
      Sellers e Social Medias entram com a mesma conta de equipe).
- [ ] Papéis diferenciados (Social Selling vê direct/resposta, Social
      Media vê conteúdo) — v1 dá acesso igual pra todo `authenticated`;
      diferenciação de papel fica como próxima iteração se o time pedir.

### Duas frentes: Orgânico x Tráfego Pago
- [x] Campo `origem` (`organico` | `impulsionado` | `distribuido`) em
      `publicacoes`.
- [x] Tabela `metricas_publicacao_paga` com métricas da Marketing API
      (spend, impressions pagas, cliques, CPM/CPC) separadas da orgânica.
- [x] Edge Function cruza mídia orgânica com anúncio ativo
      (`effective_object_story_id`) pra marcar automaticamente quando um
      post foi impulsionado e por qual perfil/conta de anúncio.
- [x] Ranking e drill-down por perfil mostram os dois lados lado a lado
      (toggle Orgânico/Pago/Combinado no dashboard).

### Insights nativos do Meta/Instagram exigidos
- [x] Visualizações (`plays`/`video_views`)
- [x] Curtidas (`likes`)
- [x] Aviõezinhos/envios (`shares` — no Graph API é o metric "shares",
      que corresponde ao ícone de enviar por DM)
- [x] Compartilhamentos/reposts — **limitação documentada**: a Graph API
      não expõe quem re-compartilhou um post no Story de outra conta
      (dado privado de terceiros). O que existe e capturamos: `shares`
      (envios via DM) e, quando disponível, `reshares` agregados que a
      API retornar. Ver nota em `sync-meta-insights/index.ts`.
- [x] Retenção (`ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`)
- [x] Seguidores ganhos por post (`follows` a nível de mídia, quando o
      tipo suporta; fallback: variação de `follower_count` da conta no
      dia vs. dia anterior, atribuída proporcionalmente ao post com mais
      alcance do dia — heurística documentada, não é 1:1 garantido pela
      Meta).
- [x] Alcance, impressões, saves, comentários, profile visits, cliques de
      link, taxa de engajamento — tudo em `metricas_publicacao` /
      `metricas_conta_diaria`.
- [ ] "Análises bem deep" contínuas — v1 cobre os campos acima; deep-dive
      adicional (funil de story completions, breakdown demográfico do
      público) fica no backlog em "Próximos passos" abaixo.

### Insights internos/adaptados
- [x] `metricas_manuais` — tempo médio de resposta no direct, mensagens
      pendentes, atendimentos no dia (a API do Meta não expõe métricas de
      DM de terceiros; time preenche isso na tela "Direct" do
      `insights.html`, e entra automaticamente no critério de ranking
      "Direct mais movimentado / tempo de resposta").
- [x] Critérios de ranking configuráveis em `criterios_ranking` (pesos
      editáveis pelo time — "vamos trabalhar os critérios" fica sempre
      ajustável, sem precisar mexer em código).

### Diferencial "você tem acesso ao Meta, aproveite"
- [x] Edge Function usa a Graph API + Marketing API diretamente (mesmo
      caminho que "sites que fazem isso" usam) — não depende de nenhuma
      ferramenta terceira paga.
- [x] Zero-custo: Supabase free tier (já em uso pelo CRM) + Vercel free +
      Meta Graph API (gratuita) + `pg_cron`/`pg_net` (extensões grátis do
      Postgres do Supabase) pro agendamento.

### Ranking automático 2x/dia + manual
- [x] `pg_cron` agendado pra `03:00 UTC` (00h00 BR) e `15:00 UTC` (12h00
      BR) chamando a Edge Function via `pg_net` — ver
      `0014_insights_cron.sql`.
- [x] Botão "Atualizar agora" no dashboard chama a mesma função
      (`tipo = 'manual'`), sem esperar o cron.
- [x] Toda execução fica registrada em `ranking_execucoes` (auto_12h /
      auto_00h / manual + quem disparou o manual).

### Destaque do melhor perfil + critérios
- [x] Card "Perfil do momento" com coroa/glow no `#1` do ranking.
- [x] Score combina: views, seguidores ganhos, curtidas, envios/shares,
      saves, retenção e responsividade de direct — pesos em
      `criterios_ranking`, normalizado por execução (0–100 por critério).

### Melhor conteúdo por perfil
- [x] `ranking_publicacoes` guarda o Top N post (reels/foto/carrossel)
      de cada conta a cada execução, com o motivo (métrica que mais
      pesou) pro drill-down individual.

### Gamificação / dopamina / responsividade extrema
- [x] Leaderboard com medalhas, glow dourado, contadores animados
      (count-up), barra de progresso por critério, badges/conquistas
      (`conquistas`, `conquistas_perfil`) e histórico de pontos
      (streak).
- [x] Layout mobile-first, mesma paleta/tipografia do CRM
      (`public/index.html`), transições rápidas, sem F5 (Realtime do
      Supabase nas tabelas de ranking).

## Limitações conhecidas da API (não são bugs, são a Meta)
1. Repost de terceiros no Story não é rastreável via API (dado privado).
2. Atribuição de novo seguidor a um post específico não é 1:1 garantida
   pela Meta fora do metric `follows` de Reels — pra Foto/Carrossel é
   heurística (ver acima).
3. `instagram_manage_insights` em conta de Business Manager de terceiro
   normalmente pede App Review da Meta **se** o app for usado por fora da
   própria empresa dona das contas — como é uso interno (System User do
   próprio Business Manager da Via Permuta), dá pra operar sem App Review
   completo; documentado passo a passo no README.

## Próximos passos (backlog, fora do v1)
- Papéis diferenciados por função (Social Selling vs. Social Media).
- Fluxo de OAuth "Conectar Instagram" com botão (v1 usa token de sistema
  colado direto na tabela via SQL Editor — mais rápido de pôr em pé,
  zero App Review).
- Breakdown demográfico de audiência por perfil.
- Alertas automáticos (WhatsApp/e-mail) quando um post "explode".
