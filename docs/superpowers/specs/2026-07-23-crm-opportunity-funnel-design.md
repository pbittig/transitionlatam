# CRM: funnel de 7 etapas, alta rápida desde la ficha, búsqueda, y filtro de etapa en Proyectos futuros

**Fecha:** 2026-07-23
**Estado:** Aprobado por el usuario, pendiente de plan de implementación

## Contexto

El CRM interno (`/crm`) ya existe y funciona: tabla `opportunity` en Supabase, tablero
Kanban, acción para mover de etapa. Lo que falta es lo que pidió el usuario:

1. Un funnel de ventas más corto y con nombres propios, en vez del funnel genérico de 8
   etapas que hay hoy.
2. Poder agregar un proyecto al CRM directamente desde su ficha (`/proyectos/[id]`) — hoy
   solo existe el botón de "seguir" (watchlist), no uno de alta comercial.
3. Buscar dentro de las oportunidades ya cargadas en el tablero.
4. Un filtro por **etapa estimada de desarrollo** en `/proyectos-esperados` ("Proyectos
   futuros") — para que una empresa de ingeniería que busca proyectos tempranos, o un
   vendor que busca proyectos en etapa de compras, puedan acotar la lista sin tener que
   abrir cada ficha.

Los puntos 1-3 son el mismo subsistema (CRM comercial). El punto 4 es independiente —
usa el modelo de cronograma que ya existe (`computeEstimatedPhase`), no toca la tabla
`opportunity` para nada. Se documentan juntos porque surgieron en la misma conversación,
pero son implementables y probables por separado.

## A. Funnel de 7 etapas

### Etapas nuevas

```
contacto → reunion → elaboracion_propuesta → envio_propuesta → seguimiento → cierre_ganado | cierre_perdido
```

Reemplaza el enum actual de 8 etapas (`identificada, investigando, contacto_pendiente,
contactada, conversacion, propuesta, ganada, perdida`) en:

- `lib/shared/opportunityStages.ts` (nuevo — hoy vive inline en
  `lib/data-access/opportunities.ts`; se separa porque tanto `/crm` como el botón nuevo
  de la ficha de proyecto van a necesitar `OPPORTUNITY_STAGES`/`OPPORTUNITY_STAGE_LABEL`
  sin arrastrar el resto de `opportunities.ts`).
- El `CHECK` constraint de `opportunity.stage` en Supabase.
- `BOARD_STAGES` en `app/(public)/crm/page.tsx` — pasa a incluir las 7 etapas (hoy
  excluye `ganada`/`perdida` del tablero; las nuevas `cierre_ganado`/`cierre_perdido` sí
  se muestran, como columnas finales, para que el resultado quede visible en el tablero
  mismo en vez de solo en las métricas).

### Migración de datos

Nueva migración `supabase/migrations/20260723000001_crm_funnel_7_stages.sql`:

1. Dropea el `CHECK` viejo, hace `UPDATE` de las filas existentes con el mapeo:

   | Etapa vieja | Etapa nueva |
   |---|---|
   | `identificada`, `investigando`, `contacto_pendiente`, `contactada` | `contacto` |
   | `conversacion` | `reunion` |
   | `propuesta` | `elaboracion_propuesta` (no hay forma de distinguir "elaborando" de "ya enviada" con el dato viejo — se asume la más conservadora) |
   | `ganada` | `cierre_ganado` |
   | `perdida` | `cierre_perdido` |

2. Agrega el `CHECK` nuevo con las 7 etapas.
3. Cambia el `DEFAULT` de la columna de `'identificada'` a `'contacto'`.

### Bug de paso: tablero vacío no muestra las columnas

Al revisar `app/(public)/crm/page.tsx` para este trabajo se encontró la razón de que
"no se vean las etapas" hoy: cuando `opportunities.length === 0`, la página reemplaza
**todo** el tablero por un mensaje de estado vacío — las columnas de etapa nunca se
renderizan hasta que exista al menos una oportunidad. Se corrige junto con lo demás: el
tablero (7 columnas, con conteo en 0) se muestra siempre; el mensaje de "no hay
oportunidades todavía" pasa a ser una nota liviana arriba del tablero, no un reemplazo.

## B. Botón "Agregar al CRM" en la ficha del proyecto

Mismo patrón que `FollowButton`/`toggleFollow` (`app/(public)/proyectos/[id]/FollowButton.tsx`,
`app/(public)/watchlistActions.ts`), al lado de ese botón:

- **Componente nuevo** `AddToCrmButton.tsx` (client component), recibe `projectId`,
  `developerCompanyId` (de `project.developerCompanyId`, ya existe en `ProjectDetail`), y
  `initiallyInCrm: boolean`.
- **Server action nueva** `addProjectToOpportunities` en un archivo `crmActions.ts` junto
  a `watchlistActions.ts` (mismo nivel, mismo patrón: `isAdmin()` gate, `revalidatePath`).
  Un solo click:
  ```ts
  insert into opportunity (
    project_id: projectId,
    company_id: developerCompanyId, // null si el proyecto no tiene desarrolladora identificada
    stage: 'contacto',
    description: `Proyecto: ${projectName}`, // autogenerado, editable después desde /crm
    confidence_level: 'INTELIGENCIA_DE_MERCADO',
  )
  ```
- **Estado "ya agregado":** antes de renderizar el botón, la página del proyecto
  consulta si ya existe una oportunidad con ese `project_id` en una etapa no cerrada
  (`stage NOT IN ('cierre_ganado','cierre_perdido')`). Si existe, el botón se reemplaza
  por un link "Ver en CRM →" hacia `/crm#opportunity-{id}` en vez de permitir duplicar.
  Si la única oportunidad previa está cerrada, se permite crear una nueva (reapertura).

## C. Buscador dentro de `/crm`

Un input de texto arriba del tablero (client component `OpportunitySearch.tsx`), filtra
las tarjetas ya cargadas por nombre de proyecto, empresa o persona — sobre los datos que
`getOpportunityBoard` ya trae (tope 100 filas), sin ida adicional a la base de datos por
cada tecla. Mismo patrón de filtrado en memoria que ya usa `BubbleChart`/otros
componentes client-side del proyecto.

## D. Filtro de "Etapa estimada" en Proyectos futuros

### Agrupación (5 opciones, no las 10 etapas exactas del modelo)

| Opción del filtro | `PhaseKey`s que agrupa |
|---|---|
| Desarrollo temprano | `campana_viento`, `desarrollo`, `conceptual` |
| Ingeniería | `basica`, `detalle`, `factibilidad` |
| Compras | `compras` |
| Construcción | `construccion` |
| Comisionamiento / Pruebas | `comisionamiento`, `pruebas` |

Nuevo mapeo `PHASE_GROUP` en `lib/shared/projectPhaseDurations.ts` (junto a
`PHASE_LABELS`), reutilizado por el filtro.

### Cómo se calcula (sin tocar la base de datos)

`computeEstimatedPhase()` ya existe y ya corre sobre `getUpcomingScheduleInputs()` (el
dataset completo de proyectos vigentes, sin paginar, que la página ya trae para los
gráficos de análisis). El filtro nuevo:

1. Calcula la etapa actual de cada proyecto de `scheduleInputs` (igual que ya hace el
   Gantt agregado), la agrupa con `PHASE_GROUP`.
2. Si el usuario eligió una opción del filtro, reduce `scheduleInputs` a los proyectos
   de ese grupo y saca su lista de `project.id`.
3. Esa lista de IDs se pasa a `listProjects()` como un filtro adicional (`.in("id", ...)`,
   nuevo campo `projectIds?: string[]` en `ProjectFilters`) — así la tabla paginada
   respeta el filtro sin tener que traer y paginar en memoria todos los proyectos.

### UI

Un `<select>` nuevo junto al selector de tecnología en el panel de filtros de
`/proyectos-esperados`, mismo estilo que el `<select>` de estado en `/mercado`. Se
combina con los filtros existentes (tecnología, búsqueda) con lógica AND.

## Fuera de alcance (explícito)

- No se toca el funnel de *proyecto* (SEIA/RCA/construcción) que ya existe en
  `get_pipeline_funnel()` — es un concepto totalmente distinto al funnel *comercial* de
  este documento, aunque comparten la palabra "funnel".
- El buscador de C no busca proyectos que **no** están en el CRM — para eso está el
  botón de B, desde la ficha del proyecto.
- No se agrega edición inline de `owner_name`/`next_step` en las tarjetas del tablero —
  eso ya existe vía el formulario "Nueva oportunidad" y queda igual.
- El filtro de etapa de D es de solo lectura (no se puede fijar manualmente una etapa
  distinta a la calculada) — sigue siendo un modelo probabilístico, no un dato editable.

## Testing

- `npx tsc --noEmit` limpio.
- Migración: correr contra una copia de la base (o verificar manualmente que no haya
  filas con `stage` fuera de las 7 nuevas después del `UPDATE`).
- Manual: agregar un proyecto al CRM desde su ficha, confirmar que aparece en la columna
  "Contacto" de `/crm`; mover una tarjeta por las 7 etapas; buscar en el tablero;
  filtrar Proyectos futuros por cada una de las 5 opciones de etapa y confirmar que la
  cuenta de resultados baja de forma razonable.
