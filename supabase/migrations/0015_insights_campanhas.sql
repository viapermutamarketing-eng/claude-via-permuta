-- ════════════════════════════════════════════════════════════════
-- Plataforma de Insights — camada de CAMPANHA (Marketing API).
--
-- As tabelas de `0009`/`0010` olham post orgânico e anúncio por
-- publicação. Isso responde "qual post performou", mas não responde
-- "pra onde vai meu orçamento e qual campanha escala" — que é decisão
-- de mídia, tomada no nível da campanha.
--
-- Duas granularidades, de propósito:
--
--   `metricas_campanha_diaria`  — um registro por campanha por dia
--      (insights com time_increment=1). Serve pra tendência.
--
--   `metricas_campanha_janela`  — um registro por campanha por janela
--      (7d, 30d), pedido AGREGADO pra API. É a fonte autoritativa de
--      alcance e frequência: `reach` desduplica pessoas dentro da
--      janela, então somar o alcance de 7 dias diários dá um número
--      maior que o alcance real de 7 dias — e frequência calculada
--      sobre essa soma sai SUBESTIMADA. Como é exatamente a frequência
--      que decide se o remarketing está saturado, ela tem que vir da
--      janela agregada, nunca de soma de dias.
--
-- O veredito por campanha fica em `v_diagnostico_campanha` (SQL, não
-- no front) pra ter uma única definição de "escalar / corrigir /
-- cortar", compartilhada pelo painel e por qualquer outro consumidor.
-- ════════════════════════════════════════════════════════════════

-- ── metas: o que o negócio aceita pagar. Linha única (id fixo). ──
create table if not exists metas_campanha (
  id                      boolean primary key default true,
  meta_cpl                numeric not null default 30,     -- R$ por lead novo
  meta_custo_seguidor     numeric not null default 2,       -- R$ por seguidor
  limite_frequencia       numeric not null default 3.5,     -- frequência 7d máxima aceitável
  eventos_aprendizado     integer not null default 50,      -- eventos/conjunto/semana (regra da Meta)
  atualizado_em           timestamptz not null default now(),
  constraint metas_campanha_linha_unica check (id)
);
insert into metas_campanha (id) values (true) on conflict (id) do nothing;

