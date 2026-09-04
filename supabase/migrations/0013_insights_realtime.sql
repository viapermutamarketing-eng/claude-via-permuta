-- ════════════════════════════════════════════════════════════════
-- Habilita Realtime nas tabelas que `public/insights.html` escuta —
-- assim o ranking e as conquistas piscam sozinhos assim que a Edge
-- Function termina de sincronizar (cron ou botão manual), sem F5.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array[
    'ranking_execucoes', 'ranking_perfis', 'ranking_publicacoes',
    'conquistas_perfil', 'metricas_manuais'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
