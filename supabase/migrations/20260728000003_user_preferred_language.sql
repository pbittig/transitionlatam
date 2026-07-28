alter table user_profile
  add column if not exists preferred_language text not null default 'es'
  check (preferred_language in ('es', 'en'));
