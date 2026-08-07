# Ficha de proyecto — sección Propiedad siempre visible + íconos de ayuda

**Estado:** aprobado para preparación
**Fecha:** 2026-08-06
**Alcance:** `app/(public)/proyectos/[id]/page.tsx` y componentes asociados

## 1. Objetivo

Dos mejoras independientes pero relacionadas en la ficha pública de proyecto:

1. La sección **Propiedad** no debe desaparecer cuando aún no existe el mapeo societario de un proyecto verificado — debe mostrar un estado neutro "en proceso" en vez de ocultarse.
2. Cada título de sección de la ficha debe llevar un ícono **(i)** que explique brevemente, al pasar el mouse o tocar, qué información muestra esa sección.

## 2. Sección Propiedad

### 2.1 Nombre

Se simplifica el título de la sección: **"Propiedad"** (antes "Propiedad y grupo empresarial"), en ambos idiomas — **"Ownership"** (antes "Ownership and corporate group").

### 2.2 Cuándo se muestra

Hoy (`page.tsx:493`) la sección solo se renderiza si `ownershipMap !== null`, y `ownershipMap` solo se calcula si `project.verifiedAt` existe. Esto oculta la sección por completo en cualquier proyecto verificado que aún no tenga su cadena societaria cargada.

**Cambio:** la sección se renderiza siempre que `project.verifiedAt` exista, independientemente de si `ownershipMap` es `null`. Proyectos no verificados siguen sin mostrar la sección (la curación de propiedad es un trabajo posterior a la verificación, no tiene sentido prometerla antes).

### 2.3 Qué se muestra cuando no hay datos

`ProjectOwnershipSection` pasa a aceptar `map: ProjectOwnershipMap | null` (hoy es obligatorio). Cuando `map` es `null`, se ignora el flag `locked` (plan free/Prime) — no hay nada que vender todavía, así que se muestra el mismo aviso neutro a todos los usuarios:

- Panel con el mismo lenguaje visual del resto de la ficha (`rounded-2xl border`, sin blur ni candado).
- Ícono de reloj (`Clock` de lucide-react).
- ES: "Mapeo societario en proceso" / "Todavía estamos construyendo la cadena societaria de este proyecto. Vuelve pronto."
- EN: "Ownership mapping in progress" / "We are still building this project's corporate ownership chain. Check back soon."

Cuando `map` no es `null`, el comportamiento actual no cambia (paywall `OwnershipPreview` si `locked`, árbol societario completo si no).

## 3. Íconos de ayuda (i) en títulos de sección

### 3.1 Componente `InfoTooltip`

Nuevo client component en `app/(public)/components/InfoTooltip.tsx`:

- Botón circular pequeño con ícono `Info` (lucide-react, 13px), sin texto visible, `aria-label` fijo por locale ("Más información" / "More information").
- Estado local `open` (`useState`). Se abre con `onMouseEnter`/`onFocus`, se cierra con `onMouseLeave`/`onBlur`; `onClick` alterna el estado (cubre tap en touch, donde no hay hover).
- Al abrir: listener de `click` fuera del componente y de tecla `Escape` para cerrar (se registra solo mientras `open === true`, se limpia al cerrar/desmontar).
- Tooltip: `absolute`, posicionado sobre el ícono, `role="tooltip"`, vinculado por `aria-describedby` al botón; `max-w-64`, `text-xs`, `rounded-lg border shadow-lg`, fondo `bg-white dark:bg-neutral-900` con borde `border-neutral-200 dark:border-neutral-700` (consistente con el resto de paneles flotantes de la ficha).
- Prop única: `text: string` (el llamador ya resuelve el locale antes de pasarlo, como el resto del archivo).

### 3.2 Integración

- `SectionLabel` (interno a `page.tsx`) gana un prop opcional `info?: string`. Cuando está presente, envuelve el `<h2>` y el `<InfoTooltip>` en un `<div className="flex items-center gap-1.5">`. Sin `info`, el render es idéntico al actual (sin wrapper extra).
- Los dos títulos que no usan `SectionLabel` (`project-description-title` y el `h2` de Propiedad) reciben el `InfoTooltip` a mano, dentro de su contenedor flex existente.

### 3.3 Copys (ES / EN) por sección

| Sección | ES | EN |
|---|---|---|
| Descripción | Resumen generado automáticamente a partir de los datos técnicos y de ubicación del proyecto. | Automatically generated summary based on the project's technical and location data. |
| Estado teórico del Proyecto | Estimación propia de en qué etapa debería estar el proyecto hoy, según su fecha de conexión declarada. | Our own estimate of what stage the project should be at today, based on its declared connection date. |
| Health Score | Puntaje propio (0–100) que combina el avance del trámite de conexión y el avance ambiental SEIA; no es un dato oficial. | Our own score (0–100) combining connection permitting progress and SEIA environmental progress; not an official figure. |
| Construcción física reportada | Porcentaje de avance físico de obra reportado oficialmente en el Programa de Grandes Proyectos (PGP) del Coordinador Eléctrico Nacional. | Physical construction progress officially reported in the National Electricity Coordinator's Major Projects Program (PGP). |
| Avance de tramitación | Estado actual del trámite de conexión al sistema eléctrico y, si aplica, del trámite ambiental (SEIA/Pertinencia). | Current status of the grid connection process and, if applicable, the environmental process (SEIA/Pertinencia). |
| Etapa estimada de desarrollo | Modelo probabilístico que calcula hacia atrás desde la fecha de conexión estimada para ubicar al proyecto en una etapa de desarrollo típica de mercado. | Probabilistic model that works backward from the estimated connection date to place the project in a typical market development stage. |
| Contacto | Datos de contacto de las personas vinculadas al proyecto o a la empresa desarrolladora. | Contact details for people linked to the project or the developer company. |
| Estado ambiental | Estado del expediente ambiental del proyecto en el SEIA, incluyendo pertinencias cuando corresponde. | Status of the project's environmental filing with the SEIA, including pertinencia filings when applicable. |
| Empresas relacionadas | Otras empresas que el Coordinador Eléctrico Nacional agrupa junto al desarrollador bajo el mismo grupo corporativo. | Other companies the National Electricity Coordinator groups with the developer under the same corporate group. |
| Propiedad | Cadena societaria verificada manualmente: quién es dueño de la SPV del proyecto y quién controla en última instancia. | Manually verified corporate chain: who owns the project's SPV and who the ultimate controller is. |
| Proyectos relacionados | Otros proyectos activos vinculados por mismo RUT, SPV, grupo empresarial o contactos corporativos compartidos. | Other active projects linked by the same RUT, SPV, corporate group, or shared corporate contacts. |

## 4. Fuera de alcance

- No se toca el criterio de elegibilidad del sync de PGP (`isDeclaredConstructionStatus` + NUP) — ya coincide con lo esperado, confirmado como correcto en esta misma conversación.
- No se añade upsell de Prime al estado "en proceso" de Propiedad — es un estado neutro, no promocional.
- No se traduce este patrón de `InfoTooltip` a otras páginas del sitio en este trabajo; queda disponible como componente compartido para uso futuro.

## 5. Testing

- Verificación visual manual con `npm run dev`: una ficha de proyecto verificado sin mapeo societario (confirmar "en proceso"), una con mapeo completo (confirmar que no cambió), hover/tap de al menos 3 íconos (i) en desktop y una pasada rápida en viewport mobile (el tap-toggle es la parte nueva de interacción).
- No aplica testing automatizado nuevo — es un cambio de presentación sin lógica de negocio nueva más allá del cambio de condición en `page.tsx`.
