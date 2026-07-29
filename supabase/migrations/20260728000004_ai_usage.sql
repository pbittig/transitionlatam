create table if not exists ai_usage_event (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references user_profile(id) on delete cascade,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_event_user_month_idx on ai_usage_event (user_profile_id, created_at);
alter table ai_usage_event enable row level security;
