-- ════════════════════════════════════════════════════════════════
-- Habilita Realtime nas tabelas que o painel escuta no canal único
-- `db.channel('via-permuta-painel')` (ver public/index.html) — é
-- assim que a tela Diagnóstico pisca sozinha quando um lead está
-- preenchendo o formulário público AGORA, sem F5 e sem polling.
-- ════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table leads;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'atividades_crm'
  ) then
    alter publication supabase_realtime add table atividades_crm;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'anotacoes'
  ) then
    alter publication supabase_realtime add table anotacoes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'atividades'
  ) then
    alter publication supabase_realtime add table atividades;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pipeline_etapas'
  ) then
    alter publication supabase_realtime add table pipeline_etapas;
  end if;
end $$;
