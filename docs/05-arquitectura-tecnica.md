# 05 — Arquitectura Técnica

## 5.1 Diagrama de alto nivel

```mermaid
graph TB
    subgraph Cliente
        WEB[Next.js App — React/TypeScript]
    end
    subgraph Backend
        API[API Layer — Next.js Route Handlers / Server Actions]
        AI[Transition AI Service — tool-calling]
        JOBS[Jobs de Ingesta y Scoring — Edge Functions / worker]
    end
    subgraph Datos
        PG[(PostgreSQL — Supabase)]
        STORE[Supabase Storage]
    end
    subgraph Externos
        AIPROV[Proveedor(es) de modelos IA]
        MAPS[Proveedor de mapas]
        CRM[CRM de ONIX]
    end

    WEB --> API
    API --> PG
    API --> AI
    AI --> PG
    AI --> AIPROV
    WEB --> MAPS
    JOBS --> PG
    API -- webhook/eventos --> CRM
    API --> STORE
```

## 5.2 Stack recomendado

| Capa | Elección | Justificación |
|---|---|---|
| Frontend | Next.js (App Router) + React + TypeScript | SSR/SSG para SEO (crítico, ver [03](03-modelo-negocio.md)), un solo repo full-stack para velocidad de MVP |
| Backend | Next.js Route Handlers / Server Actions; extraer a servicio dedicado solo si un módulo (ej. IA o ingesta) lo requiere por carga o aislamiento | Evita microservicios prematuros (principio §22 del brief) |
| Base de datos | PostgreSQL | Relacional maduro, soporta JSONB para flexibilidad de atributos y PostGIS para geoconsultas del mapa |
| BaaS | Supabase (Postgres administrado + Auth + Storage + Edge Functions + RLS) | Acelera el MVP sin atar la lógica de negocio a Supabase-specific APIs más allá de auth/storage |
| Autenticación | Supabase Auth | Estándar, soporta roles/JWT que alimentan RLS |
| Storage | Supabase Storage | Reportes generados, adjuntos SEIA, etc. |
| Mapas | Ver §5.5 | — |
| IA | Capa de abstracción propia sobre proveedor(es) — ver [06-arquitectura-ia.md](06-arquitectura-ia.md) | Evita vendor lock-in |
| Búsqueda vectorial | No en el MVP — ver §5.7 | Evitar complejidad innecesaria (principio §20 del brief) |

## 5.3 Estructura de carpetas propuesta

```
/app                        # Next.js App Router
  /(public)/                # Dashboard, mapa, perfiles de proyecto — SSR/SSG
  /(auth)/                  # Login, registro, onboarding
  /(app)/                   # Área autenticada (perfil, preferencias, historial de consultas)
  /api/                    # Route handlers (REST-like) cuando Server Actions no aplique
/lib
  /data-access/             # Capa de acceso a datos — único punto que toca la DB directamente
  /entitlements/            # Resolución de planes/permisos (ver 08)
  /ai/                      # Transition AI: proveedor-agnostic, tools, guardrails (ver 06)
  /leads/                   # Intent Engine, scoring, adaptadores CRM (ver 07)
  /ingestion/               # Conectores de fuentes públicas, normalización, dedup
  /shared/                  # Tipos, utilidades, constantes de dominio
/supabase
  /migrations/               # Migraciones SQL versionadas
  /policies/                 # RLS policies como código, versionadas
/docs                        # Esta documentación
```

Principio: **ningún componente de UI llama directamente a Supabase/DB.** Todo pasa por `/lib/data-access`, que aplica reglas de negocio (incluyendo límites de resultados y chequeo de entitlements) antes de devolver datos.

## 5.4 Preparación multi-país (sin sobre-construir)

- Toda tabla con dato geográfico incluye `country_code` desde el día 1.
- **Dominio confirmado por ONIX (2026-07-20):** `www.transitionlatam.com`. Rutas y contenido SEO estructurados como `/cl/...` (o subdominio `cl.transitionlatam.com`) desde el inicio, aunque solo exista Chile — evita una migración de URLs dolorosa al expandir.
- Sin tablas de "features por país" ni i18n de UI completo en el MVP — se añade cuando exista un segundo país real.

## 5.5 Proveedor de mapas

Recomendación: **MapLibre GL (open source) + tiles vectoriales propios o de un proveedor de bajo costo (ej. MapTiler/Protomaps)** en vez de Mapbox GL comercial, dado que:
- El volumen de datos (proyectos de Chile) es pequeño — no se necesita la escala de Mapbox.
- Evita costos recurrentes por carga de mapa que crecen con tráfico (justamente la métrica que el negocio quiere maximizar — ver [03](03-modelo-negocio.md) §3.5).
- MapLibre es un fork compatible de la API de Mapbox GL JS, permitiendo migrar a Mapbox comercial después sin reescritura si el volumen lo justifica.

