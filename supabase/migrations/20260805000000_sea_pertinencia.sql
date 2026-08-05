-- Consultas de Pertinencia del SEA (docs de la prueba técnica 2026-08-04/05) —
-- señal temprana de proyectos que podrían ingresar a SEIA. Tabla propia, no
-- columnas nuevas en project: una pertinencia no es un proyecto todavía
-- (especialmente si requiere_ingreso resulta "No" o sigue en análisis).
create table pertinencia_consulta (
  id uuid primary key default gen_random_uuid(),
  qid_process text not null,
  correlative_id text not null,
  name text not null,
  titular_name text,
  titular_rut text,
  region text,
  comuna text,
  tipo_proyecto text,
  estado text,
  sub_estado text,
  requiere_ingreso text,
  fecha_presentacion date,
  fecha_respuesta date,
  tipologia_seia text,
  descripcion text,
  documentos jsonb not null default '[]'::jsonb,

  -- Resolución de entidad semi-asistida (mismo criterio que entity_alias, ver
  -- docs/04-modelo-datos.md §4.6): se sugiere un candidato, un humano confirma.
  suggested_project_id uuid references project(id) on delete set null,
  suggested_match_score numeric,
  matched_project_id uuid references project(id) on delete set null,
  match_status text not null default 'pending' check (match_status in ('pending', 'confirmed', 'rejected', 'no_match_available')),

  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index pertinencia_consulta_qid_process_idx on pertinencia_consulta (qid_process);
create index pertinencia_consulta_match_status_idx on pertinencia_consulta (match_status);
create index pertinencia_consulta_detected_at_idx on pertinencia_consulta (detected_at desc);

alter table pertinencia_consulta enable row level security;
