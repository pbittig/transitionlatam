create table if not exists service_request (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  user_profile_id uuid not null references user_profile(id) on delete cascade,
  service_type text not null check (
    service_type in (
      'market_study',
      'market_intelligence',
      'project_intelligence',
      'commercial_strategy',
      'custom_analysis',
      'other'
    )
  ),
  description text not null check (char_length(description) between 20 and 4000),
  desired_timing text not null check (
    desired_timing in ('as_soon_as_possible', 'this_month', 'this_quarter', 'exploratory')
  ),
  contact_method text not null check (contact_method in ('email', 'phone', 'meeting')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'contacted', 'quoted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_request_user_created_idx
  on service_request (auth_user_id, created_at desc);

create index if not exists service_request_status_created_idx
  on service_request (status, created_at desc);

alter table service_request enable row level security;

drop policy if exists "Users can create their own service requests" on service_request;
create policy "Users can create their own service requests"
  on service_request
  for insert
  to authenticated
  with check (
    auth.uid() = auth_user_id
    and exists (
      select 1
      from user_profile
      where user_profile.id = user_profile_id
        and user_profile.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Users can view their own service requests" on service_request;
create policy "Users can view their own service requests"
  on service_request
  for select
  to authenticated
  using (auth.uid() = auth_user_id);
