-- ════════════════════════════════════════════════════════════════
-- Pós-venda: protagonista que já fechou crédito com a Via Permuta e
-- virou cliente ativo (fora do funil de prospecção, mas linkado por
-- lead_id pra manter o histórico de como ele chegou até aqui).
-- ════════════════════════════════════════════════════════════════

create table if not exists clientes (
  id                    uuid primary key default gen_random_uuid(),
  lead_id               uuid references leads(id),
  empresa               text not null,
  decisor               text,
  telefone              text,
  email                 text,
  fase                  text default 'onboarding',
  ativo                 boolean default true,
  valor_mensal          numeric,
  data_inicio           date,
  data_fim              date,
  objetivo              text,
  obs                   text,
  foto_url              text,
  data_renovacao        date,
  proxima_cobranca      date,
  status_pagamento      text default 'em_dia',
  criado_em             timestamptz not null default now()
);
create index if not exists clientes_lead_idx on clientes (lead_id);
