# Registro de Decisiones Arquitectónicas (ADRs)

Formato: cada decisión indica contexto, decisión tomada y alternativas consideradas. Este archivo se actualiza cada vez que se toma una decisión arquitectónica relevante — ninguna decisión importante se toma en silencio (regla explícita del brief, sección 24).

---

## ADR-001 — Stack: Next.js + TypeScript + Supabase (Postgres)

**Contexto:** se necesita velocidad de desarrollo para un MVP acotado a Chile, sin sacrificar la capacidad de escalar a millones de registros y múltiples países.
**Decisión:** Next.js (App Router) + React + TypeScript en el frontend y backend (Route Handlers/Server Actions); Supabase como BaaS sobre PostgreSQL para DB, Auth y Storage.
**Alternativas consideradas:** backend dedicado (NestJS) desde el inicio — descartado por complejidad prematura; base de datos NoSQL — descartada porque el dominio es fuertemente relacional (proyectos↔empresas↔SPVs↔eventos).
**Referencia:** [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md).

## ADR-002 — Modelo de datos relacional, no Graph DB, en el MVP

**Contexto:** el brief plantea explícitamente una evolución futura hacia un Knowledge Graph.
**Decisión:** modelar en PostgreSQL relacional con una tabla de relaciones tipadas genérica (`entity_relationship`) que emula consultas de grafo sin el costo operativo de un motor de grafo dedicado.
**Alternativas consideradas:** Neo4j u otra Graph DB desde el día 1 — descartado por complejidad e infraestructura innecesarias para el volumen del MVP.
**Referencia:** [04-modelo-datos.md](04-modelo-datos.md) §4.5.

## ADR-003 — Transition AI vía tool-calling controlado, no SQL libre ni RAG vectorial pesado

**Contexto:** Transition AI debe responder preguntas sobre datos estructurados sin permitir extracción masiva ni inventar información.
**Decisión:** el LLM invoca únicamente un catálogo fijo de tools backend con límites de filas, paginación y chequeo de entitlements; sin generación de SQL libre; sin búsqueda vectorial en el MVP.
**Alternativas consideradas:** LLM con acceso a ejecutar SQL generado — descartado por riesgo de seguridad y de exactitud; RAG vectorial como mecanismo primario — descartado porque el dataset es mayormente estructurado, no texto libre.
**Referencia:** [06-arquitectura-ia.md](06-arquitectura-ia.md).

## ADR-004 — Suscripciones vía sistema de entitlements centralizado

**Contexto:** el modelo de suscripciones (Free/Professional/Business/Enterprise) no debe acoplarse a componentes de UI ni bloquear el MVP (que lanza sin cobro).
**Decisión:** capa de entitlements (`/lib/entitlements`) como único punto de verdad sobre qué puede ver/hacer un usuario; UI y API la consultan, nunca implementan su propia lógica de plan.
**Referencia:** [08-modelo-suscripciones.md](08-modelo-suscripciones.md).

## ADR-005 — Protección de datos vía límites de uso, no DRM

**Contexto:** el dataset es el activo principal; no se puede impedir técnicamente la copia manual, pero sí la extracción automatizada a escala.
**Decisión:** paginación forzada, límites de resultados, rate limiting, sin endpoints de exportación masiva, auditoría de consultas — en capas (API, IA, exportación) en vez de un único mecanismo.
**Referencia:** [09-seguridad.md](09-seguridad.md).

## ADR-006 — Proveedor de mapas: MapLibre GL (recomendado, no cerrado)

