-- ════════════════════════════════════════════════════════════════
-- Plataforma de Insights — métricas diárias de conta (nativas) e
-- métricas manuais (o que o Meta não expõe: responsividade de direct).
-- ════════════════════════════════════════════════════════════════

create table if not exists metricas_conta_diaria (
  id                    uuid primary key default gen_random_uuid(),
  conta_id              uuid not null references contas_sociais(id) on delete cascade,
  data_referencia       date not null default current_date,

  seguidores_total      bigint,
  seguidores_ganho_dia  bigint default 0,
  alcance_contas        bigint default 0,   -- reach a nível de conta
  impressoes            bigint default 0,
  visitas_perfil        bigint default 0,
  cliques_link_bio      bigint default 0,
  capturado_em          timestamptz not null default now(),
  criado_em             timestamptz not null default now()
);
create unique index if not exists metricas_conta_diaria_conta_data_idx
  on metricas_conta_diaria (conta_id, data_referencia);

-- direct/DM: a Graph API não expõe métricas de conversas de terceiros,
-- então o time preenche isso na tela "Direct" do insights.html (leva
-- uns segundos, e entra direto no critério de ranking "direct mais
-- movimentado / tempo de resposta").
create table if not exists metricas_manuais (
  id                      uuid primary key default gen_random_uuid(),
  conta_id                uuid not null references contas_sociais(id) on delete cascade,
  data_referencia         date not null default current_date,

  mensagens_recebidas_dia integer default 0,
  mensagens_pendentes     integer default 0,
  tempo_resposta_medio_min numeric,          -- em minutos, menor é melhor
  atendimentos_concluidos integer default 0,
  observacoes             text,

  registrado_por          uuid,             -- auth.uid() de quem preencheu
  registrado_por_nome     text,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
create unique index if not exists metricas_manuais_conta_data_idx
  on metricas_manuais (conta_id, data_referencia);
