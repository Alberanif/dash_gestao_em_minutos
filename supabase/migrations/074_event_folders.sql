-- UP
-- Pastas personalizadas da tela Eventos do Dash V2. Só organização visual: não altera filtros, vendas nem métricas.
-- Os eventos que não estão em nenhuma pasta ficam na lista "Sem pasta", que não vive aqui.
create table dash_gestao_event_folders (
  id         uuid        not null default gen_random_uuid() primary key,
  account_id uuid        not null references dash_gestao_accounts(id) on delete cascade,
  name       text        not null,
  color      text        not null default 'azul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_event_folder_name check (char_length(btrim(name)) between 1 and 30),
  constraint chk_event_folder_color
    check (color in ('azul', 'ciano', 'verde', 'indigo', 'violeta', 'rosa', 'coral', 'ardosia'))
);

-- Nome único por conta, sem diferenciar maiúsculas.
create unique index uq_event_folders_account_name on dash_gestao_event_folders (account_id, lower(btrim(name)));
create index idx_event_folders_account_id on dash_gestao_event_folders (account_id, created_at);

-- Um evento pode estar em várias pastas; excluir a pasta ou o evento só desfaz o vínculo.
create table dash_gestao_event_folder_items (
  folder_id  uuid        not null references dash_gestao_event_folders(id) on delete cascade,
  filter_id  uuid        not null references dash_gestao_filters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (folder_id, filter_id)
);

create index idx_event_folder_items_filter_id on dash_gestao_event_folder_items (filter_id);

alter table dash_gestao_event_folders enable row level security;
alter table dash_gestao_event_folder_items enable row level security;

-- Leitura pela sessão do usuário; escritas pelo service_role (que ignora RLS), como nos filtros.
create policy "Authenticated users can read event folders"
  on dash_gestao_event_folders
  for select
  to authenticated
  using (true);

create policy "Authenticated users can read event folder items"
  on dash_gestao_event_folder_items
  for select
  to authenticated
  using (true);

-- DOWN
-- drop table if exists dash_gestao_event_folder_items;
-- drop table if exists dash_gestao_event_folders;
