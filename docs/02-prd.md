# 02 — Product Requirements Document (PRD)

## 2.1 Personas

| Persona | Objetivo al usar la plataforma | Señal de intención relevante |
|---|---|---|
| **Developer** (desarrollador de proyectos) | Benchmarking de pipeline competidor, buscar socios/financiamiento | Ver perfiles de competidores, consultas sobre financiamiento |
| **Investor** | Encontrar proyectos/mercados para invertir | Filtros por capacidad/etapa, Opportunity Finder |
| **EPC** | Encontrar proyectos en etapa pre-construcción | Filtros por fecha de construcción, consultas IA sobre pipeline |
| **Technology Provider / Supplier** | Identificar proyectos que necesiten su tecnología | Filtros por tecnología, consultas sobre proveedores actuales |
| **Financial Institution** | Mapear oportunidades de financiamiento | Consultas sobre estructura de propiedad, SPVs |
| **Consultant** | Inteligencia de mercado para sus propios clientes | Uso intensivo de Transition AI, reportes |
| **Corporate (offtaker)** | Buscar PPA / suministro | Consultas sobre offtake, proyectos por región |
| **Government / Academia** | Contexto de mercado, estadísticas | Dashboard público, bajo scoring comercial |
| **Other** | — | — |

El tipo de usuario se autodeclara en el registro y se corrige con comportamiento observado (ver [07-inteligencia-leads.md](07-inteligencia-leads.md)).

## 2.2 Módulos funcionales del MVP

| # | Módulo | Resumen | Prioridad |
|---|---|---|---|
| 1 | Dashboard público | Estadísticas agregadas de mercado Chile | P0 |
| 2 | Mapa interactivo | Proyectos geolocalizados con filtros | P0 |
| 3 | Perfil de proyecto | Página individual por proyecto, con campos restringidos por plan | P0 |
| 4 | Transition AI (v1) | Preguntas en lenguaje natural sobre el dataset estructurado | P0 |
| 5 | Registro / Onboarding | Captura de perfil de usuario (empresa, cargo, interés) | P0 |
| 6 | Seguimiento básico de intención | Tracking de eventos de comportamiento (vistas, consultas) | P0 |
| 7 | Captura de leads → notificación a ONIX | Umbral simple de scoring → notificación/export a CRM | P0 |
| 8 | Ingesta de datos (admin/back-office) | Proceso (semi-)manual de carga y actualización de datos Chile | P0 |
| 9 | Opportunity Finder | Búsqueda dirigida por intención declarada | P1 (post-MVP, arquitectura preparada) |
| 10 | Report Builder | Generación de reportes dinámicos | P1 (post-MVP) |
| 11 | Suscripciones / Billing | Planes pagos | P1 (post-MVP, entitlements desde el día 1) |
| 12 | Empresas y relaciones | Grupo detrás de cada proyecto, malla societaria simplificada, cartera consolidada y contactos funcionales | P1 (alcance aprobado; depende de prueba de proveedor) |
| 13 | Expansión LATAM (datos multi-país) | — | P2 |

P0 = incluido en el MVP. P1 = arquitectura preparada, funcionalidad no construida aún. P2 = fuera de alcance por ahora.

El alcance aprobado de **Empresas y relaciones** está documentado en
[2026-07-28-empresas-y-relaciones-scope.md](superpowers/specs/2026-07-28-empresas-y-relaciones-scope.md).

## 2.3 Requerimientos funcionales clave

### Dashboard público
- Debe renderizar server-side (SSR/SSG) para SEO.
- Métricas: total proyectos, proyectos por tecnología, por región, capacidad MW/MWh, por etapa, por fecha estimada de conexión, pipeline BESS, pipeline renovable.
- No requiere autenticación.