-- ── campanhas espelhadas da Marketing API ──
create table if not exists campanhas (
  id                      uuid primary key default gen_random_uuid(),
  conta_id                uuid not null references contas_sociais(id) on delete cascade,
  campaign_id             text not null,                   -- id na Meta
  nome                    text not null,
  objetivo                text,                            -- OUTCOME_LEADS, OUTCOME_AWARENESS, ...
  status                  text,                            -- ACTIVE | PAUSED | ...
  effective_status        text,

  -- orçamento em reais/dia. Em CBO vem da campanha; em ABO a campanha
  -- não tem orçamento e o valor é a soma dos conjuntos ativos.
  orcamento_diario        numeric,
  orcamento_origem        text,                            -- 'campanha' | 'conjuntos' | null
  orcamento_vitalicio     numeric,

  conjuntos_ativos        integer not null default 0,
  objetivos_otimizacao    text,                            -- optimization_goal dos conjuntos, separado por vírgula

  -- função no funil: derivada do objetivo + nome, sobreponível à mão
  -- (`funcao_manual` ganha sempre, pra quando a nomenclatura mentir).
  funcao                  text not null default 'outro',   -- prospeccao | remarketing | alcance | outro
  funcao_manual           text,

  sincronizado_em         timestamptz,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
create unique index if not exists campanhas_campaign_id_idx on campanhas (campaign_id);
create index if not exists campanhas_conta_idx on campanhas (conta_id);

-- ── série diária (tendência) ──
create table if not exists metricas_campanha_diaria (
  id                      uuid primary key default gen_random_uuid(),
  campanha_id             uuid not null references campanhas(id) on delete cascade,
  data_referencia         date not null,

  gasto                   numeric not null default 0,
  impressoes              bigint  not null default 0,
  alcance                 bigint  not null default 0,       -- alcance DO DIA, não somável entre dias
  cliques_link            bigint  not null default 0,
  cpm                     numeric,
  cpc                     numeric,
  ctr_link                numeric,                          -- inline_link_click_ctr, em %
  resultados              bigint  not null default 0,
  custo_por_resultado     numeric,
  acao_resultado          text,                             -- action_type que contou como resultado
  capturado_em            timestamptz not null default now()
);
create unique index if not exists metricas_campanha_diaria_idx
  on metricas_campanha_diaria (campanha_id, data_referencia);

-- ── janela agregada (autoritativa pra alcance/frequência) ──
create table if not exists metricas_campanha_janela (
  id                      uuid primary key default gen_random_uuid(),
  campanha_id             uuid not null references campanhas(id) on delete cascade,
  janela_dias             integer not null,                 -- 7 | 30
  inicio                  date,
  fim                     date,

  gasto                   numeric not null default 0,
  impressoes              bigint  not null default 0,
  alcance                 bigint  not null default 0,        -- desduplicado na janela
  frequencia              numeric,                           -- vem da API, não calculado por soma
  cliques_link            bigint  not null default 0,
  cpm                     numeric,
  cpc                     numeric,
  ctr_link                numeric,
  resultados              bigint  not null default 0,
  custo_por_resultado     numeric,
  acao_resultado          text,
  capturado_em            timestamptz not null default now()
);
create unique index if not exists metricas_campanha_janela_idx
  on metricas_campanha_janela (campanha_id, janela_dias);

-- ════════════════════════════════════════════════════════════════
-- v_diagnostico_campanha — uma definição só de veredito, em camadas:
-- `base` junta campanha + janela de 7d, `calc` deriva as contas, e o
-- select final só escolhe o veredito. Separado assim porque a meta
-- aplicada e o mínimo de aprendizado entram em várias comparações, e
-- repetir a expressão em cada `when` foi onde a primeira versão errou.
--
-- Ordem de avaliação (o primeiro que bate decide, mais grave primeiro):
--
--   1. objetivo de alcance → o leilão não persegue o resultado que a
--      campanha diz buscar; custo por seguidor ali é divisão
--      aritmética, não otimização. Trocar objetivo.
--   2. verba fragmentada → só vale quando há mais de um conjunto E o
--      teto sustentável é menor que o nº de conjuntos ativos. Com um
--      conjunto só não existe o que cortar: nesse caso o problema é o
--      custo ou o orçamento, tratado em (6), (7) e (8).
--   3. frequência acima do limite → ampliar público.
--   4. gasto sem resultado → evento de conversão provavelmente quebrado.
--   5. custo > 150% da meta → pausar e refazer (criativo e público novos).
--   6. custo > meta → corrigir criativo.
--   7. orçamento abaixo do mínimo de aprendizado → subir orçamento até
--      o mínimo. O custo já está dentro da meta aqui, então a trava é
--      de volume, não de eficiência.
--   8. custo ≤ 80% da meta → escalar.
--   9. resto → manter.
-- ════════════════════════════════════════════════════════════════
-- `drop` antes de criar: `create or replace view` não aceita mudança
-- de nome ou ordem de coluna, então sem isso qualquer evolução da
-- view falha ao reaplicar a migração.
drop view if exists v_diagnostico_campanha;
create view v_diagnostico_campanha
with (security_invoker = true) as
with base as (
  select
    c.id as campanha_id, c.conta_id, c.campaign_id, c.nome, c.objetivo,
    c.effective_status, c.orcamento_diario, c.orcamento_origem,
    c.conjuntos_ativos,
    coalesce(c.funcao_manual, c.funcao) as funcao,
    j.janela_dias, j.gasto, j.impressoes, j.alcance, j.frequencia,
    j.cpm, j.ctr_link, j.resultados, j.custo_por_resultado, j.acao_resultado,
    m.meta_cpl, m.meta_custo_seguidor, m.limite_frequencia, m.eventos_aprendizado
  from campanhas c
  cross join (select * from metas_campanha where id) m
  left join metricas_campanha_janela j
    on j.campanha_id = c.id and j.janela_dias = 7
),
calc as (
  select b.*,
    case when b.funcao = 'alcance' then b.meta_custo_seguidor else b.meta_cpl end
      as meta_aplicada,
    -- mínimo diário pra sair do aprendizado. Não se aplica a alcance,
    -- que otimiza por impressão e não tem evento de conversão.
    case when b.funcao <> 'alcance' and b.conjuntos_ativos > 0 and b.custo_por_resultado > 0
         then (b.conjuntos_ativos * b.eventos_aprendizado * b.custo_por_resultado) / 7.0
    end as minimo_aprendizado_dia,
    -- quantos conjuntos o orçamento atual sustenta neste custo
    case when b.funcao <> 'alcance' and b.custo_por_resultado > 0 and b.orcamento_diario > 0
         then floor((b.orcamento_diario * 7.0) / (b.eventos_aprendizado * b.custo_por_resultado))
    end as conjuntos_sustentaveis,
    -- orçamento mínimo pra UM conjunto aprender neste custo
    case when b.funcao <> 'alcance' and b.custo_por_resultado > 0
         then (b.eventos_aprendizado * b.custo_por_resultado) / 7.0
    end as orcamento_minimo_um_conjunto
  from base b
),
vereditos as (
  select c.*,
    case
      when c.gasto is null or c.gasto = 0                                then 'sem_dados'
      when c.funcao = 'alcance'                                          then 'trocar_objetivo'
      when c.conjuntos_ativos > 1
       and c.conjuntos_sustentaveis is not null
       and c.conjuntos_sustentaveis < c.conjuntos_ativos                 then 'cortar_conjuntos'
      when c.frequencia > c.limite_frequencia                            then 'ampliar_publico'
      when c.resultados = 0                                              then 'sem_resultado'
      when c.custo_por_resultado > c.meta_aplicada * 1.5                 then 'pausar_refazer'
      when c.custo_por_resultado > c.meta_aplicada                       then 'corrigir'
      when c.minimo_aprendizado_dia is not null
       and c.orcamento_diario > 0
       and c.orcamento_diario < c.minimo_aprendizado_dia                 then 'subir_orcamento'
      when c.custo_por_resultado <= c.meta_aplicada * 0.8                then 'escalar'
      else 'manter'
    end as veredito
  from calc c
)
select v.*,
  case v.veredito
    when 'sem_dados'        then 'neutro'
    when 'trocar_objetivo'  then 'critico'
    when 'cortar_conjuntos' then 'critico'
    when 'ampliar_publico'  then 'critico'
    when 'pausar_refazer'   then 'critico'
    when 'sem_resultado'    then 'atencao'
    when 'corrigir'         then 'atencao'
    when 'subir_orcamento'  then 'atencao'
    else 'ok'
  end as gravidade
from vereditos v;

-- ── RLS: mesmo padrão do resto da plataforma (0012_insights_rls.sql) ──
do $$
declare
  t text;
begin
  foreach t in array array[
    'metas_campanha', 'campanhas',
    'metricas_campanha_diaria', 'metricas_campanha_janela'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_authenticated_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
