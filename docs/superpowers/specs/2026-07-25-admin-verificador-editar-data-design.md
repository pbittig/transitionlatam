# Sección Admin: Verificador de proyecto + Editar data

**Fecha:** 2026-07-25
**Estado:** Aprobado por el usuario, pendiente de plan de implementación

## Contexto

El usuario pidió una nueva sección "Admin" en el menú (arriba del bloque de perfil,
mismo lugar donde hoy termina el nav), con tres módulos: un "Verificador de proyecto"
(revisión humana de la ficha, una sola vez por proyecto, con auto-save y un botón
"Verificado"), "Editar data" (edición libre de cualquier ficha en cualquier momento), y
"Editar web" (editar textos del sitio público).

Se decidió con el usuario dividir esto en specs separados porque son subsistemas
distintos: Verificador y Editar data comparten la misma base de datos (`project`) y el
mismo formulario de edición, mientras que "Editar web" es un subsistema aparte — hoy
todo el copy del sitio está hardcodeado en JSX, no existe ningún sistema de contenido
editable, y el usuario prefirió arrancar acotado (bloques específicos, a definir) en vez
de un CMS completo desde el día uno. **Este documento cubre solo Verificador + Editar
data.** "Editar web" queda para una sesión de diseño aparte.

También se conversó sobre conectar Kimi (LLM) como capa de verificación automática de
los datos (y para elegir entre varios candidatos SEIA), pero no hay datos de qué tan
efectivo sería Kimi en esa tarea de juicio (solo se comparó extracción de campos, no
verificación). El usuario confirmó que el Verificador se construye primero como cola
100% humana; Kimi queda como una capa a evaluar después con un piloto, sin bloquear esta
entrega.

Contexto técnico relevante ya existente que este diseño reutiliza:

- `isAdmin()` (`lib/auth/session.ts`) — admin único vía cookie jose, no hay múltiples
  usuarios admin ni tabla de usuarios para ese rol. Por eso no se registra "quién"
  verificó o editó, solo "cuándo".
- El patrón de gating admin-only en página completa ya existe en `/alertas`: si
  `!isAdmin()`, se muestra un mensaje "solo para administradores" + link a login, en vez
  de un 404.
- El patrón de escritura admin-only con `service_role` client ya existe en
  `seiaActions.ts` / `watchlistActions.ts` / `crmActions.ts` — server actions que
  verifican `isAdmin()` en el server antes de tocar la base.
- `SeiaMatchModal` (`app/(public)/proyectos/[id]/SeiaMatchModal.tsx`) ya permite
  reasociar manualmente el expediente SEIA de un proyecto — se reutiliza tal cual, no se
  reconstruye.
- Los contactos (`RevealStakeholders`) quedan de solo lectura, sin cambios — no entran en
  el alcance de edición de este documento.

## Cambios de datos

Migración nueva `supabase/migrations/20260725000000_project_verification.sql`:

```sql
alter table project add column verified_at timestamptz;
```

Sin `verified_by`: al haber un solo admin, no aporta información. Sin backfill
especial — todas las filas existentes ya nacen con `verified_at null` por default de
Postgres, lo que automáticamente las deja en la cola inicial del Verificador (según lo
confirmado con el usuario: los ~2700+ proyectos actuales entran de una vez como backlog,
y todo proyecto nuevo ingresado después también nace `null`).

## Rutas y navegación

`Sidebar.tsx`: se agrega `{ href: "/admin", label: "Admin", icon: ShieldCheck }` al
arreglo `navItems` condicional a `isAdmin` (mismo mecanismo que ya usa "Seguimiento"),
como **último** elemento — queda inmediatamente arriba del bloque de perfil, que ya está
separado por su propio `border-t` debajo del `<nav>`.

Nuevo route group `app/(public)/admin/`:

- `admin/layout.tsx` — gating único: si `!isAdmin()`, renderiza el mismo mensaje
  "solo para administradores" que usa `/alertas` (evita repetirlo en cada página hija).
- `admin/page.tsx` — landing simple con dos tarjetas: "Verificador" (con el conteo de
  pendientes) y "Editar data", cada una linkeando a su sección.
- `admin/verificador/page.tsx` — la cola.
- `admin/verificador/[id]/page.tsx` — ficha en modo edición + botón "Verificado".
- `admin/editar-data/page.tsx` — buscador/listado de todos los proyectos.
- `admin/editar-data/[id]/page.tsx` — ficha en modo edición, sin botón "Verificado".

## Formulario de edición compartido

Nuevo componente `app/(public)/admin/components/ProjectEditForm.tsx` (client component),
usado por ambas rutas `[id]`. Campos editables (los mismos que hoy se muestran de solo
lectura en `/proyectos/[id]`):

