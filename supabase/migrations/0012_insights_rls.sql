-- ════════════════════════════════════════════════════════════════
-- RLS da Plataforma de Insights — mesmo padrão do CRM (0006_rls.sql):
-- tudo liberado pra `authenticated`. EXCEÇÃO: `contas_tokens` não
-- recebe nenhuma policy pra `authenticated` — só a Edge Function
-- (service_role, que ignora RLS) lê/escreve token de acesso. Ninguém
-- do time consegue puxar um token pelo painel.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array[
    'contas_sociais', 'publicacoes', 'metricas_publicacao',
    'metricas_publicacao_paga', 'metricas_conta_diaria', 'metricas_manuais',
    'criterios_ranking', 'ranking_execucoes', 'ranking_perfis',
    'ranking_publicacoes', 'conquistas', 'conquistas_perfil',
    'pontos_historico'
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

-- `contas_tokens` fica com RLS ligado e SEM policy nenhuma: bloqueia
-- geral pra `anon`/`authenticated`, só service_role passa por cima.
alter table contas_tokens enable row level security;
