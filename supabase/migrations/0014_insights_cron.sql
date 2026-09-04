-- ════════════════════════════════════════════════════════════════
-- Agenda o ranking automático 2x por dia: 00h00 e 12h00 (horário de
-- Brasília, UTC-3) → 03:00 UTC e 15:00 UTC. Usa `pg_cron` (dispara no
-- horário) + `pg_net` (faz o POST HTTP pra Edge Function
-- `sync-meta-insights` de dentro do próprio Postgres, sem depender de
-- nenhum serviço externo — zero custo).
--
-- ⚠️ PLACEHOLDER — troque antes de rodar esta migration:
--   <SYNC_SECRET>  → um segredo qualquer que você escolher, e que
--                    também precisa ser setado na Edge Function via
--                    `npx supabase secrets set SYNC_SECRET=...`
--                    (ver README → "Plataforma de Insights").
--   A URL já usa o project ref real do projeto (pcvraalvtnmogirblvxq,
--   o mesmo que aparece em public/index.html) — só troque se algum dia
--   migrar de projeto Supabase.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'insights-ranking-00h-brt',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://pcvraalvtnmogirblvxq.supabase.co/functions/v1/sync-meta-insights',
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
    url := 'https://pcvraalvtnmogirblvxq.supabase.co/functions/v1/sync-meta-insights',
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
