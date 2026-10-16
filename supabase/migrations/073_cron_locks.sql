-- Lock genérico com TTL para rotinas de cron (PRD #225, issue #227).
--
-- Numeração: 073 porque a origin/main termina na 071 e há uma 072 ainda não
-- comitada no checkout principal.
--
-- Nome = identidade do lock (ex.: 'indicadores-cron'). Não é preso a ciclo:
-- os locks dos Ultimates (062/065) continuam separados.
-- Migration puramente aditiva: cria uma tabela e duas funções, não toca em
-- nenhuma tabela existente.

create table if not exists public.dash_gestao_cron_locks (
  name        text primary key,
  token       uuid not null,
  acquired_at timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- RLS ligada sem policies: anon/authenticated não leem nem escrevem.
-- service_role ignora RLS.
alter table public.dash_gestao_cron_locks enable row level security;
revoke all on public.dash_gestao_cron_locks from anon, authenticated;

-- Aquisição atômica: um único INSERT ... ON CONFLICT. A linha só é trocada
-- se o lock atual já venceu; o WHERE do DO UPDATE é avaliado sob o lock de
-- linha, então duas chamadas concorrentes nunca vencem as duas.
-- Retorna true se adquiriu (inclusive ao assumir lock vencido), false se ativo.
create or replace function public.dash_gestao_cron_acquire_lock(
  p_name        text,
  p_token       uuid,
  p_ttl_seconds integer
) returns boolean
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_won uuid;
begin
  if p_ttl_seconds is null or p_ttl_seconds <= 0 then
    raise exception 'p_ttl_seconds deve ser positivo';
  end if;

  insert into public.dash_gestao_cron_locks as l (name, token, acquired_at, expires_at)
  values (p_name, p_token, now(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (name) do update
    set token = excluded.token,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at
    where l.expires_at <= now()
  returning l.token into v_won;

  return v_won is not null;
end;
$fn$;

-- Libera só se o token for do dono. Idempotente: sem linha ou token alheio
-- (ex.: lock vencido e assumido por outra rodada) retorna false, sem erro.
create or replace function public.dash_gestao_cron_release_lock(
  p_name  text,
  p_token uuid
) returns boolean
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_deleted integer;
begin
  delete from public.dash_gestao_cron_locks
  where name = p_name and token = p_token;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$fn$;

revoke execute on function public.dash_gestao_cron_acquire_lock(text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.dash_gestao_cron_release_lock(text, uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_cron_acquire_lock(text, uuid, integer) to service_role;
grant  execute on function public.dash_gestao_cron_release_lock(text, uuid) to service_role;

-- DOWN
-- 1. drop function if exists public.dash_gestao_cron_release_lock(text, uuid);
-- 2. drop function if exists public.dash_gestao_cron_acquire_lock(text, uuid, integer);
-- 3. drop table if exists public.dash_gestao_cron_locks;
