-- Nexo Foundation: execution and tool-call audit trail.
-- No end-user RLS policies are created. Only service_role can access these tables.

create table if not exists nexo_run (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references user_profile(id) on delete set null,
  owner_scope text not null check (owner_scope in ('user', 'admin')),
  intent text not null check (intent in ('project_lookup', 'company_lookup', 'market_analysis', 'data_quality', 'general')),
  question_hash text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (owner_scope = 'user' and user_profile_id is not null)
    or owner_scope = 'admin'
  )
);

create index if not exists nexo_run_owner_started_idx on nexo_run (user_profile_id, started_at desc);
create index if not exists nexo_run_status_started_idx on nexo_run (status, started_at desc);

create table if not exists nexo_tool_call (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references nexo_run(id) on delete cascade,
  tool_name text not null,
  arguments_hash text not null,
  duration_ms integer not null check (duration_ms >= 0),
  row_count integer check (row_count is null or row_count >= 0),
  status text not null check (status in ('completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists nexo_tool_call_run_idx on nexo_tool_call (run_id, created_at);
create index if not exists nexo_tool_call_tool_created_idx on nexo_tool_call (tool_name, created_at desc);

alter table nexo_run enable row level security;
alter table nexo_tool_call enable row level security;

revoke all on nexo_run from anon, authenticated;
revoke all on nexo_tool_call from anon, authenticated;
