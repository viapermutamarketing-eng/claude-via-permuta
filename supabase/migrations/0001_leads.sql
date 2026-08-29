-- ════════════════════════════════════════════════════════════════
-- CRM Via Permuta — tabela central `leads`
--
-- Junta, num único CREATE (o projeto começa do zero, não precisa das
-- ALTERs incrementais que o histórico da Nettu's tem), os campos
-- "genéricos" de qualquer CRM de prospecção B2B/B2C com os campos
-- específicos do funil de crédito-por-permuta da Via Permuta e os
-- campos alimentados pelo formulário público `diagnostico.html`
-- (via Edge Function `diagnostico-lead`, ver supabase/functions).
--
-- decisor/empresa/estagio/etc: vocabulário padrão de CRM de
-- prospecção (funciona pra qualquer negócio B2B).
-- faturamento_medio/tempo_negocio/objetivo_credito/valor_credito_
-- desejado/ja_pegou_credito: específicos da qualificação de crédito
-- da Via Permuta (troca o "gargalo/funcionarios" que a Nettu's usa
-- pro diagnóstico dela).
-- diagnostico_*: suporte ao upsert progressivo por sessão (ver
-- Edge Function) — nunca perdem uma resposta parcial de quem
-- abandonou o formulário no meio.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists leads (
  id                     uuid primary key default gen_random_uuid(),

  -- identificação do lead / do negócio dele
  empresa                text not null,            -- nome do negócio/empresa do protagonista
  decisor                text,                      -- nome de quem decide (o próprio empreendedor, na maioria dos casos)
  cargo                  text,
  telefone               text,
  email                  text,
  cidade                 text,
  cnpj                   varchar(20),
  socios                 text,
  site_url               text,
  instagram_linkedin     text,
  segmento               text,                      -- ramo do negócio (comércio, serviço, alimentação, estética...)

  -- qualificação de crédito-por-permuta (o "diagnóstico" da Via Permuta)
  faturamento_medio      text,
  tempo_negocio          text,                       -- há quanto tempo o negócio existe
  ja_pegou_credito       text,                       -- já pegou crédito bancário tradicional antes?
  objetivo_credito       text,                       -- pra que quer o crédito / principal dor hoje
  valor_credito_desejado text,
  urgencia               text,

  -- funil de prospecção
  canal                  text,                       -- origem do lead (Diagnóstico Site, Indicação, Instagram, Evento...)
  tipo_lead              text default 'inbound',     -- inbound | outbound
  estagio                text not null default 'potencial',
  estagio_desde          date default current_date,
  valor_potencial        numeric default 0,          -- valor de crédito estimado da oportunidade
  valor_contrato         numeric,                     -- valor de crédito efetivamente concedido, quando fecha
  proximo_follow         date,
  canal_follow           text,
  status_tentativa       text default 'A contatar',
  data_reuniao_marcada   timestamptz,
  feedback_reuniao       text,
  data_reuniao_realizada date,
  motivo_perda           text,
  obs                    text,
  closer                 text,
  responsavel_id         uuid,
  responsavel_nome       text,
  participantes          jsonb not null default '[]'::jsonb,
  ordem                  integer,

  -- LGPD
  lgpd_consentimento     boolean default false,
  lgpd_data              date,

  -- alimentado pelo formulário público (diagnostico.html + Edge Function diagnostico-lead)
  diagnostico_completo   boolean default false,
  diagnostico_etapa      integer,
  diagnostico_session_id text,
  diagnostico_historico  jsonb default '[]'::jsonb,
  notificado_em          timestamptz,
  confirmacao_enviada_em timestamptz,

  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

-- upsert progressivo: cada "rascunho" de visita ao formulário vira UM
-- único lead, mesmo com chamadas simultâneas da Edge Function
create unique index if not exists leads_diagnostico_session_id_idx
  on leads (diagnostico_session_id) where diagnostico_session_id is not null;

-- dedup por telefone e busca geral do pipeline
create index if not exists leads_telefone_idx on leads (telefone);
create index if not exists leads_estagio_idx on leads (estagio);
create index if not exists leads_responsavel_idx on leads (responsavel_id);
create index if not exists leads_criado_em_idx on leads (criado_em desc);
