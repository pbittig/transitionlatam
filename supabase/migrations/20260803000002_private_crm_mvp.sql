-- CRM Prime privado por organización, editable y con historial comercial.

-- La oferta pública queda en Free + Prime; `premium` se conserva como código
-- interno de Prime para no romper las verificaciones existentes.
alter table plan drop constraint if exists plan_code_check;

update organization
set plan_id = (select id from plan where code = 'premium')
where plan_id = (select id from plan where code = 'lite');

update user_profile
set plan_id = (select id from plan where code = 'premium')
where plan_id = (select id from plan where code = 'lite');

delete from plan_feature where plan_id = (select id from plan where code = 'lite');
delete from plan where code = 'lite';
update plan set name = 'Prime' where code = 'premium';
alter table plan add constraint plan_code_check check (code in ('free', 'premium'));

-- Cada perfil sin organización recibe un espacio propio. No se agrupa por
-- company_name porque dos cuentas con el mismo texto no prueban pertenencia.
do $$
declare
  profile_row record;
  new_organization_id uuid;
begin
  for profile_row in
    select id, email, company_name, plan_id
    from user_profile
    where organization_id is null
  loop
    insert into organization (name, plan_id, billing_status)
    values (
      coalesce(nullif(profile_row.company_name, ''), 'Espacio de ' || profile_row.email),
      profile_row.plan_id,
      case
        when profile_row.plan_id = (select id from plan where code = 'premium') then 'active'
        else 'trialing'
      end
    )
    returning id into new_organization_id;

    update user_profile set organization_id = new_organization_id where id = profile_row.id;
  end loop;
end $$;

-- Las cuentas creadas después de esta migración también reciben un espacio
-- propio automáticamente.
create or replace function assign_profile_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
begin
  if new.organization_id is null then
    insert into organization (name, plan_id, billing_status)
    values (
      coalesce(nullif(new.company_name, ''), 'Espacio de ' || new.email),
      new.plan_id,
      case when new.plan_id = (select id from plan where code = 'premium') then 'active' else 'trialing' end
    ) returning id into new_organization_id;
    new.organization_id := new_organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists user_profile_assign_organization on user_profile;
create trigger user_profile_assign_organization
before insert on user_profile
for each row execute function assign_profile_organization();

-- Permite mostrar el autor de una actividad a sus compañeros sin abrir
-- perfiles de otras organizaciones. La función evita recursión de RLS sobre
-- user_profile al resolver la organización del usuario actual.
create or replace function current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from user_profile where auth_user_id = auth.uid() limit 1;
$$;

drop policy if exists organization_member_profile_select on user_profile;
create policy organization_member_profile_select on user_profile for select using (
  organization_id = current_user_organization_id()
);

-- Las oportunidades históricas quedan en un espacio administrativo separado.
insert into organization (name, plan_id, billing_status)
select 'Transition LATAM - Interno', id, 'active'
from plan
where code = 'premium'
  and not exists (select 1 from organization where name = 'Transition LATAM - Interno');

alter table opportunity
  add column if not exists organization_id uuid references organization(id),
  add column if not exists created_by uuid references user_profile(id) on delete set null;

update opportunity
set organization_id = (select id from organization where name = 'Transition LATAM - Interno' order by created_at limit 1)
where organization_id is null;

alter table opportunity alter column organization_id set not null;
create index if not exists opportunity_organization_idx on opportunity (organization_id, next_step_at);

create table opportunity_activity (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunity(id) on delete cascade,
  organization_id uuid not null references organization(id) on delete cascade,
  created_by uuid references user_profile(id) on delete set null,
  activity_type text not null check (activity_type in ('note', 'call', 'meeting', 'email', 'stage_change')),
  note text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index opportunity_activity_timeline_idx on opportunity_activity (opportunity_id, occurred_at desc);
create index opportunity_activity_organization_idx on opportunity_activity (organization_id, occurred_at desc);

-- Oportunidades dejan de ser información pública.
drop policy if exists public_read on opportunity;
drop policy if exists organization_prime_select on opportunity;
drop policy if exists organization_prime_insert on opportunity;
drop policy if exists organization_prime_update on opportunity;
drop policy if exists organization_prime_delete on opportunity;

create policy organization_prime_select on opportunity for select using (
  exists (
    select 1 from user_profile up join plan p on p.id = up.plan_id
    where up.auth_user_id = auth.uid() and up.organization_id = opportunity.organization_id and p.code = 'premium'
  )
);
create policy organization_prime_insert on opportunity for insert with check (
  exists (
    select 1 from user_profile up join plan p on p.id = up.plan_id
    where up.auth_user_id = auth.uid() and up.organization_id = opportunity.organization_id
      and up.id = opportunity.created_by and p.code = 'premium'
  )
);
create policy organization_prime_update on opportunity for update using (
  exists (
    select 1 from user_profile up join plan p on p.id = up.plan_id
    where up.auth_user_id = auth.uid() and up.organization_id = opportunity.organization_id and p.code = 'premium'
  )
) with check (
  exists (
    select 1 from user_profile up join plan p on p.id = up.plan_id
    where up.auth_user_id = auth.uid() and up.organization_id = opportunity.organization_id and p.code = 'premium'
  )
);
create policy organization_prime_delete on opportunity for delete using (
  exists (
    select 1 from user_profile up join plan p on p.id = up.plan_id
    where up.auth_user_id = auth.uid() and up.organization_id = opportunity.organization_id and p.code = 'premium'
  )
);

alter table opportunity_activity enable row level security;
create policy organization_prime_select on opportunity_activity for select using (
  exists (
    select 1 from user_profile up join plan p on p.id = up.plan_id
    where up.auth_user_id = auth.uid() and up.organization_id = opportunity_activity.organization_id and p.code = 'premium'
  )
);
create policy organization_prime_insert on opportunity_activity for insert with check (
  exists (
    select 1 from user_profile up join plan p on p.id = up.plan_id
    where up.auth_user_id = auth.uid() and up.organization_id = opportunity_activity.organization_id
      and up.id = opportunity_activity.created_by and p.code = 'premium'
  )
  and exists (
    select 1 from opportunity o
    where o.id = opportunity_activity.opportunity_id and o.organization_id = opportunity_activity.organization_id
  )
);
