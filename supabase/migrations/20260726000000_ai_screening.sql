-- supabase/migrations/20260726000000_ai_screening.sql
-- Tamizado con IA (GLM-5.2) de la cola del Verificador — ver
-- docs/superpowers/specs/2026-07-26-seia-unassign-and-ai-screening-design.md.
-- null en ai_screened_at = todavía no tamizado.
alter table project add column if not exists ai_screened_at timestamptz;
alter table project add column if not exists ai_data_sanity text;
alter table project add column if not exists ai_data_sanity_reason text;
alter table project add column if not exists ai_seia_pick text;
alter table project add column if not exists ai_seia_pick_reason text;
