# 07 — Inteligencia de Leads e Intent Engine

## 7.1 Objetivo

Convertir comportamiento observable dentro de la plataforma en una señal accionable para el equipo comercial de ONIX, sin sobre-construir un motor de ML antes de tener datos suficientes para entrenarlo (ver ambigüedad #3 en [02-prd.md](02-prd.md) §2.5).

## 7.2 Modelo de datos (resumen; detalle completo vive en [04-modelo-datos.md](04-modelo-datos.md))

```
user_profile        -- toda persona registrada
  id, email, name, company_name, role, country, industry,
  user_type (Developer|Investor|EPC|...), interests[], created_at

behavior_event       -- evento crudo, append-only
  id, user_profile_id (nullable si aún anónimo, con session_id),
  event_type ('project_view','ai_query','filter_applied','report_generated', ...),
  entity_type, entity_id, metadata (jsonb), occurred_at

lead_score            -- snapshot calculado, recalculado periódicamente o por trigger
  id, user_profile_id, engagement_score, intent_score,
  commercial_fit_score, market_fit_score, onix_opportunity_score,
  calculated_at

lead                   -- una vez el score cruza el umbral, o se marca manualmente
  id, user_profile_id, status ('new','exported','working','won','lost'),
  onix_opportunity_score, exported_at, crm_reference_id
```

`behavior_event` es la fuente de verdad; los scores son vistas calculadas, nunca el lugar donde se pierde información cruda — esto permite rediseñar el algoritmo de scoring más adelante sin perder el historial.

## 7.3 ONIX Opportunity Score (modelo conceptual)

```
ONIX Opportunity Score = f( Engagement Score, Intent Score, Commercial Fit, Market Fit )
```

| Componente | Qué mide | Ejemplos de señal |
|---|---|---|
| **Engagement Score** | Actividad y profundidad de uso | # de sesiones, tiempo en plataforma, # de proyectos vistos, # de consultas a Transition AI |
| **Intent Score** | Especificidad de la búsqueda del usuario | Filtros usados (tecnología+región+capacidad específicos), consultas IA sobre financiamiento/socios/entrada a mercado, uso del Opportunity Finder |
| **Commercial Fit** | Qué tan bien encaja el usuario con los servicios de ONIX | Tipo de usuario, cargo (ej. "Director de Desarrollo de Negocios" pondera más que "Analista"), tamaño de empresa si se conoce |
| **Market Fit** | Alineación con los mercados/tecnologías estratégicos de ONIX en el momento | Configurable por ONIX — ej. priorizar BESS en Chile en 2026 |

**Diseño explícito:** en el MVP, `f()` es una **función ponderada simple y transparente** (suma ponderada configurable vía panel de admin), no un modelo de ML. Esto es intencional: con volumen bajo de datos iniciales, un modelo de ML no tiene con qué entrenar y además sería opaco para el equipo comercial que necesita confiar y ajustar el criterio manualmente. La arquitectura deja el punto de extensión (`/lib/leads/scoring.ts`) listo para reemplazar la función por un modelo entrenado cuando exista suficiente historial de leads "ganados/perdidos" para supervisar el aprendizaje.

## 7.4 Umbral y notificación

- Umbral configurable (no hardcodeado) que determina cuándo un `user_profile` se convierte formalmente en `lead` y dispara notificación/exportación.
- Notificación inicial (MVP): email/Slack al equipo comercial + registro en el CRM vía el adaptador correspondiente (ver §7.5). No se requiere una UI de gestión de leads dentro de Transition LATAM en el MVP — el CRM de ONIX sigue siendo el sistema de gestión comercial.

## 7.5 Capa de abstracción de integración con CRM

```
/lib/leads/crm
  adapter.ts           -- interfaz: pushLead(lead), updateLeadStatus(id, status)
  zoho.ts               -- implementación concreta (si se confirma Zoho)
  hubspot.ts             -- alternativa
  webhook.ts             -- fallback genérico (POST a URL configurable) — útil como implementación mínima del MVP
  index.ts               -- selector por configuración
```

Regla arquitectónica (ADR-009 en [DECISIONS.md](DECISIONS.md)): el resto del sistema llama siempre a `adapter.ts`, nunca a un SDK de CRM específico directamente. Mientras no se confirme el CRM real de ONIX (ver ambigüedad #4 en [02-prd.md](02-prd.md)), el MVP puede lanzar con el adaptador `webhook.ts` genérico sin bloquear el resto del desarrollo.

## 7.6 Funnel → estados (referencia)

Ver diagrama de funnel completo en [03-modelo-negocio.md](03-modelo-negocio.md) §3.3. Este documento cubre la implementación técnica de los pasos "Detección de intención" → "Lead Scoring" → "CRM de ONIX".

## 7.7 Privacidad y consentimiento

La captura de `behavior_event` para usuarios anónimos debe limitarse a datos de sesión no identificables hasta el registro; al registrarse, el usuario debe ser informado (términos de uso/política de privacidad) de que su actividad se usa para calificación comercial. Esto no es opcional: es un requisito legal en la mayoría de las jurisdicciones LATAM (y explícitamente relevante dado que el negocio depende de este tracking). Se recomienda validar el texto legal con el equipo legal de ONIX antes del lanzamiento — marcado como acción pendiente, no arquitectónica.
