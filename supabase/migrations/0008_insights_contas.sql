-- ════════════════════════════════════════════════════════════════
-- Plataforma de Insights — contas sociais monitoradas (Instagram/Meta)
-- e os tokens de acesso de cada uma. `contas_tokens` fica SEM policy
-- pra `authenticated` de propósito (só a Edge Function, com a
-- service_role key, lê o token — ninguém do time vê o token pelo
-- painel, só o resultado dos insights).
-- ════════════════════════════════════════════════════════════════

create table if not exists contas_sociais (
  id                      uuid primary key default gen_random_uuid(),
  nome                    text not null,               -- "Via Permuta Master", "Julio Dario"...
  tipo                    text not null default 'empresa', -- empresa | pessoal | podcast
  username_instagram      text,                         -- @handle, só exibição
  instagram_business_id   text,                         -- IG User ID (Graph API) — preencher depois de conectar
  facebook_page_id        text,                         -- Page vinculada (necessária pra Graph API do IG Business)
  ad_account_id           text,                         -- act_XXXXXXXXX, pra cruzar com tráfego pago (pode ser nulo)
  cor_destaque            text,                         -- cor pro card no dashboard (hex), opcional
  ativo                   boolean not null default true,
  ordem                   integer,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

create unique index if not exists contas_sociais_ig_id_idx
  on contas_sociais (instagram_business_id) where instagram_business_id is not null;

-- seed: as contas já mapeadas no pedido original (docs/PLATAFORMA_INSIGHTS.md).
-- instagram_business_id/facebook_page_id ficam nulos até o token ser conectado
-- (ver README → "Plataforma de Insights → conectar uma conta").
insert into contas_sociais (nome, tipo, ordem) values
  ('Via Permuta Master',            'empresa', 1),
  ('Via Permuta Franca',            'empresa', 2),
  ('Via Permuta Araxá',             'empresa', 3),
  ('Via Permuta Curitiba',          'empresa', 4),
  ('Via Permuta Uberlândia 1',      'empresa', 5),
  ('Via Permuta Uberaba',           'empresa', 6),
  ('Julio Dario',                   'pessoal', 7),
  ('Igor Beirigo',                  'pessoal', 8),
  ('Anna Karoliny',                 'pessoal', 9),
  ('Podcast Ruptura Empreendedores','podcast', 10)
on conflict do nothing;

-- tokens de acesso — nunca exposto a `authenticated`, só service_role
-- (Edge Function). Um token de sistema (System User do Business Manager)
-- por conta, de longa duração (60 dias, renovar antes de expirar).
create table if not exists contas_tokens (
  conta_id                uuid primary key references contas_sociais(id) on delete cascade,
  access_token            text not null,
  token_expira_em         timestamptz,
  escopos                 text,                         -- ex: 'instagram_basic,instagram_manage_insights,pages_read_engagement,ads_read'
  atualizado_em           timestamptz not null default now()
);
