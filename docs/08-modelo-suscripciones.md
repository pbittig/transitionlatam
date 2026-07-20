# 08 — Modelo de Suscripciones (Entitlements)

## 8.1 Principio rector

La lógica de "qué puede hacer/ver este usuario" nunca vive en componentes de UI ni se hardcodea como `if (user.plan === 'business')` disperso por el código. Vive en un **sistema de entitlements centralizado** que UI, API y Transition AI consultan de la misma forma. Esto es lo que permite lanzar el MVP sin cobro directo (todos en un plan Free efectivo) y activar suscripciones reales después sin reescribir producto (ver [03-modelo-negocio.md](03-modelo-negocio.md) §3.6).

## 8.2 Modelo de datos

```
plan
  id, code ('free','professional','business','enterprise'), name, description

feature
  id, code ('advanced_filters','ai_extended','opportunity_scoring',
             'company_intelligence','custom_dashboards','report_builder', ...)

plan_feature            -- qué features incluye cada plan
  plan_id, feature_id, limit_config (jsonb — ej. { "ai_queries_per_month": 50 })

organization             -- cuenta B2B (opcional en MVP si el uso es individual)
  id, name, plan_id, billing_status

user_profile.organization_id   -- nullable; si es null, el plan aplica al usuario individual

entitlement_override      -- excepciones puntuales (ej. cortesía Enterprise a un partner)
  user_profile_id | organization_id, feature_id, limit_config, expires_at
```

## 8.3 Planes (según brief, cualitativo — sin pricing aún)

| Plan | Incluye (resumen) |
|---|---|
| **Free** | Dashboard público, acceso básico a proyectos, Transition AI limitado, perfiles básicos |
| **Professional** | Filtros avanzados, más detalle de proyecto, IA ampliada, comparación de proyectos, reportes avanzados, Stakeholder Intelligence |
| **Business** | Inteligencia avanzada, Opportunity Scoring, Company Intelligence, mayor uso de IA, análisis de oportunidades |
| **Enterprise** | Dashboards personalizados, datasets personalizados, agentes IA personalizados, integraciones dedicadas, advisory de ONIX |

Pricing y el momento exacto de activar cobro son decisiones de negocio pendientes (ver ambigüedad #8 en [02-prd.md](02-prd.md)) — no bloquean la construcción del sistema de entitlements.

## 8.4 Resolución de entitlements (cómo se usa en runtime)

```
/lib/entitlements
  resolve.ts     -- resolveEntitlements(userProfile) => { features: Set, limits: {...} }
  guard.ts        -- requireFeature(entitlements, 'opportunity_scoring') — usado en API/data-access
  fieldAccess.ts  -- ¿este campo del proyecto requiere qué plan mínimo? (ligado a field_registry, ver 04 §4.10)
```

Todo endpoint de API y toda tool de Transition AI llaman a `guard.ts` antes de devolver datos restringidos — no hay una segunda ruta que los evite. La UI solo **refleja** el resultado de `resolveEntitlements` (ej. mostrar un candado o un CTA de upgrade); nunca decide por sí misma qué mostrar.

## 8.5 Billing

No se integra un proveedor de billing en el MVP (no hay cobro). Se deja preparada la interfaz (`organization.billing_status`, `plan_id`) para conectar un proveedor (ej. Stripe) en la fase de activación de suscripciones, vía un adaptador análogo al de CRM ([07-inteligencia-leads.md](07-inteligencia-leads.md) §7.5) — mismo principio de no acoplar el dominio a un proveedor externo específico.

## 8.6 Relación con protección de datos

Los límites de uso definidos aquí (consultas de IA por período, resultados máximos, features visibles) son el mecanismo primario de protección del dataset frente a extracción — se detalla el enforcement técnico en [09-seguridad.md](09-seguridad.md). Ningún plan, incluido Enterprise, otorga exportación masiva irrestricta (ver [09](09-seguridad.md) §9.4); Enterprise obtiene datasets personalizados vía proceso gestionado por ONIX, no vía autoservicio irrestricto.
