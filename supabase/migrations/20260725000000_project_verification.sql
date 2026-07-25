-- Verificador de proyecto: marca cuándo un admin revisó y confirmó la ficha.
-- null = pendiente de verificar. Todos los proyectos existentes nacen null,
-- lo que los deja automáticamente en el backlog inicial de la cola.
alter table project add column if not exists verified_at timestamptz;
