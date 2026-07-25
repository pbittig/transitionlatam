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

## ADR-016 — Formulario: dos formatos reales, tres estrategias de extracción distintas

**Contexto:** ONIX compartió tres ejemplos reales del documento "Formulario" (Nivel 2): un Excel con plantilla fija ("FORMULARIO SAC", versión "2504-FORM-SAC-V1"), un PDF que resultó ser la exportación de la pestaña de verificación (checklist, texto lineal), y un PDF que resultó ser la exportación de la pestaña rica de datos — con el mismo contenido que el Excel, pero con el **orden de lectura desordenado** al extraer el texto (nombres, teléfonos y correos de distintas personas quedan separados y potencialmente intercalados).
**Decisión:** tres estrategias de extracción, elegidas por evidencia contra archivos reales, no por preferencia a priori:
1. **Excel rico** → parser determinístico por etiqueta de celda (`parseXlsx.ts`), sin IA.
2. **PDF checklist** → parser determinístico por regex sobre texto plano (`parsePdf.ts`, detección de subtipo por contenido: presencia de "completitud"/"¿Cumple?"), sin IA.
3. **PDF rico desordenado** → extracción asistida por IA (Nemotron, `extractWithAi.ts`) — único caso donde un enfoque determinístico no es confiable, porque el orden espacial se pierde en la extracción de texto y remapear nombre↔teléfono↔correo por regex arriesga mezclar el contacto de una persona con el de otra.
**Por qué no IA en los otros casos:** ya se evaluó y descartó para datos categóricos estructurados (ver discusión sobre `Tipo Tecnologia` del Excel del listado) — el mismo criterio aplica aquí: se usa IA solo donde la estructura determinística genuinamente no alcanza, verificado con datos reales antes de decidir.
**Resultado tipado explícito:** `FormularioResult` (`{kind: "full" | "verification_only", data}`) evita que un resultado incompleto (sin teléfono/correo, solo nombre/cargo/empresa de quien firma) se trate como si fuera la extracción rica.
**Referencia:** [04-modelo-datos.md](04-modelo-datos.md) §4.8, [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.10, [06-arquitectura-ia.md](06-arquitectura-ia.md).

## ADR-017 — Proveedor de IA para extracción de documentos: NVIDIA NIM (Nemotron)

**Contexto:** se necesitaba un proveedor de IA para la extracción del PDF rico desordenado (ADR-016, caso 3). ONIX proveyó una API key de NVIDIA NIM.
**Decisión:** `nvidia/llama-3.3-nemotron-super-49b-v1.5` vía la API de NVIDIA NIM (compatible con OpenAI), implementado en `/lib/ai/provider/nvidia.ts` siguiendo la capa de abstracción de proveedor ya definida en [06-arquitectura-ia.md](06-arquitectura-ia.md) §6.4.
**Alternativas probadas y descartadas:** `nvidia/llama-3.1-nemotron-nano-8b-v1` (más chico, se probó por velocidad) — terminó en timeout (504) tras 5 minutos sin responder; no es más rápido, es simplemente peor para esta tarea.
**Detalle operativo no trivial:** el modelo es un "modelo de razonamiento" que por defecto gasta tokens en cadena de pensamiento antes de responder — se usa `"detailed thinking off"` en el system prompt y un `max_tokens` generoso (7000) para dejar margen cuando aun así decide razonar extensamente ante ambigüedad genuina en el texto de origen (se observó que agregar instrucciones adicionales al prompt, incluso acotadas, puede disparar una deliberación mucho más larga en este modelo — se prefirió un prompt más simple y estable, verificado repetidamente contra el mismo archivo real, sobre uno "más completo" pero no reproducible).
**Referencia:** `lib/ai/provider/nvidia.ts`, `lib/ingestion/sources/energia-abierta/detalle-formulario/extractWithAi.ts`.

## ADR-018 — RUT como clave de deduplicación de empresas

**Contexto:** el mismo Formulario mostró la misma empresa escrita "Greengate Energía SpA" en un documento y "Greengate Energy SpA" en otro — el nombre no es una clave confiable de de-duplicación (ver principio ya anotado en [04-modelo-datos.md](04-modelo-datos.md) §4.6).
**Decisión:** columna `rut` en `company` (única cuando no es null, migración `20260720000008`), usada como clave primaria de búsqueda antes que el nombre en `getOrCreateCompany`.
**Referencia:** `supabase/migrations/20260720000008_company_rut.sql`, `lib/ingestion/sources/energia-abierta/detalle-formulario/load.ts`.

## ADR-019 — API oficial SIPUB del Coordinador Eléctrico Nacional: dos fuentes nuevas y complementarias

**Contexto:** ONIX obtuvo credenciales propias (cuenta `bittig.patrick@onixcg.com`) para el portal oficial `portal.api.coordinador.cl` (servicio "sipubv2"), con un API key de datos públicos. Se investigó en vivo contra la API real (no contra documentación) antes de decidir nada, dado que el spec OpenAPI describe 95 endpoints y no todos están vigentes.

**Hallazgo 1 — `/centrales/v4/findByDate` (vigente, no deprecado):** registro de **centrales de generación ya operativas o en construcción** (`estado`: "Operativa", "En Construcción", "Fuera de Servicio"), no solicitudes en desarrollo — algunas con fecha de entrada en operación desde 1919. Trae coordenadas UTM reales (`coordenada_este`/`coordenada_norte`/`zona_huso`, 19G/19H/18S según región), tecnología, capacidad, propietario y punto de conexión. ~1362 registros totales (3 páginas de 500). **Esto NO reemplaza el pipeline de Acceso Abierto** (que rastrea solicitudes de conexión *en desarrollo futuro*): son capas distintas y complementarias — "parque instalado hoy" vs. "pipeline de proyectos futuros". Un subconjunto de registros trae el nombre o propietario con el sufijo `[NO_MOSTRAR]`/`[EN_REVISION]` y campos vacíos (borradores internos del Coordinador) — se filtran por convención, no se muestran.

**Hallazgo 2 — `/api/v2/recursos/infotecnica/empresas/` (marcado "disponible solo hasta 2024", pero responde con datos reales):** 1422 empresas coordinadas con un campo `grupo` (id de agrupación corporativa) asignado por el propio Coordinador. Verificado contra 722 registros muestreados: **el campo `rut` está vacío en el 100% de los casos observados** (esto corrige una suposición previa de esta misma investigación, que asumía RUT poblado — se verificó explícitamente contra ~half del dataset antes de decidir, no se asumió). En cambio, `grupo` sí agrupa correctamente empresas relacionadas reales y verificables: p. ej. grupo 4 = Colbún S.A. + Empresa Eléctrica Industrial S.A. + Río Tranquilo S.A.; grupo 522 = las siete SPV del grupo AELA Energía (Duqueco, San Andrés, AELA Eólica Negrete/Llanquihue/Sarco, HidroConfianza, AELA Generación); grupo 29 = Pacific Hydro Chile + Hidroeléctrica Cachapoal. Esto sí responde directamente al pedido original de ONIX de un directorio de empresas relacionadas (que había quedado bloqueado por Cloudflare en `coordinador.cl/directorio-de-empresas-coordinadas/`, ver intento documentado en la sesión).

**Decisión:** se adoptan ambas fuentes como conectores nuevos e independientes, sin modificar el pipeline de Acceso Abierto existente:
1. `coordinador_empresa` (nueva tabla) — espejo del registro `empresas`, clave primaria `id_infotecnica`, incluye `grupo`. El vínculo hacia `company` (nuestra tabla) es **por nombre normalizado** (reutilizando `normalizeForMatch`), no por RUT — no existe RUT confiable en esta fuente. Se usa en modo "best effort": al mostrar una empresa, se busca su fila en `coordinador_empresa` por nombre y se listan las demás empresas del mismo `grupo` como "empresas relacionadas (fuente: Coordinador Eléctrico Nacional)", siempre con esa atribución explícita — nunca presentado como dato propio verificado.
2. `power_plant` (nueva tabla) — espejo de `centrales`, clave primaria `id_central`, coordenadas convertidas de UTM a WGS84 (lat/lng) para reutilizar el mapa ya construido como una capa adicional ("Centrales en operación"), separada visualmente de "Proyectos en desarrollo".
**Por qué no forzar un merge con `project`/`company`:** la mayoría de las centrales son plantas antiguas ya operativas sin relación con ninguna solicitud de conexión en nuestro pipeline (falsos negativos de match serían casi el 100%); mantenerlas en tablas propias evita contaminar el modelo de "proyecto en desarrollo" y permite descartar la fuente sin migraciones destructivas si en el futuro deja de estar disponible (riesgo real: el tag "disponible solo hasta 2024" en `empresas`).
**Riesgo monitoreado:** el endpoint `empresas` está marcado como posiblemente descontinuado — se documenta el riesgo, no se construye ninguna dependencia crítica de negocio sobre su disponibilidad continua; si deja de responder, el directorio de grupos simplemente deja de actualizarse (no rompe nada más).
**Referencia:** `supabase/migrations/` (pendiente de numerar), `lib/ingestion/sources/sipub/`, `.env.local` (`COORDINADOR_SIPUB_API_KEY`).

---

*Este archivo debe actualizarse con cada nueva decisión arquitectónica relevante tomada durante el desarrollo, no solo durante esta fase inicial de documentación.*
