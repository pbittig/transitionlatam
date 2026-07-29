create table if not exists ai_chat_message (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references user_profile(id) on delete cascade,
  owner_scope text not null check (owner_scope in ('user', 'admin')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  check (
    (owner_scope = 'user' and user_profile_id is not null)
    or (owner_scope = 'admin' and user_profile_id is null)
  )
);

create index if not exists ai_chat_message_owner_recent_idx
  on ai_chat_message (owner_scope, user_profile_id, created_at desc);
create index if not exists ai_chat_message_expiry_idx on ai_chat_message (expires_at);

alter table ai_chat_message enable row level security;
