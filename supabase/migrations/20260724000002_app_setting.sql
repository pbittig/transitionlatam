create table if not exists app_setting (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_setting enable row level security;
insert into app_setting (key, value) values ('notify_new_projects', 'false')
  on conflict (key) do nothing;