### Mapa
- Filtros: tecnología, región, capacidad, estado, fecha de conexión, fecha de construcción.
- Carga de datos vía consultas server-side paginadas/clusterizadas — nunca el dataset completo al cliente (ver [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.6).

### Perfil de proyecto
- Campos públicos vs. restringidos definidos por combinación (nivel de confianza del dato × plan del usuario) — ver [04-modelo-datos.md](04-modelo-datos.md) §4.3 y [08-modelo-suscripciones.md](08-modelo-suscripciones.md).
- Línea de tiempo de eventos históricos del proyecto.
- Debe indicar explícitamente la fuente y el nivel de confianza de cada dato mostrado, nunca presentar una estimación como hecho verificado (requisito no negociable, sección 4 del brief original).

### Transition AI
- Ver arquitectura completa en [06-arquitectura-ia.md](06-arquitectura-ia.md).
- Debe operar exclusivamente sobre datos estructurados vía herramientas controladas por backend — nunca acceso directo a la base de datos desde el cliente ni SQL generado libremente.
- Límite de consultas por plan/usuario.
- Cada respuesta que cite datos debe poder trazarse a su fuente.

### Registro / Onboarding
- Captura progresiva, no bloqueante: el usuario puede explorar el dashboard público sin registrarse.
- El registro se solicita al cruzar umbrales de valor (ej. tercera consulta a Transition AI, intento de ver un campo restringido).

### Seguimiento de intención (básico para MVP)
- Trackear: proyectos vistos, consultas IA realizadas, filtros usados, tiempo en plataforma.
- Persistir como eventos crudos que alimentan el Intent Engine futuro (ver [07-inteligencia-leads.md](07-inteligencia-leads.md)) — el MVP no requiere el scoring completo, pero sí el modelo de datos que lo soporte.

## 2.4 Requerimientos no funcionales

Ver detalle en [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) y [09-seguridad.md](09-seguridad.md). Resumen:

- TypeScript strict mode en todo el código.
- RLS (Row Level Security) en Postgres/Supabase como mecanismo primario de autorización a nivel de datos.
- Ningún endpoint debe permitir exportación masiva sin límites.
- Todas las decisiones arquitectónicas relevantes se documentan en [DECISIONS.md](DECISIONS.md).

## 2.5 Ambigüedades identificadas (requieren decisión del negocio antes o durante el MVP)

Estas preguntas no tienen una respuesta puramente técnica — se documentan aquí para que ONIX las resuelva explícitamente; el diseño actual asume la opción marcada como "supuesto de trabajo" pero es reversible.

1. ~~**¿Cuál es la fuente primaria de datos para el MVP de Chile?**~~ **RESUELTO (2026-07-20):** fuente primaria confirmada = **Energía Abierta** (plataforma de datos abiertos de la Comisión Nacional de Energía, CNE, Chile). ONIX proveerá el dataset directamente. Además, ONIX requiere un **proceso de revisión semanal del estado de los proyectos** (detección de cambios respecto a la última carga) — ver diseño en [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.10 y su conexión con el historial en [04-modelo-datos.md](04-modelo-datos.md) §4.4. Ver [ADR-011](DECISIONS.md#adr-011--fuente-primaria-de-datos-energía-abierta-cne).
2. **¿Quién carga y mantiene los datos en el MVP?** Confirmado por ONIX: se procede con el supuesto de trabajo (panel de admin interno + proceso de ingesta asistida), ahora con el añadido de la revisión semanal automatizada/asistida sobre Energía Abierta (ver punto 1).
3. **Umbral de "lead calificado"** — el brief pide "generar clientes potenciales altamente calificados" pero no define el umbral de scoring que dispara la notificación a ONIX.
   *Supuesto:* umbral inicial simple y configurable (no ML), ajustable manualmente por ONIX durante los primeros meses. **Sin resolver aún** — pendiente de definición conjunta con ONIX una vez haya datos de leads reales.
4. ~~**CRM de destino real**~~ **ACTUALIZADO (2026-07-20):** ONIX no tiene hoy un CRM operativo para este flujo — **debe construirlo/configurarlo**. La plataforma tiene acceso a herramientas MCP de Zoho CRM, por lo que Zoho es el candidato más probable, pero no está formalmente confirmado. La arquitectura de adaptador (ADR-009) se mantiene sin cambios: Transition LATAM lanza con el adaptador genérico (`webhook.ts`) y se conecta el adaptador de Zoho (u otro) cuando el CRM de ONIX esté listo — ver [ADR-013](DECISIONS.md#adr-013--crm-de-onix-pendiente-de-creación).
5. **Definición legal de "información pública"** para datos de ownership/SPV — en Chile cierta información societaria es pública (Registro de Empresas y Sociedades, CMF) pero su scraping y republicación agregada puede tener implicancias legales/de ToS que deben revisarse con legal de ONIX antes de ingestar fuentes de terceros a escala. Ver [09-seguridad.md](09-seguridad.md) §9.7.
6. **Idioma de la plataforma** — el brief está en español pero el sector energético LATAM opera frecuentemente en inglés para inversionistas internacionales. *Supuesto:* español como idioma primario del MVP Chile, arquitectura i18n-ready pero sin traducción completa en el MVP.
7. **Proveedor de mapas** — ver decisión propuesta en [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.5; depende de presupuesto, que no está definido en el brief.
8. **Modelo de pricing de suscripciones** — el brief da un esquema de 4 tiers cualitativos pero no precios. No es necesario para el MVP (suscripciones son P1) pero condiciona el diseño del sistema de entitlements.

## 2.6 Riesgos arquitectónicos identificados

| Riesgo | Impacto | Mitigación propuesta |
|---|---|---|
| Modelar el dominio como relacional puro sin espacio para el futuro Knowledge Graph | Alto costo de migración futura | Modelo relacional con IDs estables + tabla de relaciones tipadas genérica (ver [04-modelo-datos.md](04-modelo-datos.md) §4.5), evaluar Graph DB solo cuando el relacional lo justifique |
| Exponer Transition AI de forma que permita extracción masiva del dataset | Pérdida del activo principal de la empresa | Guardrails en capa de herramientas + límites por plan, ver [06](06-arquitectura-ia.md) y [09](09-seguridad.md) |
| Acoplar la lógica de suscripción a componentes de UI | Reescritura costosa al cambiar de plan/pricing | Sistema de entitlements centralizado, UI solo lee capacidades resueltas ([08-modelo-suscripciones.md](08-modelo-suscripciones.md)) |
| Sobre-construir para LATAM antes de validar Chile | Retraso del MVP, complejidad prematura | `country_code` como parámetro desde el día 1, sin tablas ni UI multi-país reales hasta que exista un segundo mercado |
| Falta de distinción dato-verificado vs. estimado en la UI | Riesgo reputacional/legal para ONIX | Campo de confianza obligatorio y visible en cada dato relevante ([04](04-modelo-datos.md) §4.3) |
| Dependencia de un único proveedor de modelos de IA | Riesgo de vendor lock-in y de continuidad | Capa de abstracción de proveedor de IA desde el día 1 ([06-arquitectura-ia.md](06-arquitectura-ia.md)) |