**Contexto:** se necesita un mapa interactivo performante para un volumen de datos inicialmente pequeño (proyectos de Chile), con foco en costo variable por tráfico.
**Decisión (recomendación abierta a validación de presupuesto):** MapLibre GL + tiles de bajo costo (MapTiler/Protomaps) en vez de Mapbox GL comercial, manteniendo compatibilidad de API para migrar si el volumen lo justifica.
**Referencia:** [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.5.

## ADR-007 — Lead scoring como función ponderada transparente, no ML, en el MVP

**Contexto:** no existe aún historial suficiente de leads ganados/perdidos para entrenar un modelo, y el equipo comercial necesita poder confiar y ajustar el criterio manualmente.
**Decisión:** `ONIX Opportunity Score` como suma ponderada configurable de Engagement/Intent/Commercial Fit/Market Fit; punto de extensión explícito para reemplazar por ML cuando haya datos de entrenamiento reales.
**Referencia:** [07-inteligencia-leads.md](07-inteligencia-leads.md) §7.3.

## ADR-008 — Proveniencia y confianza como campo de primera clase del esquema

**Contexto:** el brief exige nunca presentar una inferencia o estimación como hecho verificado.
**Decisión:** tabla `data_attribution` como mecanismo central de proveniencia/confianza, referenciada por cualquier entidad/campo, en vez de columnas de metadata ad-hoc repetidas por tabla.
**Referencia:** [04-modelo-datos.md](04-modelo-datos.md) §4.3.

## ADR-009 — Integraciones de CRM y de IA vía capas de abstracción/adaptador

**Contexto:** no está confirmado qué CRM usa ONIX hoy, y se quiere evitar vendor lock-in de proveedor de IA.
**Decisión:** patrón adaptador para CRM (`/lib/leads/crm`) e interfaz de proveedor para IA (`/lib/ai/provider`); el MVP puede lanzar con un adaptador de CRM genérico (webhook) sin bloquear el resto del desarrollo.
**Referencia:** [07-inteligencia-leads.md](07-inteligencia-leads.md) §7.5, [06-arquitectura-ia.md](06-arquitectura-ia.md) §6.4.

## ADR-010 — `country_code` como parámetro desde el día 1, sin generalización completa prematura

**Contexto:** la plataforma debe evolucionar de Chile a LATAM, pero el brief pide explícitamente no sobre-construir.
**Decisión:** todas las tablas geográficas/regulatorias incluyen `country_code` y las rutas están estructuradas por país (`/cl/...`) desde el inicio; no se construyen tablas de "features por país", i18n completo, ni normativas de otros países hasta que exista un segundo mercado real.
**Referencia:** [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.4, [01-vision-producto.md](01-vision-producto.md) §1.3.

---

## ADR-011 — Fuente primaria de datos: Energía Abierta / Solicitudes de Conexión (misma fuente) + SEIA

**Contexto:** era una ambigüedad abierta (§2.5 #1 de [02-prd.md](02-prd.md)) si existía un dataset base o si la ingesta sería 100% manual.
**Decisión (2026-07-20, actualizada 2026-07-20):** ONIX confirmó y proveerá directamente:
- **Energía Abierta / Solicitudes de Conexión:** ONIX aclaró que el archivo de ejemplo (`dataset/solicitudes_muestra.xlsx`, 2758 filas — solicitudes SAC/SUCTD/FEHACIENTES con estado de tramitación) y "Energía Abierta" son **la misma fuente** — un único conector `energia-abierta`, no dos. La URL exacta será compartida por ONIX para revisión antes de construir el conector automatizado.
- **SEIA:** URL confirmada — `https://seia.sea.gob.cl/busqueda/buscarProyectoResumen.php`. Es un buscador con filtros (región, comuna, tipo, fechas, estado, titular), límite de 1000 resultados por consulta, y exportación nativa a Excel/KMZ. Se modela como conector independiente `seia`.
**Pendiente:** URL exacta de Energía Abierta/Solicitudes de Conexión (ONIX la compartirá); estrategia de particionamiento de consultas a SEIA para superar el límite de 1000 resultados.
**Referencia:** [04-modelo-datos.md](04-modelo-datos.md) §4.8–§4.9, [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.10–§5.11.

## ADR-012 — Supabase confirmado como decisión (no solo recomendación)

**Contexto:** ADR-001 recomendaba Supabase como BaaS; era una recomendación técnica sin ratificación explícita del negocio.
**Decisión (2026-07-20):** ONIX confirma explícitamente la preferencia por Supabase. Se ratifica ADR-001 sin cambios — deja de ser una recomendación abierta y pasa a ser una decisión cerrada del proyecto.

## ADR-013 — CRM de ONIX: pendiente de creación

**Contexto:** ambigüedad #4 de [02-prd.md](02-prd.md) §2.5 — no estaba confirmado qué CRM usa ONIX.
**Decisión (2026-07-20):** ONIX confirma que **no existe hoy un CRM operativo** para este flujo comercial y que debe construirlo/configurarlo. Dado que el entorno tiene herramientas MCP de **Zoho CRM** ya conectadas, Zoho es el candidato más probable, pero no está formalmente decidido.
**Impacto arquitectónico:** ninguno sobre el diseño ya propuesto — se ratifica ADR-009 (patrón adaptador). El MVP de Transition LATAM se conecta inicialmente vía el adaptador genérico `webhook.ts`; el adaptador específico (Zoho u otro) se implementa cuando ONIX confirme y tenga el CRM configurado. No se bloquea el desarrollo del resto de la plataforma por esta pendiente.
**Referencia:** [07-inteligencia-leads.md](07-inteligencia-leads.md) §7.5.

## ADR-014 — Revisión periódica de estado de proyectos como requisito de producto explícito

**Contexto:** ONIX pidió expresamente un mecanismo para volver a descargar las fuentes de datos periódicamente y "contrastar" (diff) contra el estado anterior, más allá de la carga inicial.
**Decisión (2026-07-20):** se formaliza un job recurrente (cadencia inicial: semanal) por cada fuente de ingesta, que compara el snapshot nuevo contra el estado vigente en `project`/`project_connection` y genera automáticamente `project_event` por cada cambio detectado (estado, capacidad, fechas). Revisión humana en el panel de admin antes de aplicar cambios como definitivos, mientras se valida la calidad de cada fuente.
**Referencia:** [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.10, [04-modelo-datos.md](04-modelo-datos.md) §4.8.

## ADR-015 — Acceso Abierto: arquitectura de dos niveles y hallazgos técnicos

**Contexto:** ONIX explicó que el portal `accesoabierto.coordinador.cl` no solo ofrece el listado agregado de solicitudes de conexión (ya analizado como `dataset/solicitudes_muestra.xlsx`), sino que cada proyecto tiene un detalle ("ícono del ojo") con un documento **Formulario** que revela quién gestiona el proyecto, su contacto, y la empresa/SPV a la que pertenece.
**Investigación técnica realizada:** se inspeccionó el sitio (HTML + bundle JS) para informar el diseño del conector, sin invocar endpoints internos sin autorización. Hallazgos: es una SPA Angular; el backend real es API Gateway de AWS con autenticación AWS Cognito; hay integración aparente con Bizagi (BPM), consistente con un Formulario versionado por etapa del proceso de conexión.
**Decisión:** se diseña la ingesta de esta fuente en **dos conectores independientes pero coordinados** — `listado` (Nivel 1, ya cubierto por ADR-011/ADR-014) y `detalle-formulario` (Nivel 2, solo se ejecuta sobre proyectos nuevos/cambiados detectados en el Nivel 1, no sobre el dataset completo en cada corrida).
**Actualización (2026-07-20):** ONIX confirmó que todo el portal (listado y detalle de proyecto, incluido el Formulario) es de **acceso público, sin cuenta**. Esto es coherente con el hallazgo técnico de que el login AWS Cognito del sitio está restringido a `@coordinador.cl` (personal/solicitantes), no a visitantes públicos. Se identificaron en el bundle público de la app rutas candidatas de API sin prefijo `/private` (`/solicitudes`, `/proyectos`, `/documentos`, `/documentos/s3`) que probablemente sirven la vista pública — no se invocaron sin más validación. ONIX tampoco tiene conocimiento de una API formal/documentada del Coordinador, por lo que se procede asumiendo acceso vía la misma ruta que usa cualquier visitante.
**Actualización (2026-07-20):** captura real del modal "Documentos Solicitud" confirma: formato **PDF**; cada solicitud tiene varios documentos (`Carta Conductora`, `Formulario SAC`/`SUCTD`/`FEHACIENTE`, con posibles versiones); existe un botón "Descargar Todo" coherente con la ruta `/documentos/s3/zip` ya identificada. Con esto, el diseño del conector del Nivel 2 queda suficientemente especificado para empezar a implementarse en la Fase 1, validando la hipótesis del endpoint en la primera corrida real.
**Pendiente (no bloqueante):** confirmar el endpoint exacto en ejecución real (o que alguien copie la URL del botón "Descargar Todo").
**Referencia:** [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.10, [04-modelo-datos.md](04-modelo-datos.md) §4.8, [09-seguridad.md](09-seguridad.md) §9.7.

---

*Este archivo debe actualizarse con cada nueva decisión arquitectónica relevante tomada durante el desarrollo, no solo durante esta fase inicial de documentación.*
