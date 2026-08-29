-- ════════════════════════════════════════════════════════════════
-- Métricas agregadas do dia — funil de prospecção acompanhado em 3
-- canais em paralelo (ligação fria, WhatsApp, LinkedIn), cada um com
-- seu próprio funil: enviado → respondeu → decisor → reunião marcada
-- → reunião realizada → venda (aqui, "venda" = crédito concedido).
-- ════════════════════════════════════════════════════════════════

create table if not exists atividades (
  id                  uuid primary key default gen_random_uuid(),
  data                date not null,
  ligacoes            integer default 0,
  conexoes            integer default 0,
  decisores           integer default 0,
  reunioes_marcadas   integer default 0,
  reunioes_realizadas integer default 0,
  vendas              integer default 0,
  wpp_ligacoes            integer default 0,
  wpp_conexoes            integer default 0,
  wpp_decisores           integer default 0,
  wpp_reunioes_marcadas   integer default 0,
  wpp_reunioes_realizadas integer default 0,
  wpp_vendas              integer default 0,
  li_ligacoes            integer default 0,
  li_conexoes            integer default 0,
  li_decisores           integer default 0,
  li_reunioes_marcadas   integer default 0,
  li_reunioes_realizadas integer default 0,
  li_vendas              integer default 0,
  prosp_social  integer default 0,
  follow_social integer default 0,
  empresas      integer default 0,
  unique (data)
);

create table if not exists atividades_vendedor (
  id                  uuid primary key default gen_random_uuid(),
  data                date not null,
  responsavel_id      uuid not null,
  responsavel_nome    text,
  ligacoes            integer default 0,
  conexoes            integer default 0,
  decisores           integer default 0,
  reunioes_marcadas   integer default 0,
  reunioes_realizadas integer default 0,
  vendas              integer default 0,
  atualizado_em       timestamptz default now(),
  unique (data, responsavel_id)
);
create index if not exists atividades_vendedor_data_idx on atividades_vendedor (data);
