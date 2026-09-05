-- ════════════════════════════════════════════════════════════════
-- Agenda o ranking automático 2x por dia: 00h00 e 12h00 (horário de
-- Brasília, UTC-3) → 03:00 UTC e 15:00 UTC. Usa `pg_cron` (dispara no
-- horário) + `pg_net` (faz o POST HTTP pra Edge Function
-- `sync-meta-insights` de dentro do próprio Postgres, sem depender de
-- nenhum serviço externo — zero custo).
--
-- Projeto Supabase dedicado da Plataforma de Insights (separado do projeto
-- do CRM de vendas — inhpbwnrhflmvvdwplov, não pcvraalvtnmogirblvxq — de
-- propósito, pra nunca misturar dados de leads com dados de redes sociais).
--
-- O placeholder `<SYNC_SECRET>` abaixo NUNCA deve virar um valor real
-- neste arquivo (não commitar segredo em texto puro no git). Quem
-- substitui pelo valor de verdade é o próprio deploy automatizado
-- (`.github/workflows/deploy-supabase.yml`, secret `SYNC_SECRET` do
-- GitHub), rodando um UPDATE em `cron.job` logo depois desta migration —
-- é só um handshake interno entre o pg_cron e a Edge Function do mesmo
-- projeto, não protege dado nenhum sozinho (o endpoint também aceita
-- qualquer usuário autenticado do painel).
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'insights-ranking-00h-brt',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://inhpbwnrhflmvvdwplov.supabase.co/functions/v1/sync-meta-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SYNC_SECRET>'
    ),
    body := jsonb_build_object('tipo', 'auto_00h')
  );
  $$
);

select cron.schedule(
  'insights-ranking-12h-brt',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://inhpbwnrhflmvvdwplov.supabase.co/functions/v1/sync-meta-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SYNC_SECRET>'
    ),
    body := jsonb_build_object('tipo', 'auto_12h')
  );
  $$
);

-- pra reagendar/remover depois, sem precisar de outra migration:
--   select cron.unschedule('insights-ranking-00h-brt');
--   select cron.unschedule('insights-ranking-12h-brt');
