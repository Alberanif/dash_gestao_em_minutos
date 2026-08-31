-- Migration 067: Schema de Pastas (dash_gestao_vendas_folders + folder_id em cycles)

-- 1. Tabela de Pastas
create table if not exists public.dash_gestao_vendas_folders (
  id         uuid        primary key default gen_random_uuid(),
  account_id uuid        not null references public.dash_gestao_accounts(id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vendas_folders_account_id on public.dash_gestao_vendas_folders (account_id);

alter table public.dash_gestao_vendas_folders enable row level security;

create policy "authenticated_account_folders"
  on public.dash_gestao_vendas_folders
  for all
  to authenticated
  using (account_id = current_setting('app.current_account_id', true)::uuid)
  with check (account_id = current_setting('app.current_account_id', true)::uuid);

-- 2. FK folder_id em dash_gestao_vendas_cycles
alter table public.dash_gestao_vendas_cycles
  add column if not exists folder_id uuid null references public.dash_gestao_vendas_folders(id) on delete set null;

create index if not exists idx_vendas_cycles_folder_id on public.dash_gestao_vendas_cycles (folder_id);
