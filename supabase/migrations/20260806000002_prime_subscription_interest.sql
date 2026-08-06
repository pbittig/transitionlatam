-- Distinguish Prime subscription interest from consulting service requests.
alter table public.service_request
  drop constraint if exists service_request_service_type_check;

alter table public.service_request
  add constraint service_request_service_type_check check (
    service_type in (
      'market_study',
      'market_intelligence',
      'project_intelligence',
      'commercial_strategy',
      'custom_analysis',
      'prime_subscription',
      'other'
    )
  );