Esta es una recomendación, no una decisión cerrada — depende de presupuesto no definido en el brief (ver ambigüedad en [02-prd.md](02-prd.md) §2.5).

## 5.6 Rendimiento del mapa y del dashboard

- Nunca enviar el dataset completo de proyectos al navegador.
- Filtros aplicados server-side; el cliente recibe solo el resultado paginado/clusterizado (clustering server-side para zoom bajo, detalle solo al hacer zoom/click).
- Cachear agregados del dashboard público (totales por tecnología/región) con invalidación al actualizar datos, no recalculando en cada request.

## 5.7 Búsqueda vectorial — evaluación

No se introduce en el MVP. Candidato futuro únicamente para: (a) búsqueda semántica sobre texto libre (noticias, descripciones de proyectos) cuando ese corpus exista y sea relevante, y (b) si Transition AI necesita recuperar contexto no estructurado. Mientras los datos sean mayormente estructurados (proyectos, empresas, relaciones), las consultas de Transition AI se resuelven mejor con SQL controlado vía herramientas (ver [06-arquitectura-ia.md](06-arquitectura-ia.md)) que con RAG vectorial.

## 5.8 Requerimientos no funcionales

- **TypeScript strict mode** en todo el repositorio.
- **Migraciones de base de datos versionadas** (Supabase migrations), nunca cambios de esquema manuales en producción.
- **Variables de entorno y secretos** gestionados fuera del repositorio (`.env` local + secret manager en producción), nunca commiteados.
- **Logging estructurado** de requests de API, consultas a Transition AI, y eventos de ingesta.
- **Tests automatizados**: unitarios para `/lib` (especialmente entitlements y scoring), de integración para endpoints críticos de datos y de IA.
- **CI**: lint + typecheck + tests en cada PR; migraciones aplicadas vía pipeline, no manualmente.
- **Observabilidad**: registro de errores centralizado (ej. Sentry o equivalente) desde el MVP — barato de incluir ahora, costoso de añadir después de un incidente.

## 5.9 Escalabilidad a millones de registros / múltiples países

- Índices desde el diseño inicial sobre `country_code`, `region_id`, `technology_id`, `status`, fechas de conexión — son los filtros de mayor uso.
- Particionamiento de `project_event` y logs de auditoría por fecha si el volumen lo justifica (no se implementa prematuramente, se deja documentado como decisión diferida en [DECISIONS.md](DECISIONS.md)).
- Supabase/Postgres administrado permite escalar verticalmente primero; separación en servicios dedicados (ej. servicio de IA con su propio rate limiting) solo si el acoplamiento actual demuestra ser un cuello de botella real.

## 5.10 Ingesta de datos: Acceso Abierto (Coordinador Eléctrico Nacional) — dos niveles

**Fuente confirmada y verificada técnicamente (2026-07-20):** `https://accesoabierto.coordinador.cl` — el portal de transparencia de solicitudes de conexión del Coordinador Eléctrico Nacional (lo que antes documentamos como "Energía Abierta"/"Solicitudes de Conexión" es esta misma plataforma). ONIX describió, y se verificó inspeccionando el sitio, que existen **dos niveles de datos**:

**Nivel 1 — Listado/export masivo:** el botón de descarga al pie del listado genera la planilla que ya analizamos (`dataset/solicitudes_muestra.xlsx`, ver [04-modelo-datos.md](04-modelo-datos.md) §4.8). Es la fuente para el estado agregado de todas las solicitudes.

**Nivel 2 — Detalle por proyecto ("Formulario"):** entrando a cada proyecto (ícono de "ojo" en el listado) hay siempre un documento llamado **Formulario**, que contiene quién gestiona el proyecto, teléfono, contacto, y permite inferir a qué **empresa/SPV** pertenece. Este nivel es exactamente el insumo que necesitamos para poblar `person` (stakeholder), `entity_relationship` (persona↔empresa, proyecto↔SPV) y enriquecer `company` — ver [04-modelo-datos.md](04-modelo-datos.md) §4.2 y §4.5.

