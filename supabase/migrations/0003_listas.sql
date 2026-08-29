-- ════════════════════════════════════════════════════════════════
-- Importação de listas de prospecção (planilha/CSV) — feita antes
-- de virar lead de verdade, com mapeamento inteligente de colunas
-- (COL_ALIASES no painel: "telefone"/"whatsapp"/"celular"/"fone"
-- todas caem no mesmo campo).
-- ════════════════════════════════════════════════════════════════

create table if not exists listas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  descricao    text,
  data_inicio  date,
  total_leads  integer default 0,
  criado_em    timestamptz not null default now()
);

create table if not exists leads_lista (
  id           uuid primary key default gen_random_uuid(),
  lista_id     uuid references listas(id) on delete cascade,
  empresa      text,
  decisor      text,
  cargo        text,
  telefone     text,
  segmento     text,
  cidade       text,
  email        text,
  site         text,
  status       text default 'pendente',   -- pendente | contatado | convertido | descartado
  lead_id      uuid references leads(id), -- linkado quando vira lead de verdade
  dados_extras jsonb,
  obs          text,
  criado_em    timestamptz not null default now()
);
create index if not exists leads_lista_lista_idx on leads_lista (lista_id, status);
