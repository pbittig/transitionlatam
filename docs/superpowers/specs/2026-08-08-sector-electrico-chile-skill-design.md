# Skill `sector-electrico-chile` — diseño

## Propósito

Skill de referencia de dominio sobre los tres trámites regulatorios chilenos que Transition LATAM rastrea para proyectos de generación renovable y BESS:

1. **Acceso Abierto** (Coordinador Eléctrico Nacional) — trámite de conexión.
2. **SEIA** (Servicio de Evaluación Ambiental) — trámite ambiental.
3. **PGP** (Coordinador Eléctrico Nacional) — seguimiento de avance de interconexión.

Uso principal: responder preguntas de dominio regulatorio para informar decisiones de producto (no es primariamente un auditor de código), pero cada referencia incluye dónde vive el concepto en el modelo de datos actual para que también sirva de chequeo cuando la lógica implementada (ingesta, status maturity, Health Score) se desalinee de cómo funciona el trámite real — como en los bugfixes recientes (mismatch de tildes en Acceso Abierto, rechazos SEIA congelados, penalización PGP-stall revertida, filing ambiental faltante).

## Corrección encontrada durante la investigación

El código y una spec previa (`docs/superpowers/specs/2026-08-07-pgp-pes-eo-milestones-design.md`, comentarios en `lib/shared/pgpProjectProgress.ts`) llaman a PGP "Programa de Grandes Proyectos". El nombre oficial, confirmado en coordinador.cl, es **"Plataforma de Gestión de Proyectos"**. El skill usa el nombre correcto y lo señala explícitamente como corrección — no se tocan los comentarios existentes en este trabajo (fuera de alcance), pero queda registrado para una futura limpieza.

## Estructura de archivos

```
.claude/skills/sector-electrico-chile/
  SKILL.md                      # glosario, cuándo usar cada referencia, lecciones aprendidas
  references/
    acceso-abierto.md
    seia.md
    pgp.md
```

Se sigue el patrón de "SKILL.md corto + referencias cargadas bajo demanda" en vez de un solo archivo largo, siguiendo la convención de `superpowers:writing-skills`.

## Contenido por archivo

**SKILL.md**
- Frontmatter con `name`, `description` (triggers: SEIA, PGP, Acceso Abierto, SAC, SUCTD, Coordinador Eléctrico, DIA, EIA, RCA, pertinencia, proyecto fehaciente, BESS + trámite ambiental).
- Tabla glosario de siglas (una línea cada una) para lookup instantáneo sin abrir referencias.
- Cuándo cargar cada `references/*.md`.
- Sección "lecciones aprendidas en este repo" — enlaza los 4 commits recientes de bugfixes de dominio como casos de estudio.

**references/acceso-abierto.md**
- Base legal: LGSE arts. 79-80.
- SAC (Solicitud de Autorización de Conexión, instalaciones nacionales/zonales) vs. SUCTD (Solicitud de Uso de Capacidad Técnica Disponible, instalaciones dedicadas).
- Capacidad Técnica Disponible (CTD) — Res. Exenta CNE N°154/2017, Reglamento arts. 63-64.
- Proyecto Fehaciente — exención de SUCTD para el dueño de las instalaciones dedicadas; reduce la CTD disponible para terceros; se acredita con RCA u otro antecedente y se reporta antes del estudio de CTD.
- Cómo se modela hoy: `lib/ingestion/sources/energia-abierta/*`, `project_connection.request_type`, `docs/04-modelo-datos.md §4.8`.
- Fuentes oficiales citadas (coordinador.cl, chileatiende.gob.cl).

**references/seia.md**
- Base legal: Ley 19.300, DS 40/2012 (Reglamento SEIA) y su modificación DS 17/2025.
- DIA vs. EIA (art. 11 Ley 19.300 — significancia de impacto).
- Pertinencia de Ingreso — trámite previo y distinto al ingreso formal SEIA (art. 10 Ley / art. 3 Reglamento); termina en "Resuelta - Ingreso al SEIA" o negativo, no es la aprobación ambiental.
- RCA favorable/desfavorable, PAC (obligatoria en EIA), PCPI cuando aplica.
- Umbral obligatorio de ingreso: generación >3 MW (art. 3 letra c Reglamento) — no confundir con umbral PMGD (9 MW, otro reglamento, clasifica tipo de conexión no obligación SEIA). BESS standalone no tiene ingreso automático por esa categoría; sus obras asociadas (líneas/subestaciones >23 kV) sí pueden gatillarlo.
- Cómo se modela hoy: `lib/shared/environmentalReviewRules.ts`, `seiaStatusMaturity.ts`, `pertinenciaStatusMaturity.ts`, `lib/ingestion/sources/seia/*`, `lib/ingestion/sources/sea-pertinencia/*`.
- Fuentes oficiales citadas (sea.gob.cl).

**references/pgp.md**
- Nombre correcto: Plataforma de Gestión de Proyectos (no "Programa de Grandes Proyectos").
- Cubre NI (Nuevas Instalaciones), MR (Modificaciones Relevantes), MNR (Modificaciones No Relevantes).
- Reporta avance físico de obra y documentos de puesta en servicio.
- Cómo se modela hoy: `lib/ingestion/sources/pgp/*`, `lib/shared/pgpProjectProgress.ts`, `lib/analytics/scheduleCalibration.ts`, `app/api/cron/sync-pgp-progress/`.
- Fuentes oficiales citadas (coordinador.cl) + nota de que el detalle operativo profundo no pudo verificarse por bloqueo 403 en fetch directo — queda marcado "a verificar" donde aplica.

## Fuera de alcance

- No se modifican los comentarios/spec existentes que dicen "Programa de Grandes Proyectos" (fuera del pedido original).
- No se crea un subagente — se descartó a favor del skill tras confirmar con el usuario.
- No se audita ni corrige código de negocio como parte de esta tarea — el skill queda listo para usarse en auditorías futuras.

## Validación

Contenido basado en búsqueda web a fuentes oficiales (coordinador.cl, sea.gob.cl, chileatiende.gob.cl) más lo ya documentado/citado en el código existente (`environmentalReviewRules.ts` cita DS 40/2012 y DS 17/2025 con fecha de verificación 2026-08-08). Puntos que no pudieron confirmarse contra el texto reglamentario primario (bloqueado por 403) quedan marcados explícitamente como "a verificar" en las referencias, no presentados como hecho.