**Hallazgos técnicos de la inspección del sitio (relevantes para diseñar el conector; actualizado 2026-07-20 tras confirmar con ONIX que el sitio es de acceso público sin cuenta):**
- Es una SPA Angular; el HTML estático no expone el listado (se carga por JavaScript) — un `fetch` simple contra la URL raíz no basta, hay que llamar la API real que consume el frontend.
- El backend corre sobre **4 endpoints de API Gateway de AWS** (config embebida en el bundle público de la app: `API_ENDPOINT`, `API_CAT_ENDPOINT` para catálogos como región/comuna/tipo de proyecto, `API_AUTH_ENDPOINT`, `API_CONFIG_ENDPOINT`).
- El login vía **AWS Cognito** existe pero está **restringido a `@coordinador.cl`** (`LOGIN_DOMAIN:"@coordinador.cl"`) — es decir, es para personal interno del Coordinador (y probablemente para que los *solicitantes* gestionen sus propias solicitudes vía rutas `/private/...`), no algo que ONIX necesite. Esto es coherente con la confirmación de ONIX de que el acceso público no usa cuenta.
- En el bundle se identifican **rutas candidatas sin prefijo `/private`** que parecen corresponder a la vista pública de "Acceso Abierto": `/solicitudes`, `/proyectos`, `/empresa`, `/documentos`, `/documentos/s3` (y variante `/documentos/s3/zip`), además de catálogos públicos (`/config/region`, `/config/comuna`, `/config/tipo-proyecto`, `/config/caracter-conexion`) y `/public/documentos_interes`. Las rutas con prefijo `/private/` (`/private/solicitudes`, `/private/solicitud/create`, `/private/config/...`) parecen ser del flujo autenticado de solicitantes/Coordinador, no del acceso público — a confirmar en implementación.
- No se invocó ninguno de estos endpoints más allá de una comprobación pasiva de la ruta raíz (para confirmar que exige un recurso/ruta válido, respuesta estándar de API Gateway) — no se intentó enumerar ni forzar acceso. Antes de construir el conector real conviene una prueba controlada y de bajo volumen contra `/solicitudes` y `/proyectos`, e idealmente capturar (vía DevTools → pestaña Network del navegador, abriendo un proyecto real con el ícono del ojo) la llamada exacta que descarga el documento "Formulario" — no se pudo determinar ese patrón exacto solo con el bundle estático.

**Diseño propuesto (dos conectores, mismo pipeline de diff/eventos):**

```
/lib/ingestion/sources/acceso-abierto/
  listado/
    fetch.ts        -- descarga la planilla del Nivel 1 (mecanismo exacto según confirme ONIX: botón de export vs. endpoint directo)
    normalize.ts
    diff.ts          -- mismo patrón que §4.8: por Id, detecta altas/cambios de estado/capacidad/fecha → project_event
  detalle-formulario/
    fetch.ts         -- para cada proyecto nuevo/cambiado del Nivel 1, descarga el zip de documentos de la solicitud (candidato: /documentos/s3/zip, confirmado públicamente accesible)
    unzip.ts          -- extrae los PDF individuales (Carta Conductora, Formulario SAC/SUCTD/FEHACIENTE — puede haber varias versiones, se prioriza la más reciente)
    parse.ts           -- extrae texto de cada PDF (librería de parseo PDF en Node, ej. pdf-parse) y estructura los campos conocidos (gestor, teléfono, contacto, empresa/SPV)
    extract.ts          -- dado que el Formulario es semi-estructurado (mismos campos siempre), se evalúa usar extracción asistida por IA (mismo patrón de tool-calling controlado de Transition AI, ver [06-arquitectura-ia.md](06-arquitectura-ia.md)) en vez de reglas regex frágiles
  /snapshot.ts, /reconcile.ts  -- compartidos con el resto de fuentes (ver §4.8)
```

**Confirmado con evidencia real (captura del modal "Documentos Solicitud", 2026-07-20):** el detalle de cada proyecto no es un único archivo sino una **lista de documentos** por solicitud (columnas `Tipo`/`Nombre`: `Carta Conductora`, `Formulario SAC` — con posibles múltiples versiones `ver1_(1)`, `ver1_(2)`, …), todos en **PDF**, con un botón "Descargar Todo" que coincide con la ruta `/documentos/s3/zip` identificada de forma pasiva en el bundle — confirma esa ruta como la vía de descarga natural del Nivel 2, en vez de bajar archivo por archivo. Esto resuelve la pregunta de formato pendiente (era PDF).

- **Ejecución:** Nivel 1 corre semanal (ADR-014); Nivel 2 corre solo sobre los proyectos nuevos o con cambios detectados en el Nivel 1 (no sobre las ~2758 filas completas cada vez) — es más costoso (descarga de documento, parseo) y no es necesario re-procesar proyectos sin cambios.
- **Confianza:** datos extraídos del Formulario se registran como `PUBLICO` salvo confirmación directa del propietario — mismo criterio de [04-modelo-datos.md](04-modelo-datos.md) §4.3. Los contactos/teléfonos de personas requieren además tratamiento como dato personal (ver [09-seguridad.md](09-seguridad.md) §9.7, actualizado).

