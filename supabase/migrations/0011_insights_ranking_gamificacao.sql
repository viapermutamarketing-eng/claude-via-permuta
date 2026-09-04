-- ════════════════════════════════════════════════════════════════
-- Plataforma de Insights — critérios de ranking (pesos editáveis pelo
-- time, sem mexer em código), execuções do ranking (cron 2x/dia +
-- manual) e gamificação (conquistas/pontos, pro dashboard "dopaminérgico").
-- ════════════════════════════════════════════════════════════════

create table if not exists criterios_ranking (
  id            uuid primary key default gen_random_uuid(),
  chave         text not null unique,   -- 'views' | 'seguidores' | 'curtidas' | 'envios' | 'salvamentos' | 'retencao' | 'direct'
  nome          text not null,          -- rótulo exibido no dashboard
  peso          numeric not null default 10, -- 0–100, times somam e são normalizados na Edge Function
  direcao       text not null default 'maior_melhor', -- 'maior_melhor' | 'menor_melhor' (ex: tempo de resposta)
  ativo         boolean not null default true,
  atualizado_em timestamptz not null default now()
);

insert into criterios_ranking (chave, nome, peso, direcao) values
  ('views',        'Visualizações',              25, 'maior_melhor'),
  ('seguidores',   'Seguidores ganhos',           20, 'maior_melhor'),
  ('curtidas',     'Curtidas',                    10, 'maior_melhor'),
  ('envios',       'Envios (aviãozinho)',         10, 'maior_melhor'),
  ('salvamentos',  'Salvamentos',                 10, 'maior_melhor'),
  ('retencao',     'Retenção média',              10, 'maior_melhor'),
  ('direct',       'Direct: tempo de resposta',   15, 'menor_melhor')
on conflict (chave) do nothing;

create table if not exists ranking_execucoes (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null default 'manual', -- auto_00h | auto_12h | manual
  janela_inicio   timestamptz,                     -- início do período comparado (ranking é "desde a última execução")
  janela_fim      timestamptz not null default now(),
  executado_por   uuid,
  executado_por_nome text,
  status          text not null default 'concluido', -- em_andamento | concluido | erro
  erro_detalhe    text,
  criado_em       timestamptz not null default now()
);
create index if not exists ranking_execucoes_criado_em_idx on ranking_execucoes (criado_em desc);

create table if not exists ranking_perfis (
  id                  uuid primary key default gen_random_uuid(),
  execucao_id         uuid not null references ranking_execucoes(id) on delete cascade,
  conta_id            uuid not null references contas_sociais(id) on delete cascade,
  posicao             integer not null,
  pontuacao_total     numeric not null default 0,
  destaque            boolean not null default false, -- true só pro #1 da execução
  detalhamento        jsonb not null default '{}'::jsonb, -- {chave_criterio: {valor, valor_normalizado, contribuicao}}
  criado_em           timestamptz not null default now()
);
create index if not exists ranking_perfis_execucao_idx on ranking_perfis (execucao_id, posicao);
create index if not exists ranking_perfis_conta_idx on ranking_perfis (conta_id, criado_em desc);

create table if not exists ranking_publicacoes (
  id              uuid primary key default gen_random_uuid(),
  execucao_id     uuid not null references ranking_execucoes(id) on delete cascade,
  conta_id        uuid not null references contas_sociais(id) on delete cascade,
  publicacao_id   uuid not null references publicacoes(id) on delete cascade,
  posicao         integer not null default 1, -- 1 = melhor conteúdo do perfil nessa execução
  pontuacao       numeric not null default 0,
  motivo_destaque text,                        -- ex: "Maior nº de views" / "Trouxe mais seguidores"
  criado_em       timestamptz not null default now()
);
create index if not exists ranking_publicacoes_execucao_idx
  on ranking_publicacoes (execucao_id, conta_id, posicao);

-- gamificação
create table if not exists conquistas (
  id            uuid primary key default gen_random_uuid(),
  chave         text not null unique,   -- 'top1_semana' | 'reels_1m_views' | 'resposta_relampago' ...
  nome          text not null,
  descricao     text,
  icone         text,                   -- emoji ou nome de ícone
  criado_em     timestamptz not null default now()
);

insert into conquistas (chave, nome, descricao, icone) values
  ('top1_ranking',      'Perfil do momento',        'Ficou em 1º lugar numa execução do ranking',              '👑'),
  ('sequencia_3',       'Em chamas',                'Ficou entre os 3 primeiros em 3 execuções seguidas',      '🔥'),
  ('reels_100k',        'Viral',                    'Um Reels passou de 100 mil visualizações',                '🚀'),
  ('resposta_relampago','Resposta relâmpago',       'Tempo médio de resposta no direct abaixo de 5 minutos',   '⚡'),
  ('crescimento_100',   'Bola de neve',              'Ganhou mais de 100 seguidores em uma janela de ranking',  '📈')
on conflict (chave) do nothing;

create table if not exists conquistas_perfil (
  id            uuid primary key default gen_random_uuid(),
  conta_id      uuid not null references contas_sociais(id) on delete cascade,
  conquista_id  uuid not null references conquistas(id) on delete cascade,
  execucao_id   uuid references ranking_execucoes(id) on delete set null,
  conquistado_em timestamptz not null default now()
);
create index if not exists conquistas_perfil_conta_idx on conquistas_perfil (conta_id, conquistado_em desc);

create table if not exists pontos_historico (
  id            uuid primary key default gen_random_uuid(),
  conta_id      uuid not null references contas_sociais(id) on delete cascade,
  execucao_id   uuid not null references ranking_execucoes(id) on delete cascade,
  pontos        numeric not null default 0,
  posicao       integer,
  criado_em     timestamptz not null default now()
);
create index if not exists pontos_historico_conta_idx on pontos_historico (conta_id, criado_em desc);