nombre, RUT de la empresa desarrolladora, dirección legal, SPV, tipo de solicitud,
potencia de generación (MW), potencia de almacenamiento (MW), energía (MWh), horas de
almacenamiento, punto de conexión, nivel de tensión (kV), NUP, estado, fecha estimada de
conexión.

El match SEIA no se edita en este formulario — se deja el botón existente de
`SeiaMatchModal` embebido en la misma página, igual que en la ficha pública.

**Auto-save:** campos de texto/número guardan `onBlur`; selects y el date picker de
fecha estimada guardan `onChange`. Cada campo muestra un indicador de estado chico
("Guardando…" / "Guardado ✓" / "Error — reintentar") que no descarta el valor escrito si
falla el guardado (se mantiene en el input, el usuario puede reintentar).

**Escritura:** nueva server action `app/(public)/admin/projectEditActions.ts`:

- `updateProjectField(projectId: string, field: EditableProjectField, value: unknown)`
  — verifica `isAdmin()` en el server, valida `field` contra una whitelist explícita de
  columnas editables (nunca acepta un nombre de columna arbitrario del cliente), escribe
  con `createSupabaseServiceClient()`, revalida la ruta.
- `markProjectVerified(projectId: string)` — verifica `isAdmin()`, hace
  `update project set verified_at = now() where id = projectId`.

Ambas devuelven `{ success: boolean; error?: string }`, mismo shape que `seiaActions.ts`.

## `/admin/verificador` — la cola

Lista los proyectos con `verified_at is null`. Orden: mismo criterio "esperados
primero" que ya usa `scripts/sync-formulario-bulk.ts` — vigentes (no rechazados/no
desistidos, con fecha de conexión desde el inicio del mes actual en adelante) ordenados
por fecha de conexión más próxima, y después el resto. Cada fila muestra nombre, comuna/
región, capacidad y fecha estimada de conexión, con link "Revisar" a
`/admin/verificador/[id]`.

En `/admin/verificador/[id]`: la misma información que la ficha pública (usando
`ProjectEditForm` en vez de los `Field` de solo lectura), el bloque de SEIA con
`SeiaMatchModal`, y un botón prominente **"Verificado"** que llama a
`markProjectVerified` y — dado que es una cola — redirige automáticamente al siguiente
proyecto pendiente (o a `/admin/verificador` con un mensaje "cola vacía" si no queda
ninguno).

Una vez verificado, el proyecto sale de la cola para siempre: no hay mecanismo
automático de "des-verificar" ni de re-entrar a la cola por una edición posterior desde
Editar data. Si el admin quiere forzar una re-verificación, es una acción manual futura
fuera de este alcance (se podría limpiar `verified_at` a mano desde la base si hiciera
falta, no se construye UI para eso ahora).

## `/admin/editar-data`

Listado de todos los proyectos reutilizando `ProjectTable`/`SearchBar` ya existentes
(mismo patrón de filtros que `/proyectos-esperados`, sin los paneles de análisis). Cada
fila enlaza a `/admin/editar-data/[id]`, que muestra el mismo `ProjectEditForm`, pero sin
el botón "Verificado" — en su lugar, una etiqueta de solo lectura con el estado:
"Verificado el DD/MM/AAAA" o "Pendiente de verificación", según `verified_at`.

## Fuera de alcance (explícito)

- Sin Kimi ni ninguna verificación automática por IA — cola 100% humana. Se evalúa
  después con un piloto separado.
- Sin edición de contactos (personas) — siguen de solo lectura vía `RevealStakeholders`.
- Sin re-entrada automática a la cola tras editar un proyecto ya verificado.
- Sin registro de "quién" verificó/editó — solo hay un admin.
- "Editar web" no es parte de este documento — spec aparte pendiente.

## Testing

- `npx tsc --noEmit` y `npm run lint` limpios.
- Migración: confirmar que corre sin romper filas existentes (columna nueva nullable,
  sin default problemático).
- Manual: entrar como admin, confirmar que "Admin" aparece en el nav arriba del perfil y
  no aparece para un visitante no autenticado; abrir `/admin/verificador`, confirmar que
  lista ~2700+ proyectos pendientes; editar un campo y confirmar que autoguarda (recargar
  la página y ver el valor persistido); click en "Verificado" y confirmar que el proyecto
  desaparece de la cola y que redirige al siguiente; ir a `/admin/editar-data`, buscar ese
  mismo proyecto y confirmar que muestra "Verificado el [fecha]"; editar otro proyecto
  desde Editar data y confirmar que NO aparece en la cola del Verificador.
