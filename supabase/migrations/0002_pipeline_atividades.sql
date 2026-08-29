-- ════════════════════════════════════════════════════════════════
-- Pipeline customizado, atividades por lead, timeline e anotações.
--
-- pipeline_etapas: os funis padrão (STAGES/STAGES_EXTRA) vivem no
-- código do painel (public/index.html) — esta tabela é só pra
-- pipelines CUSTOMIZADOS que o usuário criar por cima deles.
-- ════════════════════════════════════════════════════════════════

create table if not exists pipeline_etapas (
  id         text primary key,
  pipeline_id text not null,
  nome       text not null,
  ordem      integer not null,
  criado_em  timestamptz not null default now()
);
create index if not exists pipeline_etapas_pipeline_idx on pipeline_etapas (pipeline_id, ordem);

-- follow-ups / tarefas pendentes por lead
create table if not exists atividades_crm (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid references leads(id) on delete cascade,
  tipo             text default 'follow_up',
  canal            text,
  data_prev        date not null,
  hora_prev        time,
  obs              text,
  status           text default 'pendente',        -- pendente | concluida
  auto             boolean default false,           -- gerada automaticamente (ex: ao marcar Reunião Agendada)
  prioridade       boolean default false,
  responsavel_id   uuid,
  responsavel_nome text,
  criado_em        timestamptz not null default now()
);
create index if not exists atividades_crm_lead_idx on atividades_crm (lead_id);
create index if not exists atividades_crm_data_idx on atividades_crm (data_prev, status);

-- timeline do lead: todo movimento relevante de estágio
create table if not exists historico_lead (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid references leads(id) on delete cascade,
  estagio_anterior text,
  estagio_novo     text not null,
  obs              text,
  tipo             text default 'estagio',
  autor_nome       text,
  criado_em        timestamptz not null default now()
);
create index if not exists historico_lead_lead_idx on historico_lead (lead_id, criado_em desc);

-- notas/ligações registradas no lead
create table if not exists anotacoes (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references leads(id) on delete cascade,
  tipo         text default 'geral',
  texto        text not null,
  duracao_seg  integer,
  autor_id     uuid,
  autor_nome   text,
  criado_em    timestamptz not null default now()
);
create index if not exists anotacoes_lead_idx on anotacoes (lead_id, criado_em desc);
