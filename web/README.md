# Insights Dashboard (Next.js) — Via Permuta

Camada visual "premium" da Plataforma de Insights: Next.js 14 (App Router) +
TypeScript + Tailwind CSS + Framer Motion. Convive com o painel estático em
`../public/insights.html` (mesmo backend, mesmo Supabase) — este aqui é a
versão gamificada/dopaminérgica pedida especificamente com esse stack;
o `insights.html` continua funcionando como versão zero-build já em produção.

Ver o pedido original e o restante da arquitetura (banco, Edge Function,
Meta Graph API) em [`../docs/PLATAFORMA_INSIGHTS.md`](../docs/PLATAFORMA_INSIGHTS.md).

## Rodar localmente

```bash
cd web
npm install
npm run dev
```

Sem nenhuma variável de ambiente configurada, o dashboard sobe sozinho em
**modo demonstração** (`lib/mock-data.ts`) — dá pra ver o Hero, o Leaderboard
gamificado (pódio + confete quando o #1 muda) e os Cards de Análise com
Flip Effect funcionando de ponta a ponta, sem precisar de nenhuma conta
real conectada.

## Ligar nos dados reais

1. `npm run build` já valida tudo antes de publicar.
2. Configure (Vercel → Project Settings → Environment Variables, ou
   `.env.local` localmente):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://pcvraalvtnmogirblvxq.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<a mesma anon/publishable key de public/index.html>
   ```
3. As migrations/Edge Function em `../supabase` já fazem todo o trabalho de
   ETL (ver `../supabase/functions/sync-meta-insights`) — este app só lê as
   tabelas (`ranking_perfis`, `ranking_publicacoes`, `conquistas_perfil`
   etc.), sempre via RLS `authenticated` (mesma regra do CRM).
4. **Autenticação**: `lib/data.ts` só troca o mock pelos dados reais quando
   existe uma sessão Supabase Auth ativa no navegador (a mesma conta de
   equipe do CRM). Este pacote entrega o *layout* pedido (Hero, Leaderboard,
   Cards); a tela de login pode reaproveitar o mesmo componente de
   `public/index.html`/`public/insights.html` — é o próximo passo antes de
   ir pra produção com dados reais.

## Estrutura

```
app/
  layout.tsx        fontes (Fraunces/Nunito/JetBrains Mono) + shell
  page.tsx           Server Component: busca os dados e renderiza o Dashboard
  globals.css        Tailwind + utilitários do flip card
components/
  Hero.tsx           placar geral + botão "Atualizar agora" (tátil, com estados)
  Leaderboard.tsx     orquestra pódio + linhas, dispara confete na troca de #1
  PodiumCard.tsx      top 3 — medalha SVG, aura de temperatura, contador animado
  LeaderboardRow.tsx  4º em diante — estilo placar de partida (Valorant/LoL)
  AnalysisCard.tsx    flip card: frente (vaidade) / verso (deep — retenção, pago x orgânico)
  Badge.tsx           conquistas (Mestre do Direct, Rei da Retenção, Tráfego Sniper…)
  TemperatureAura.tsx sistema quente/frio (aura de fogo) reutilizado em cards e posts
lib/
  types.ts            espelha o schema do Supabase (../supabase/migrations)
  data.ts             camada única de leitura — real via Supabase, senão mock
  mock-data.ts        dados de demonstração das 10 contas Via Permuta
  temperature.ts      cálculo do status quente/frio
  useConfetti.ts       confete dourado (canvas-confetti) só quando o #1 muda
  useCountUp.ts        contador animado reutilizável
```

## Por que "útil" não é a mesma coisa que "viciante"

Um painel *útil* mostra o número. Este dashboard foi desenhado pra fazer o
time **querer voltar**:
- o número nunca aparece pronto — ele **conta** até o valor (`useCountUp`),
  porque a subida é mais recompensadora que o resultado estático;
- reordenação do ranking anima (Framer Motion `layout`) em vez de só
  "trocar de lugar" — o cérebro registra o movimento, não só o estado final;
- confete é **raro de propósito** (só na troca real de #1) — reforço
  intermitente é o que vicia, reforço constante vira ruído e perde efeito;
- a aura de fogo não é decoração: ela transforma "views" (número frio) em
  "impulso" (sensação de urgência — "isso está acontecendo AGORA");
- o flip card esconde a análise séria atrás de um gesto de jogo (virar a
  carta), não atrás de um menu — curiosidade puxa mais que um link "ver
  detalhes".
