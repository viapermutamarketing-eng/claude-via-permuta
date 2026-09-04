-- ════════════════════════════════════════════════════════════════
-- Plataforma de Insights — publicações (reels/foto/carrossel/story) e
-- as métricas orgânicas + pagas de cada uma. Métrica é snapshot: toda
-- sincronização (cron 2x/dia ou manual) grava uma linha nova em
-- `metricas_publicacao`/`metricas_publicacao_paga` — assim dá pra ver a
-- curva de performance do post ao longo do tempo, não só o valor atual.
-- ════════════════════════════════════════════════════════════════

create table if not exists publicacoes (
  id                uuid primary key default gen_random_uuid(),
  conta_id          uuid not null references contas_sociais(id) on delete cascade,
  media_id          text not null,                 -- ID da mídia no Graph API
  tipo              text not null,                 -- reels | imagem | carrossel | story
  permalink         text,
  thumbnail_url     text,
  legenda           text,
  publicado_em      timestamptz,
  origem            text not null default 'organico', -- organico | impulsionado | distribuido
  campanha_nome     text,                           -- nome do anúncio/campanha, quando impulsionado
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create unique index if not exists publicacoes_conta_media_idx
  on publicacoes (conta_id, media_id);
create index if not exists publicacoes_publicado_em_idx
  on publicacoes (publicado_em desc);
create index if not exists publicacoes_origem_idx on publicacoes (origem);

-- snapshot de métricas orgânicas (nativas do Meta/Insta) por publicação
create table if not exists metricas_publicacao (
  id                    uuid primary key default gen_random_uuid(),
  publicacao_id         uuid not null references publicacoes(id) on delete cascade,
  capturado_em          timestamptz not null default now(),

  visualizacoes         bigint default 0,   -- plays / video_views
  alcance               bigint default 0,   -- reach
  impressoes            bigint default 0,
  curtidas              bigint default 0,   -- likes
  comentarios           bigint default 0,
  salvamentos           bigint default 0,   -- saved
  envios                bigint default 0,   -- shares (aviãozinho / enviar por DM)
  compartilhamentos     bigint default 0,   -- reshares agregados quando a API expõe (ver limitação no README)
  interacoes_totais     bigint default 0,   -- total_interactions
  visitas_perfil        bigint default 0,   -- profile_visits atribuídas ao post, quando disponível
  seguidores_ganhos     bigint default 0,   -- follows (nativo em Reels) ou heurística (ver Edge Function)
  seguidores_estimado   boolean default false, -- true quando seguidores_ganhos veio da heurística, não do metric nativo
  retencao_media_seg    numeric,            -- ig_reels_avg_watch_time
  tempo_total_visto_seg numeric,            -- ig_reels_video_view_total_time
  taxa_engajamento      numeric,            -- interacoes_totais / alcance, calculado na Edge Function

  criado_em             timestamptz not null default now()
);
create index if not exists metricas_publicacao_pub_idx on metricas_publicacao (publicacao_id, capturado_em desc);

-- snapshot de métricas pagas (Marketing API) quando a publicação está
-- (ou esteve) impulsionada — mantido separado do orgânico de propósito,
-- pra sempre dar pra comparar as "duas frentes" lado a lado.
create table if not exists metricas_publicacao_paga (
  id                uuid primary key default gen_random_uuid(),
  publicacao_id     uuid not null references publicacoes(id) on delete cascade,
  ad_id             text,
  capturado_em      timestamptz not null default now(),

  gasto             numeric default 0,     -- spend
  impressoes        bigint default 0,
  alcance           bigint default 0,
  cliques_link      bigint default 0,
  cpm               numeric,
  cpc               numeric,
  resultados        bigint default 0,      -- actions relevantes ao objetivo da campanha
  custo_por_resultado numeric,

  criado_em         timestamptz not null default now()
);
create index if not exists metricas_publicacao_paga_pub_idx
  on metricas_publicacao_paga (publicacao_id, capturado_em desc);