**Estado de las preguntas abiertas (actualizado 2026-07-20):**
1. ~~¿Login requerido?~~ **RESUELTO:** ONIX confirma que el detalle de proyecto y su descarga son de acceso público, sin cuenta ("es abierto"). Coherente con el hallazgo técnico de que el login Cognito está restringido a `@coordinador.cl` (personal interno/solicitantes), no a visitantes públicos.
2. ~~¿ONIX tiene cuenta?~~ **RESUELTO:** no se usa/necesita cuenta.
3. ~~Formato del "Formulario"~~ **RESUELTO (captura real, 2026-07-20):** PDF. Cada solicitud tiene una lista de documentos (`Carta Conductora`, `Formulario SAC`/`SUCTD`/`FEHACIENTE` con posibles versiones), no un archivo único.
4. ~~¿API formal documentada del Coordinador?~~ **RESUELTO:** ONIX no tiene conocimiento de que exista una. Se procede asumiendo que no hay convenio de datos formal, y que la vía de acceso es la misma que usa cualquier visitante público del sitio.

**Próximo paso técnico concreto:** con formato y estructura de documentos confirmados, ya no es estrictamente necesario capturar la llamada de red antes de empezar a implementar — se puede construir `detalle-formulario/fetch.ts` contra la hipótesis de trabajo (`/documentos/s3/zip`, público) y validarla en la primera corrida real durante la Fase 1. Si se quiere evitar cualquier ajuste posterior, sigue siendo útil que alguien copie la URL exacta del botón "Descargar Todo" (clic derecho → copiar enlace) para confirmarla de antemano, pero no bloquea avanzar.

Ver [DECISIONS.md — ADR-015](DECISIONS.md#adr-015--acceso-abierto-arquitectura-de-dos-niveles-y-hallazgos-técnicos) y roadmap en [10-roadmap-mvp.md](10-roadmap-mvp.md).

## 5.11 Tercera fuente confirmada: SEIA (Servicio de Evaluación Ambiental)

**URL confirmada por ONIX (2026-07-20):** `https://seia.sea.gob.cl/busqueda/buscarProyectoResumen.php`. Revisada su estructura para informar el diseño del conector:

- Es una página de **resultados de búsqueda** (no un listado estático) con filtros por nombre de proyecto, tipo de presentación, región, comuna, tipo de proyecto, razón de ingreso, titular, inversión, fechas de presentación/ingreso, estado y encargado.
- **Límite de 1000 resultados por consulta** — el conector debe particionar la descarga (ej. por región + rango de fechas) para cubrir el universo completo de proyectos, en vez de una sola consulta masiva.
- Ofrece **exportación nativa a Excel y KMZ** (con variantes de localización validada/parcialmente validada) — mecanismo de descarga preferente sobre scraping de HTML, cuando esté disponible vía parámetros GET reproducibles.
- Se detectan parámetros GET explícitos en el HTML (ej. `generarKMZ.php?validado=...`), lo que sugiere que la descarga puede automatizarse por URL sin necesidad de un navegador headless — a confirmar durante la implementación del conector.

```
/lib/ingestion/sources/seia/
  fetch.ts       -- consulta buscarProyectoResumen.php particionado por región/fecha, respetando el cap de 1000 resultados
  parse.ts        -- procesa el export Excel/KMZ resultante
  normalize.ts     -- mapea a seia_record / project_event (hitos de tramitación ambiental)
  diff.ts           -- mismo patrón de contraste que en energia-abierta (§5.10)
```

- **Confianza:** datos de SEIA se registran como `PUBLICO` en `data_attribution`, igual que Energía Abierta (§5.10).
- **Frecuencia:** semanal por defecto, igual que las demás fuentes (ADR-014), salvo que ONIX indique otra cadencia para el estado ambiental.
- **Nota legal:** SEIA es un servicio público del Estado de Chile; su uso para consulta individual de proyectos no presenta mayor riesgo, pero la descarga sistemática a escala debe seguir el mismo criterio de revisión de ToS descrito en [09-seguridad.md](09-seguridad.md) §9.7.

Ver [ADR-011](DECISIONS.md#adr-011--fuente-primaria-de-datos-energía-abierta-cne) (actualizado con esta tercera fuente) y el mapeo de `seia_record` en [04-modelo-datos.md](04-modelo-datos.md) §4.2.
