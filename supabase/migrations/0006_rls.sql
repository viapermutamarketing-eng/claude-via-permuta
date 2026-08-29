-- ════════════════════════════════════════════════════════════════
-- RLS — todas as tabelas do CRM só liberam pra `authenticated`
-- (quem faz login no painel via Supabase Auth). O formulário
-- público NUNCA tem policy de INSERT direta: ele só escreve através
-- da Edge Function `diagnostico-lead`, que usa a service_role key e
-- por isso passa por cima da RLS de propósito.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'pipeline_etapas', 'atividades_crm', 'historico_lead',
    'anotacoes', 'listas', 'leads_lista', 'atividades',
    'atividades_vendedor', 'clientes'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'drop policy if exists %I on %I',
      t || '_authenticated_all', t
    );
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
