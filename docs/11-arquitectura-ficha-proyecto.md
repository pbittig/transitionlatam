# 11 — Arquitectura de información de la Ficha de Proyecto

> **Superado en parte por [12-ficha-proyecto-datos-reales.md](12-ficha-proyecto-datos-reales.md)**, que rehace el diseño usando sólo datos que hoy existen. Donde ambos se contradigan, manda el 12 — incluidas tres afirmaciones de este documento que el perfilado de datos desmintió (PGP sí expone fechas reales de PES/EO en el payload que ya guardamos; `completition_pes` vale 0 siempre y no sirve como hito de puesta en servicio; PELP dejó de ser inexistente). Este documento sigue vigente como marco conceptual: planos oficial/normalizado/estimado, matriz de fuente de verdad y reglas de conflicto.

**Estado:** propuesta funcional. No implementada.
**Fecha:** 2026-08-11
**Alcance:** qué debe mostrar la ficha de un proyecto energético, con qué fuente respalda cada dato, cómo se normaliza, cómo se resuelven conflictos entre fuentes y qué se puede afirmar hoy con la data que ya tenemos.

Documento hermano de [04-modelo-datos.md](04-modelo-datos.md) (esquema) y [02-prd.md](02-prd.md) §2.3 (regla de no presentar estimaciones como hechos).

---

## 0. Resumen ejecutivo

**Lo que hay hoy es sólido en ingesta y débil en representación.** El pipeline de Acceso Abierto cubre 2.096 proyectos con estado, punto de conexión y fecha declarada de conexión, actualizado a diario; PGP aporta avance físico real; SEIA y pertinencias están conectados. Pero la ficha presenta todo eso a través de **un solo eje** — el estado crudo del trámite de conexión — y de **un modelo estimado hacia atrás desde el COD** que ocupa el lugar donde debería ir la evidencia.

Seis hallazgos que condicionan toda la propuesta:

1. **No existe un estado normalizado.** `project.status` guarda el texto crudo de la fuente: 28 variantes para ~14 estados reales, con duplicados de mayúsculas ("Proyecto autorizado para declararse en construcción" 385 filas + "Proyecto Autorizado para Declararse en Construcción" 113). La tabla `connection_status` existe con 39 códigos —también con slugs duplicados— y **nadie la referencia**: la normalización real vive hardcodeada en [projectStatusMaturity.ts](../lib/shared/projectStatusMaturity.ts).
2. **"Declarado en construcción" se toma del Coordinador, no de CNE.** La nómina oficial de CNE (`construction_project`, 193 filas) no tiene `project_id`, no está vinculada a ningún proyecto, se carga a mano y está congelada en la resolución del 2026-06-30, sincronizada el 2026-07-22.
3. **El cronograma que ve el usuario es una inferencia pura.** [computeEstimatedPhase](../lib/shared/computeEstimatedPhase.ts) resta duraciones típicas desde la fecha declarada de conexión para ubicar ingeniería, compras y construcción. Está correctamente etiquetado como estimación, pero es la única representación de esas etapas: no hay un solo hito de ingeniería/EPC respaldado por fuente.
4. **La provenance existe y está subutilizada.** `data_attribution` tiene 10.065 filas pero sólo 5 campos (`status`, `estimated_connection_date`, `capacity_mw`, `technology_id`, `capacity_mwh`), sin URL de origen, y **no se muestra en la ficha**. `project_event` tiene 2.388 filas —incluidos 94 cambios de estado y 37 hitos SEIA— y **tampoco se muestra**.
5. **Hay datos que ya extraemos y tiramos.** El Formulario del Coordinador entrega coordenadas UTM y fechas estimadas de construcción y operación: ninguna se persiste (`location.latitude` = 0 de 260 filas; `project.construction_start_date` = 0 de 2.096). PGP devuelve `completition_pes` (avance de puesta en servicio) en cada llamada y se descarta.
6. **PELP y SII no existen** en el código ni en la base. Ninguna referencia en `lib/`, `app/`, `supabase/` ni `docs/`.

**La propuesta**, en una línea: separar en la ficha tres planos que hoy están mezclados —*lo que dice la fuente oficial*, *lo que Transition Latam concluye*, y *lo que Transition Latam estima*—, con una regla de oro: **ningún hito se afirma sin un evento fechado y una fuente citable**.

---

## 1. Auditoría de fuentes

Siete fuentes registradas en `data_source` + un motor de análisis interno (IA). Frecuencias reales tomadas de [scripts/run-syncs.ps1](../scripts/run-syncs.ps1) y `cron_run_log`.

### 1.1 Acceso Abierto — Listado de solicitudes (Coordinador Eléctrico Nacional)

| | |
|---|---|
| **Endpoint** | `https://pkb3ax2pkg.execute-api.us-east-2.amazonaws.com/prod/data/public?tipo=6` (sin auth, sin paginación, ~2.766 filas) |
| **Frecuencia** | Diaria (`sync-listado`, ~30 min por pasada) |
| **Última corrida** | 2026-08-11 20:25 (16 corridas, 2 fallidas) |
| **Cobertura** | 2.096 proyectos · 1.821 con NUP · 2.083 con punto de conexión y tensión · 2.050 con fecha estimada de conexión |
| **Confiabilidad** | **Alta** para identidad, estado y conexión. Es el registro administrativo del propio trámite. |

**Entrega:** id de solicitud, nombre de proyecto, NUP, empresa solicitante + razón social + RUT, tipo de solicitud, estado de solicitud, fecha de creación, tipo de proyecto, tipo de tecnología, potencias (NSI/NSR/CGA/CAA, energía, horas), fecha estimada de conexión, subestación, nivel de tensión, sección de barra, paño, región, comuna.

**Permite confirmar:** que existe una solicitud vigente; qué proceso es (SAC / SUCTD / Fehaciente); en qué etapa del trámite está; dónde se conecta y a qué tensión; qué fecha de conexión declaró el titular.

**NO permite confirmar:** avance físico de obras; situación ambiental; permisos sectoriales; derechos de terreno; si el proyecto realmente se está construyendo; fecha real de operación. Tampoco entrega potencia confiable: **sólo 28 de 2.766 filas traen potencia** (por eso `capacity_mw` está poblado en 552 de 2.096 proyectos).

**Ojo:** el estado llega con variantes de mayúsculas y tildes que la fuente misma mezcla. No es ruido nuestro: es la fuente.

### 1.2 Acceso Abierto — Formulario por proyecto (Nivel 2)

| | |
|---|---|
| **Origen** | PDF/XLSX del "Formulario SAC" (plantilla versionada, ej. `2504-FORM-SAC-V1`), descargado del portal y extraído con IA |
| **Frecuencia** | **A demanda** (`sync-formulario-bulk`, fuera del runner diario por costo de IA) |
| **Confiabilidad** | **Muy alta** — es un documento firmado por el titular |

**Entrega:** razón social, RUT, domicilio legal; representante legal y dos coordinadores de proyecto con correo y teléfono; desglose fino de potencias; **coordenadas UTM del proyecto y del punto de conexión**; subestación, tipo de conexión, kV, paño; **fecha estimada de construcción y fecha estimada de operación**; versión de plantilla; firmante.

**Permite confirmar:** titularidad y contacto; el desglose técnico real; la ubicación georreferenciada; las fechas que el titular declaró por escrito.

**Se persiste hoy:** empresa, personas, SPV, potencias (sólo donde el listado dejó null).
**NO se persiste hoy:** coordenadas UTM ni fechas de construcción/operación. El helper de conversión ya existe ([utm.ts](../lib/ingestion/sources/sipub/shared/utm.ts), `proj4` ya es dependencia) — es una brecha de carga, no de capacidad.

### 1.3 SEIA — Servicio de Evaluación Ambiental

| | |
|---|---|
| **Endpoint** | `buscarProyectoResumenAction.php` (buscador público, sectores económicos 7 y 13) |
| **Frecuencia** | **Ninguna.** No hay job de sincronización. Se consulta por proyecto desde el verificador admin y desde los flujos de IA (screening / preverificación) |
| **Cobertura** | 234 expedientes · 177 vinculados a proyecto · 56 sobre proyectos verificados |
| **Confiabilidad** | **Alta al momento del match, decreciente después** — el estado guardado no se refresca nunca |

**Entrega:** ID de expediente, nombre, URL de ficha, DIA/EIA, región, comuna, tipología, razón de ingreso, titular, inversión (MMUSD), fecha de presentación, estado del proyecto.

**Estados presentes hoy:** Aprobado (186), En Calificación (29), Desistido (8), No calificado (4), Rechazado (3), No Admitido a Tramitación (3), Caducado (1).

**Permite confirmar:** que existe expediente ambiental; si es DIA o EIA; en qué estado quedó la evaluación; cuándo se presentó; cuánta inversión se declaró.

**NO permite confirmar (y hoy no guardamos):** **fecha de la RCA**, **número de resolución**, vigencia o caducidad de la RCA, condiciones impuestas, ni si hubo RCA modificada. "Aprobado" es el estado del expediente, no una RCA fechada y citable.

### 1.4 SEA — Consultas de Pertinencia

| | |
|---|---|
| **Frecuencia** | Diaria (`sync-sea-pertinencia`) — **9 de 12 corridas fallidas**, la última exitosa 2026-08-11 21:11 |
| **Cobertura** | 2.247 consultas ingeridas · **8 vinculadas a un proyecto** · 2.239 pendientes de match |
| **Confiabilidad** | Alta como dato de la consulta; el cruce contra proyecto es el cuello de botella |

**Entrega:** qid, correlativo, nombre, titular + RUT, región, comuna, tipo, estado, sub-estado, `requiere_ingreso`, fecha de presentación, fecha de respuesta, documentos.

**Sub-estados reales:** "Resuelta - No ingreso al SEIA" (1.835), "Resuelta - Desistida" (179), "Resuelta - Ingreso al SEIA" (114), "Resuelta - Abandono" (49), "En análisis" (35), "No admitida a tramitación" (12).

**Permite confirmar:** que el titular consultó al SEA si debía ingresar; qué respondió el SEA.

**NO permite confirmar:** aprobación ambiental. Una pertinencia resuelta "No ingreso al SEIA" **no es una RCA** — es la constancia de que no se requiere una. Y "Resuelta - Ingreso al SEIA" es lo contrario de una aprobación: abre el trámite.

### 1.5 CNE — Declaración en Construcción

| | |
|---|---|
| **Origen** | XLSX de resolución mensual, **descargado a mano** a `dataset/` |
| **Frecuencia** | Manual. Última resolución cargada: **2026-06-30**, sincronizada el **2026-07-22** |
| **Cobertura** | 193 filas · 191 centrales · **0 vinculadas a `project`** |
| **Uso actual** | Sólo agregados en `/mercado`. No aparece en ninguna ficha |
| **Confiabilidad** | Alta (es un acto administrativo con número de resolución) pero **desactualizada** |

**Entrega:** proyecto/central, BESS asociado, propietario, tecnología, categoría, potencia neta, capacidad instalada (texto libre), barra de conexión, resolución original, fecha original y vigente de interconexión, región, número y fecha de resolución.

**Permite confirmar:** que CNE declaró formalmente el proyecto en construcción, **con número y fecha de resolución** — la única fuente que entrega el acto administrativo citable.

**NO permite confirmar:** avance físico. Una declaración es un acto jurídico, no una obra.

### 1.6 PGP — Plataforma de Gestión de Proyectos (Coordinador)

> Nota de nomenclatura: varios comentarios del código dicen "Programa de Grandes Proyectos". El nombre oficial es **Plataforma de Gestión de Proyectos** (ver [spec del skill de sector](superpowers/specs/2026-08-08-sector-electrico-chile-skill-design.md)).

| | |
|---|---|
| **Endpoints** | `GET /api/request/irs?project=<NUP>` + `POST /api/request/get_request_info` |
| **Frecuencia** | Diaria (`sync-pgp-progress`, 8 corridas, 0 fallidas) — última 2026-08-11 21:00 |
| **Cobertura** | 178 observaciones · **73 proyectos** |
| **Confiabilidad** | **La más alta que tenemos para obra física** — es el reporte del propio titular al Coordinador |

**Entrega:** `completition_status` (% de avance físico), `completition_pes` (% de puesta en servicio), `service_estimate_date`, `operative_estimate_date`, id de solicitud PGP y URL pública.

**Permite confirmar:** que hay obra reportada y cuánta; las fechas estimadas de puesta en servicio y entrada en operación **según el titular hoy** (que pueden contradecir el COD del listado — ver §13).

**NO permite confirmar:** fechas reales de PES/EO (el campo no existe en la API, verificado); qué se construyó exactamente.

**Desaprovechado:** `completition_pes` se calcula en [fetch.ts](../lib/ingestion/sources/pgp/fetch.ts) y se descarta. El endpoint sin filtrar además embebe el **árbol de fases completo** de cada solicitud — la única fuente pública de fases reales de ejecución que tenemos a la vista.

### 1.7 CNE — Capacidad Instalada (Energía Abierta)

Semanal (`sync-cne-capacidad-remote`). Alimenta `power_plant` (unidades en operación comercial). **No está vinculada a `project`**: hoy no podemos cerrar el ciclo "proyecto → central operando". Confiabilidad alta; es el registro de lo que efectivamente opera.

### 1.8 Coordinador — SIPUB

Semanal. Alimenta `coordinador_empresa` (grupos empresariales — se usa en la ficha, sección "Empresas relacionadas"), `power_plant`, `transmission_line`, `substation` (973 subestaciones). Confiabilidad alta para infraestructura existente.

### 1.9 Análisis interno asistido por IA

Nemotron / GLM / Kimi: clasificación de tecnología por nombre (1.419 atribuciones marcadas `INTELIGENCIA_DE_MERCADO`), screening de cola, preverificación editorial (`project_preverification`). **No es una fuente**: es una hipótesis que un humano confirma. Nunca debe presentarse con la misma jerarquía visual que un dato de fuente oficial.

### 1.10 Fuentes ausentes

| Fuente | Estado | Qué aportaría |
|---|---|---|
| **SII** | No conectada. El RUT viene del Coordinador, no del SII | Razón social oficial, giro, vigencia, domicilio tributario |
| **PELP** | **No existe** en código ni base | Capa prospectiva de expansión modelada |
| **Concesiones eléctricas (SEC / Ministerio)** | No conectada | Gate de permisos críticos para Ready to Build |
| **CBR / servidumbres** | No conectada | Gate de derechos de terreno |

---

## 2. Inventario de la ficha actual

Fuente: [app/(public)/proyectos/[id]/page.tsx](<../app/(public)/proyectos/[id]/page.tsx>) (583 líneas) y sus componentes.

| # | Bloque | Contenido | Origen | Naturaleza |
|---|---|---|---|---|
| 1 | **Header** | Icono de tecnología, nombre, código interno (`TL-XXXX`), botones Compartir / Seguir / Añadir a CRM | `project` | Hecho |
| 2 | **Grilla de 12 campos** | Ubicación (comuna, región) · RUT 🔒 · Dirección legal 🔒 · SPV/Propietario 🔒 · Tecnología · Potencia instalada · Potencia BESS · Energía BESS · Duración BESS · Punto de conexión · Nivel de tensión · Fecha de conexión declarada | `project`, `company`, `spv`, `project_connection` | Hecho |
| 3 | **Descripción** | Párrafo autogenerado por plantilla (4 variantes elegidas por hash del id) | Derivado | Generado |
| 4 | **Health Score** 🔒 | 0–100 + banda + "60% conexión / 40% ambiental" + penalización por atraso | [projectHealthScore.ts](../lib/shared/projectHealthScore.ts) | **Score propio** |
| 5 | **Avance de proyecto** 🔒 | 3 barras expandibles: Estado de conexión (% de madurez propia) · Estado ambiental / Pertinencia (% propio) · Avance de Construcción (**% real de PGP**) | `project.status`, `seia_record`, `pertinencia_consulta`, `latest_pgp_project_progress` | Mixto: 2 estimados + 1 oficial |
| 6 | **Detalle SEIA** | Tarjeta con expediente, estado, tipo, fecha, inversión, link a ficha SEIA | `seia_record` | Hecho |
| 7 | **Detalle Pertinencia** | Tarjeta con estado, sub-estado, fechas, link al documento | `pertinencia_consulta` | Hecho |
| 8 | **Cronograma estimado** 🔒 | Gantt de fases (campaña de viento, desarrollo, conceptual, básica, detalle, compras, construcción, comisionamiento) con bandas mín/máx y confianza por fase; calibración de deslizamiento de COD; hitos PES/EO de PGP; marca de "construcción no iniciada" | [computeEstimatedPhase.ts](../lib/shared/computeEstimatedPhase.ts) + [projectTimelineEstimator.ts](../lib/shared/projectTimelineEstimator.ts) | **Modelo hacia atrás desde el COD** |
| 9 | **Contactos** 🔒 | Ejecutivos relacionados (rep. legal, coordinadores), enmascarados según plan | `person`, `entity_relationship` | Hecho |
| 10 | **Empresas relacionadas** | Grupo empresarial según el Coordinador | `coordinador_empresa` | Hecho |
| 11 | **Propiedad** (Prime) | Cadena societaria verificada a mano — sólo 12 perfiles cargados | `ownership_entity`, `ownership_relation` | Hecho verificado |
| 12 | **Proyectos relacionados** 🔒 | Otros proyectos del mismo RUT/SPV/grupo/contactos | Derivado | Hecho |

**Lo que NO aparece en ninguna parte de la ficha actual:**

- La **fecha de la última actualización** de cada dato y su fuente (hay links fijos al portal, no provenance por campo).
- El **historial de eventos** del proyecto — `project_event` tiene 94 cambios de estado registrados y 37 hitos SEIA que nadie ve.
- La **declaración en construcción de CNE** con su número de resolución.
- **Coordenadas / mapa** del proyecto.
- El **plazo para declarar construcción** una vez autorizado.
- Cualquier noción de **Ready to Build**, de **conflicto entre fuentes**, o de **confianza por dato** (la confianza existe sólo por fase del cronograma estimado).

---

## 3. Diagnóstico

| # | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| D1 | Estado sin normalizar | 28 variantes crudas; 498 "autorizado" repartidos en 2 grafías; 220 "declarado" en 3 | Imposible filtrar, agregar o comparar por estado sin normalizar en cada consumidor |
| D2 | `connection_status` huérfana | 39 códigos, slugs duplicados (`desarrollo_estudios` y `desarrollo_de_estudios_y_o_antecedentes`), sin FK desde `project` | La normalización real vive en un `.ts` y no es consultable desde SQL |
| D3 | Tipo de proceso sin normalizar | `request_type`: SAC 1.272, SUCTD 575, FEHACIENTES 166, FEHACIENTE 43, SASC 24, SUCT 16 | 6 valores para 3 procesos |
| D4 | Un solo eje de estado | `project.status` hace de estado del proyecto | No se puede decir "oficialmente X, nosotros lo clasificamos como Y, con confianza Z, al día D" |
| D5 | CNE desconectada | `construction_project` sin `project_id`, carga manual, congelada al 2026-06-30 | La fuente que da el acto administrativo de declaración no llega a la ficha |
| D6 | Ingeniería/compras/construcción sólo inferidas | `computeEstimatedPhase` resta duraciones desde el COD | El bloque visualmente más rico de la ficha es el menos respaldado |
| D7 | Provenance parcial e invisible | 5 campos en `data_attribution`, sin `source_url`, no renderizada | No se puede responder "¿de dónde salió este dato?" en la UI |
| D8 | Timeline de eventos sin usar | 2.388 filas en `project_event` | El historial existe y no se muestra |
| D9 | Datos extraídos y descartados | UTM y fechas del Formulario; `completition_pes` de PGP | 0 de 260 ubicaciones con coordenadas; 0 de 2.096 con `construction_start_date` |
| D10 | SEIA sin refresco | Sin job; el estado queda congelado al día del match | Un "Aprobado" puede tener meses y la ficha no lo dice |
| D11 | Pertinencias sin cruzar | 2.239 de 2.247 sin `matched_project_id` | La señal ambiental temprana está inutilizada |
| D12 | RCA sin fecha ni número | `seia_record` no tiene `rca_date` ni `rca_number` | No se puede citar la resolución que respalda "RCA favorable" |

---

## 4. Estructura propuesta de la Ficha de Proyecto

### 4.1 Principio rector

Cada dato de la ficha es una tupla, no un valor suelto:

```
valor · fuente · fecha del dato · confianza · URL de evidencia
```

Y tres planos que **nunca se mezclan visualmente**:

| Plano | Qué es | Tratamiento visual |
|---|---|---|
| **OFICIAL** | Textual de una fuente | Texto normal + chip con la fuente |
| **NORMALIZADO** | Nuestra clasificación derivada de lo oficial, con reglas publicadas | Badge con nuestro color de marca + tooltip con la regla aplicada |
| **ESTIMADO** | Modelo (cronograma, madurez, calibración) | Trama rayada / itálica + etiqueta "Estimado" siempre visible |

### 4.2 Secciones

```
A. IDENTIDAD
B. PROJECT STATUS            (official + normalized + confidence + as of)
C. KEY MILESTONES            (checklist de hitos con evidencia)
D. CONNECTION                (proceso, etapa raw/normalizada, punto, timeline)
E. ENVIRONMENTAL             (pathway + status + resolución)
F. CONSTRUCTION              (readiness / official / physical, separados)
G. READY TO BUILD            (gates + razones + confianza)
H. PROJECT TIMELINE          (eventos reales; escenario estimado como capa aparte)
I. ENGINEERING & PROCUREMENT (solo si hay evidencia; solapado, no secuencial)
J. PELP ALIGNMENT            (capa prospectiva, aislada)
K. OWNERSHIP & CONTACTS      (sin cambios respecto de hoy)
L. SOURCES & EVIDENCE        (provenance completa, por campo)
```

### 4.3 Campos por sección, con fuente y fuente de verdad

**A. Identidad**

| Campo | Fuente hoy | Fuente de verdad | Estado |
|---|---|---|---|
| `project_name` | Acceso Abierto listado | Acceso Abierto | ✅ existe |
| `project_id` (`internal_code` TL-XXXX) | interno | interno | ✅ existe |
| `nup` | Acceso Abierto | Acceso Abierto | ✅ existe (1.821/2.096) |
| `request_id` (`external_reference`) | Acceso Abierto | Acceso Abierto | ✅ existe |
| `developer` | Formulario > listado | Formulario (documento firmado) | ✅ existe |
| `owner` / `spv` | Formulario | Formulario | ✅ existe (1.197/2.096) |
| `owner_rut` | Formulario / listado | **SII** (no conectado) | ⚠️ sin validar contra SII |
| `technology` | listado > IA por nombre | Formulario | ✅ existe (2.071/2.096) |
| `capacity_mw` / `mwh` / `duration_h` | Formulario > listado | Formulario | ⚠️ 552/2.096 con potencia |
| `region` / `commune` | listado | listado | ✅ existe (2.096/2.096) |
| `coordinates` | Formulario (UTM) | Formulario | ❌ **extraído y no persistido** |

**B. Project Status** — cuatro campos, no uno:

| Campo | Definición | Ejemplo real (TL-1604 PFV Monte Águila) |
|---|---|---|
| `official_status` | Texto exacto de la fuente, sin tocar | `"Proyecto declarado en construcción"` |
| `official_status_source` | Qué fuente lo dice | Acceso Abierto — Coordinador |
| `normalized_status` | Nuestra clasificación (§6) | `DECLARED_IN_CONSTRUCTION` |
| `status_confidence` | HIGH / MEDIUM / LOW (§11) | HIGH |
| `status_as_of` | Fecha del dato en la fuente, no de nuestra descarga | 2026-08-11 |

**C. Key Milestones** — checklist binario con evidencia. Un hito sin evento fechado se muestra como `—` (desconocido), **nunca como ✗**:

| Hito | Evidencia que lo confirma | Fuente |
|---|---|---|
| Solicitud de conexión ingresada | `create_date` de la solicitud | Acceso Abierto |
| Admisibilidad superada | Estado ≥ `STUDIES` | Acceso Abierto |
| Antecedente ambiental iniciado | Expediente SEIA con `filed_at`, o pertinencia presentada | SEIA / SEA |
| Situación ambiental resuelta | RCA favorable, o pertinencia "No ingreso" | SEIA / SEA |
| Conexión autorizada | Estado `AUTHORIZED_TO_DECLARE` | Acceso Abierto |
| Declarado en construcción | Estado `DECLARED_IN_CONSTRUCTION` **o** fila en nómina CNE con resolución | Coordinador / **CNE** |
| Obras iniciadas | PGP > 0 % | PGP |
| Puesta en servicio | `completition_pes` / documento PES | PGP |
| En operación | Unidad en capacidad instalada | CNE |

---

## 5. Connection Status

### 5.1 Connection Process

Normalización de `request_type` (6 valores crudos → 4 procesos + desconocido):

| Crudo | `connection_process` |
|---|---|
| `SAC`, `SASC` | `SAC` |
| `SUCTD`, `SUCT` | `SUCTD` |
| `FEHACIENTE`, `FEHACIENTES` | `PROYECTO_FEHACIENTE` |
| otro no vacío | `OTHER` (se conserva el crudo) |
| null | `UNIDENTIFIED` |

### 5.2 Connection Stage

Siempre se guardan **los dos**: `connection_status_raw` (texto exacto del CEN) y `connection_stage_normalized`. La tabla de equivalencia se construye **sólo con los estados que la fuente realmente emite hoy** — no se inventan etapas:

| `connection_stage_normalized` | Estados oficiales que mapean (texto CEN) | Filas hoy |
|---|---|---|
| `REQUEST_SUBMITTED` | Solicitud Ingresada · Proyecto ingresado | 29 |
| `ADMISSIBILITY` | Evaluación Admisibilidad | 5 |
| `STUDIES` | Desarrollo de estudios y/o antecedentes · Revisión de antecedentes · Evaluación de antecedentes y/o requerimientos | 53 |
| `PRELIMINARY_REPORT` | Elaboración Informe CTD preliminar · Elaboración Informe de Autorización de Conexión Preliminar | 19 |
| `PRELIMINARY_OBSERVATIONS` | Observaciones al informe CTD preliminar · Observaciones a Informe de Autorización de Conexión Preliminar | 25 |
| `DISCREPANCIES` | Audiencia y antecedentes adicionales · Periodo de presentación de discrepancias | 15 |
| `FEHACIENTE_QUALIFIED` | Proyecto calificado como fehaciente · Proyecto Fehaciente debe presentar SUCTD | 28 |
| `FINAL_REPORT` | Elaboración de Informe de Autorización de Conexión Final · …Definitivo · …Proyecto Fehaciente | 5 |
| `AUTHORIZED_TO_DECLARE` | Proyecto autorizado para declararse en construcción · Clasificado como Obra Menor | 499 |
| `DECLARED_IN_CONSTRUCTION` | Proyecto declarado en construcción | 220 |
| `PROCESS_COMPLETED` | Proyecto finalizado | 10 |
| `WITHDRAWN` | Desistida | 298 |
| `REJECTED` | Rechazada | 776 |

**Cambio de criterio importante:** los dos estados "Detenida a la espera de…" (113 filas) **no son una etapa** — hoy [projectStatusMaturity.ts](../lib/shared/projectStatusMaturity.ts) les asigna arbitrariamente el orden 78, entre "informe final" y "autorizado". Pasan a ser una **bandera ortogonal**:

```
on_hold = true
on_hold_reason = "Detenida a la espera de definición de ingeniería de la obra"
```

La etapa que se muestra es la última etapa efectivamente alcanzada, con un badge "En pausa" encima. Un proyecto detenido no está más avanzado que uno que sigue avanzando.

### 5.3 Connection Timeline

Qué se puede mostrar **hoy**, con fuente:

| Hito | ¿Disponible? | Fuente / campo |
|---|---|---|
| Fecha de solicitud | ✅ | `create_date` del listado (`project_event.announced` ya lo registra) |
| Fecha de admisibilidad | ⚠️ **derivable** | Fecha del `status_change` hacia `ADMISSIBILITY` en `project_event` — sólo desde que empezamos a observar (94 cambios registrados) |
| Fecha de estudios | ⚠️ derivable | ídem |
| Fecha de solución de conexión | ⚠️ derivable | ídem (`FINAL_REPORT`) |
| Fecha de autorización | ⚠️ derivable | ídem (`AUTHORIZED_TO_DECLARE`) |
| Punto de conexión | ✅ | `project_connection.connection_point` (2.083/2.096) |
| **Plazo para declarar construcción** | ❌ | No lo entrega ninguna fuente conectada. Es reglamentario y se contaría desde la autorización — **propuesto como campo derivado explícitamente marcado ESTIMADO**, o dejarlo fuera |
| Declaración en construcción | ✅ | Estado CEN + **resolución CNE** (requiere vincular `construction_project`) |
| Energización / puesta en servicio | ⚠️ parcial | `completition_pes` de PGP (se descarta hoy) + `service_estimate_date` (estimada) |
| Operación | ⚠️ | Presencia en `power_plant` (requiere vincular a `project`) |

**Regla:** las fechas derivadas de `project_event` sólo existen desde que el proyecto entró a nuestro pipeline. Deben mostrarse con la marca *"observado por Transition Latam desde DD-MM-AAAA"*, nunca como si fueran el registro histórico completo del Coordinador.

---

## 6. Environmental Status

Dos campos independientes, como pediste:

**`environmental_pathway`** — qué vía ambiental sigue el proyecto:

| Valor | Cuándo | Evidencia |
|---|---|---|
| `SEIA` | Existe expediente DIA/EIA | `seia_record` vinculado |
| `PERTINENCE` | Existe consulta de pertinencia, sin expediente SEIA | `pertinencia_consulta` confirmada |
| `NOT_APPLICABLE` | Bajo umbral: generación ≤ 3 MW, o BESS standalone conectado ≤ 23 kV | [environmentalReviewRules.ts](../lib/shared/environmentalReviewRules.ts) (DS 40/2012 art. 3 c) |
| `UNKNOWN` | Todo lo demás | — |

**`environmental_status`** — el estado específico dentro de esa vía, **sin fusionar vías**:

| Pathway | Estados |
|---|---|
| `SEIA` | `FILED` · `IN_QUALIFICATION` · `RCA_FAVORABLE` · `RCA_UNFAVORABLE` · `RCA_AMENDED` · `WITHDRAWN` · `NOT_ADMITTED` · `EXPIRED` |
| `PERTINENCE` | `UNDER_REVIEW` · `RESOLVED_NO_ENTRY` · `RESOLVED_ENTRY_REQUIRED` · `RESOLVED_WITHDRAWN` · `NOT_ADMITTED` |

**Reglas de no-inferencia (explícitas):**

1. `RESOLVED_NO_ENTRY` ≠ `RCA_FAVORABLE`. Son cosas distintas y se muestran en filas distintas. Hoy [projectHealthScore.ts](../lib/shared/projectHealthScore.ts) le da 100 puntos a "no ingreso" y 100 a "Aprobado" — el mismo número para dos hechos que no son equivalentes. Se corrige separando la evidencia aunque el score resultante sea parecido.
2. `RESOLVED_ENTRY_REQUIRED` significa que el proyecto **debe** ingresar al SEIA: es un requisito abierto, no un logro.
3. `NOT_APPLICABLE` requiere conocer capacidad de generación **y** tensión. Si falta cualquiera de las dos → `UNKNOWN`, no `NOT_APPLICABLE`.
4. Un proyecto declarado en construcción sin expediente vinculado **no** se marca `RCA_FAVORABLE`. Se marca `UNKNOWN` con la nota "el trámite ambiental debió resolverse para llegar a este estado; no tenemos el expediente vinculado" — que es lo que hoy hace `concluido_por_construccion` en el Health Score, y está bien resuelto ahí. Se conserva ese criterio, pero como **nota**, no como estado.
5. `RCA_FAVORABLE` exige **fecha y número de resolución**. Sin ellos, el estado es `IN_QUALIFICATION` o `UNKNOWN` con el estado crudo del expediente visible.

---

## 7. Construction Status

Tres campos separados que hoy están parcialmente mezclados:

| Campo | Qué afirma | Evidencia admisible | Cobertura hoy |
|---|---|---|---|
| `construction_readiness` | **Nuestra** lectura de si puede construir | Gates de §8 | Calculable para todos |
| `official_construction_status` | Que **una autoridad** lo declaró en construcción | (a) Estado CEN `DECLARED_IN_CONSTRUCTION`, o (b) fila en nómina CNE con `num_res` + `fecha_res` | 220 por CEN · 193 filas CNE sin vincular |
| `physical_construction_status` | Que **hay obra** | PGP `progress_percent > 0` | 73 proyectos |

**Qué NO es suficiente para afirmar "está en construcción":**

- El estado "Proyecto autorizado para declararse en construcción" (499 proyectos). Autoriza; no declara.
- La declaración de construcción por sí sola. Es un acto administrativo. **Evidencia real en la base:** 46 proyectos declarados en construcción tienen 73,9 % de avance promedio en PGP, pero uno de ellos reporta **0 %**.
- Que la fecha estimada de conexión ya pasó.
- Que nuestro modelo de fases ubique al proyecto en la etapa "construcción". Eso es aritmética sobre una fecha declarada.

La ficha ya distingue bien estos dos planos en la barra de PGP y en `constructionNotStartedReason` — la propuesta **conserva ese criterio** y lo eleva a campo de primer nivel para los 2.023 proyectos que hoy no tienen PGP.

---

## 8. Ready to Build

No es `RCA + conexión`. Se propone un modelo de **gates con evidencia**, donde la ausencia de dato produce `UNKNOWN`, no `FALSE`:

| Gate | Criterio | Fuente | ¿Evaluable hoy? |
|---|---|---|---|
| **G1 · Conexión asegurada** | `connection_stage_normalized` ∈ {`AUTHORIZED_TO_DECLARE`, `DECLARED_IN_CONSTRUCTION`} | Acceso Abierto | ✅ sí |
| **G2 · Ambiental resuelto** | `RCA_FAVORABLE` vigente · o `RESOLVED_NO_ENTRY` · o `NOT_APPLICABLE` por umbral | SEIA / SEA | ⚠️ sólo 177 con expediente |
| **G3 · Permisos críticos** | Concesión eléctrica cuando aplica; permisos sectoriales identificados | — | ❌ **sin fuente conectada** |
| **G4 · Terreno / derechos** | Propiedad o servidumbre acreditada sobre el sitio y la franja | — | ❌ **sin fuente conectada** |
| **G5 · Sin bloqueos conocidos** | `on_hold = false` · no `WITHDRAWN`/`REJECTED` · sin discrepancias abiertas · RCA no caducada | Acceso Abierto + SEIA | ✅ sí |
| **G6 · Cronograma plausible** | COD declarado ≥ hoy + duración mínima de construcción del tipo tecnológico | listado + [projectPhaseDurations.ts](../lib/shared/projectPhaseDurations.ts) | ✅ sí (estimado) |

**Regla de resolución:**

```
ready_to_build =
  TRUE     si G1 ∧ G2 ∧ G5 confirmados  ∧  (G3 ∧ G4 confirmados  ∨  official_construction_status = declarado)
  FALSE    si algún gate falla con evidencia explícita (ej. RCA rechazada, solicitud desistida)
  UNKNOWN  en cualquier otro caso
```

**Confianza:**

| `ready_to_build_confidence` | Condición |
|---|---|
| `HIGH` | G1–G5 confirmados con fuente primaria, todas dentro de su ventana de frescura |
| `MEDIUM` | G1, G2 y G5 confirmados; G3/G4 desconocidos (**caso típico hoy**) |
| `LOW` | G2 inferido por umbral (`NOT_APPLICABLE`) o alguna fuente fuera de ventana |

**Razones — siempre explícitas, positivas y negativas:**

```json
{
  "ready_to_build": "UNKNOWN",
  "ready_to_build_confidence": "MEDIUM",
  "ready_to_build_reasons": [
    { "gate": "G1", "result": "PASS",    "evidence": "Proyecto autorizado para declararse en construcción",
      "source": "Acceso Abierto", "as_of": "2026-08-11" },
    { "gate": "G2", "result": "PASS",    "evidence": "RCA favorable (DIA, 2025-09-04)",
      "source": "SEIA", "url": "https://seia.sea.gob.cl/...", "as_of": "2026-07-27" },
    { "gate": "G3", "result": "UNKNOWN", "evidence": "Sin fuente de permisos sectoriales conectada" },
    { "gate": "G4", "result": "UNKNOWN", "evidence": "Sin fuente de derechos de terreno conectada" },
    { "gate": "G5", "result": "PASS",    "evidence": "Sin bloqueos registrados", "as_of": "2026-08-11" }
  ]
}
```

**Consecuencia honesta:** con las fuentes de hoy, **ningún proyecto puede alcanzar `ready_to_build = TRUE` con confianza `HIGH`** salvo que ya esté declarado en construcción. Eso no es un defecto del modelo: es la medida exacta de lo que falta conectar (G3 y G4). Prefiero que el producto lo diga a que lo simule.

---

## 9. Criterios de madurez: gates + milestones, y el score como accesorio

**Recomendación: gates + milestones como mecanismo primario; score sólo como ordenador secundario.**

Por qué no un score puro: un 82/100 no dice qué falta ni permite filtrar cartera ("muéstrame todo lo que está RTB"). Por qué no gates puros: dentro de una misma categoría hay proyectos claramente más avanzados que otros. Por qué no milestones solos: no ordenan.

**Modelo:** la categoría la determinan **gates de entrada** (evidencia binaria, sin puntajes); el orden **dentro** de la categoría lo da el score; los milestones son la explicación visible de por qué el proyecto está donde está.

| Categoría | Gate de entrada (todas las condiciones) | Salida hacia atrás |
|---|---|---|
| `IDENTIFIED` | Existe registro en alguna fuente (solicitud, pertinencia o expediente) | — |
| `EARLY_DEVELOPMENT` | `connection_stage ≥ REQUEST_SUBMITTED` · o pertinencia en análisis | — |
| `DEVELOPMENT` | `connection_stage ∈ {STUDIES, PRELIMINARY_REPORT, PRELIMINARY_OBSERVATIONS}` · o expediente SEIA `IN_QUALIFICATION` | — |
| `ADVANCED_DEVELOPMENT` | `connection_stage ∈ {DISCREPANCIES, FEHACIENTE_QUALIFIED, FINAL_REPORT}` · o `RCA_FAVORABLE` con conexión aún no autorizada | — |
| `READY_TO_BUILD` | `ready_to_build = TRUE` (§8) | Si un gate cae (RCA caducada, solicitud detenida) → vuelve a `ADVANCED_DEVELOPMENT` con evento registrado |
| `DECLARED_IN_CONSTRUCTION` | `official_construction_status` confirmado por CEN **o** CNE | Rara vez retrocede; si el CEN cambia el estado, se registra evento |
| `UNDER_CONSTRUCTION` | `physical_construction_status`: PGP > 0 % | Si PGP vuelve a 0 % se mantiene la categoría y se marca alerta — un retroceso de reporte no borra la obra |
| `COMMISSIONING` | `completition_pes > 0` **o** documento de puesta en servicio | — |
| `OPERATIONAL` | Unidad presente en capacidad instalada CNE | — |
| *(terminales)* `WITHDRAWN` / `REJECTED` | Estado CEN terminal negativo | Reingreso = proyecto nuevo o reactivación con evento |

**Reglas transversales:**

- **Monotonicidad con evidencia:** un proyecto no baja de categoría por falta de dato, sólo por evidencia contraria fechada.
- `on_hold` es ortogonal: un proyecto puede estar `ADVANCED_DEVELOPMENT · en pausa`.
- El **score 0–100** se conserva (el Health Score actual ya está bien construido y explicado) pero se **subordina**: se muestra dentro de la categoría, nunca como el titular. Se le añade el componente que hoy le falta: frescura de la evidencia.

---

## 10. Engineering / Procurement

**Respuesta honesta: hoy no hay fuente pública que permita afirmar ingeniería conceptual, básica, de detalle, licitación EPC, adjudicación, compras o equipamiento de largo plazo.** Ninguna de las siete fuentes conectadas los reporta.

Lo único con respaldo real:

| Señal | Qué permite afirmar | Fuente |
|---|---|---|
| "Detenida a la espera de definición de ingeniería de la obra" (101 proyectos) | Que la ingeniería de la obra **no está definida** | Acceso Abierto |
| Árbol de fases de PGP | Fases reales declaradas por el titular al Coordinador | PGP (`/api/request/irs` sin filtrar — **hoy no lo consumimos**) |
| `completition_pes` | Avance de puesta en servicio | PGP (**hoy se descarta**) |
| Fechas del Formulario | Construcción y operación **declaradas por el titular** | Formulario (**hoy no se persisten**) |

**Propuesta:**

1. **No** mostrar una escalera EPC como si fuera estado del proyecto. Sería inventar.
2. Modelar las etapas como **intervalos solapables** (`project_workstream`: `workstream`, `start_date`, `end_date`, `status`, `source`, `confidence`) — no como una barra de progreso lineal. La ingeniería de detalle y las compras de equipos de largo plazo corren en paralelo con la construcción; una escalera secuencial mentiría aunque los datos fueran buenos.
3. Poblar esos intervalos sólo desde: (a) el árbol de fases de PGP, (b) declaración del titular vía Formulario, (c) confirmación del propietario a través del CRM (`CONFIRMADO_POR_PROPIETARIO`).
4. Mientras no haya evidencia, la sección **no se muestra** — no se muestra vacía ni con estimaciones.

---

## 11. Project Timeline

Una sola línea de tiempo, dos capas visualmente distintas:

**Capa 1 — Eventos observados (hechos).** Cada evento:

```
{ date, event_type, label, source, source_url, confidence, observed_by_us_since }
```

Se construye sobre `project_event`, que **ya existe y ya se está poblando** (2.253 `announced`, 94 `status_change`, 37 `seia_milestone`, 4 `connection_date_change`) y hoy no se muestra. Se añaden tipos: `environmental_milestone`, `construction_declaration`, `physical_progress`, `commissioning`, `operation`.

**Capa 2 — Escenario estimado.** El cronograma actual ([PhaseTimeline](<../app/(public)/proyectos/[id]/PhaseTimeline.tsx>)), con su trama rayada y sus bandas mín/máx, **se conserva tal cual** pero baja de jerarquía: pasa a ser una capa que se puede activar/desactivar sobre la línea de eventos reales, con su etiqueta "Estimado" y su nota de que se calcula hacia atrás desde el COD. Es un buen modelo; el problema es que hoy ocupa el lugar del registro factual.

**Regla:** un evento estimado nunca se dibuja con el mismo tratamiento que uno observado, y ningún evento estimado genera un hito en la checklist de §4.3-C.

---

## 12. Sistema de confianza

**No se crea un sistema nuevo.** Se reutiliza el enum que ya existe en `data_attribution.confidence_level` y `entity_relationship.confidence_level`, y se define su proyección a la escala de tres niveles que se muestra al usuario:

| `confidence_level` (base) | Proyección UI | Cuándo |
|---|---|---|
| `VERIFICADO` | **HIGH** | Revisado por el equipo editorial (`project.verified_at`) — 198 proyectos |
| `CONFIRMADO_POR_PROPIETARIO` | **HIGH** | El titular lo confirmó (CRM / Formulario firmado) |
| `PUBLICO` | **HIGH** si está dentro de ventana de frescura; **MEDIUM** si está fuera | Fuente oficial |
| `INTELIGENCIA_DE_MERCADO` | **MEDIUM** | Cruce nuestro, clasificación por IA (1.419 atribuciones) |
| `ESTIMADO` | **LOW** | Modelos (cronograma, calibración de COD) |

**Ventana de frescura por fuente** — un dato oficial envejece y la ficha debe decirlo:

| Fuente | Ventana | Situación real hoy |
|---|---|---|
| Acceso Abierto listado | 7 días | ✅ 2026-08-11 |
| PGP | 15 días | ✅ 2026-08-11 |
| SEA pertinencias | 15 días | ⚠️ job con 9/12 corridas fallidas |
| SEIA | 90 días | ❌ **sin refresco: sin ventana aplicable** |
| CNE Declaración en Construcción | 45 días | ❌ **congelada al 2026-06-30** |
| CNE Capacidad instalada | 30 días | ✅ semanal |

Fuera de ventana, el dato no se oculta: se muestra con el sello "dato de DD-MM-AAAA" y su confianza baja un nivel.

---

## 13. Provenance

**Tampoco se crea una estructura paralela.** `data_attribution` ya tiene la forma correcta (`entity_type`, `entity_id`, `field_name`, `value`, `data_source_id`, `source_date`, `collected_at`, `confidence_level`, `verification_status`, `is_current`). Lo que falta:

1. **Cobertura**: de 5 campos a todos los campos que la ficha muestre como hecho.
2. **`source_url` y `source_ref`**: dos columnas nuevas. Hoy la URL de evidencia se pierde (existe en `seia_record.url_ficha` y en `pgp.source_url`, pero no como provenance genérica).
3. **Renderizado**: un ícono ⓘ por campo que abra `valor · fuente · fecha · confianza · link`, y la sección **L. Sources & Evidence** al pie con la tabla completa.

Ejemplo de lo que debe poder responderse por campo:

| Dato | Fuente | Fecha | Confianza | Evidencia |
|---|---|---|---|---|
| RCA favorable | SEIA | 2025-09-04 | HIGH | `seia.sea.gob.cl/expediente/…` |
| Conexión autorizada | Acceso Abierto | 2026-08-11 | HIGH | `accesoabierto.coordinador.cl` (solicitud 4933) |
| Declarado en construcción | CNE | Res. N°XXX, 2026-06-30 | HIGH | resolución CNE |
| Avance físico 8 % | PGP | 2026-08-07 | HIGH | `pgp.coordinador.cl/irequests/…` |
| Tecnología: Solar | Clasificación IA | 2026-07-14 | MEDIUM | — |

---

## 14. Conflictos entre fuentes

### 14.1 Matriz FIELD → SOURCE OF TRUTH

| Campo | Fuente de verdad | Secundarias | Regla |
|---|---|---|---|
| Nombre, NUP, id de solicitud | **Acceso Abierto (listado)** | Formulario, SEIA | Única fuente del trámite |
| Titular, RUT, domicilio | **Formulario** (documento firmado) | listado, *SII (falta)* | El Formulario gana sobre el listado; el SII debería ganar sobre ambos para razón social |
| Grupo empresarial | **SIPUB Coordinador** | — | — |
| Tecnología, potencias, energía, duración | **Formulario** | listado, IA | IA sólo si las dos primeras están vacías, marcada MEDIUM |
| Región, comuna | listado | Formulario, SEIA | — |
| Coordenadas | **Formulario (UTM)** | — | Pendiente de persistir |
| Proceso y etapa de conexión | **Acceso Abierto** | — | Única fuente. Ni CNE ni SEIA opinan de esto |
| Punto de conexión, tensión, paño | **Formulario** | listado | — |
| Fecha declarada de conexión (COD) | **Acceso Abierto** | PGP (`operative_estimate_date`) | Ver R4 |
| Vía y estado ambiental | **SEIA** > pertinencia SEA | — | El Coordinador **nunca** define estado ambiental |
| RCA (fecha, número) | **SEIA** | — | Sin fecha/número no se afirma RCA |
| Declaración en construcción | **CNE** (acto administrativo) | Coordinador (estado del trámite) | Ver R3 |
| Avance físico | **PGP** | — | Única fuente |
| Puesta en servicio / operación | **CNE capacidad instalada** | PGP (estimadas) | — |
| Expansión modelada | **PELP** | — | Nunca alimenta estado |

### 14.2 Reglas de resolución

- **R1 — Precedencia por campo, no por fuente.** El Coordinador gana en conexión y pierde en ambiental. No existe una fuente "más confiable" en general.
- **R2 — A igual precedencia, gana el dato más reciente** por `source_date` (fecha del dato en la fuente), nunca por `collected_at` (cuándo lo bajamos). Un SEIA descargado ayer con estado de junio no le gana a un PGP de junio observado en junio.
- **R3 — Los hitos no retroceden por silencio.** Si CNE declara en construcción y el Coordinador aún no actualizó su estado, el hito se da por cumplido citando CNE. Si el Coordinador declara y CNE todavía no publica la resolución (su nómina es mensual), también — citando al Coordinador. **Se cita siempre quién lo confirma.** Si ambas se contradicen explícitamente (CNE retira el proyecto de la nómina), se muestra el conflicto.
- **R4 — Los conflictos materiales se muestran, no se resuelven en silencio.** Caso real en la base hoy:

  > **PFV Monte Águila (TL-1604, NUP 3904)** — COD declarado en Acceso Abierto: **2026-08-31**. Avance físico en PGP al 2026-08-07: **8 %** (esperado 98,7 %, desviación −90,7 pp). Estimación del propio titular en PGP: puesta en servicio **2027-03-21**, entrada en operación **2027-06-30**.

  La ficha no debe elegir una fecha. Debe mostrar: `COD declarado 31-08-2026 (Acceso Abierto)` · `EO estimada por el titular 30-06-2027 (PGP)` · badge **"Fuentes en conflicto: 10 meses de diferencia"**. Ese conflicto *es* la inteligencia de mercado — es exactamente el dato por el que un cliente paga.

- **R5 — Nunca inferir un hito desde otro.** Pertinencia ≠ RCA. Autorizado ≠ declarado. Declarado ≠ construyendo. Construyendo ≠ operando.
- **R6 — Todo conflicto detectado genera un `project_event`** de tipo `source_conflict`, para que quede en el historial y se pueda alertar al cliente.

---

## 15. PELP

**Hoy no existe.** Propuesta de incorporación **como capa prospectiva aislada**, que no toca ningún campo de estado:

```
pelp_scenario           (id, name, edition_year, description)      -- ej. "F2 - Exploratorio tendencial"
pelp_expansion          (id, scenario_id, technology, node, year, expansion_mw, source_url)
project_pelp_alignment  (project_id, expansion_id, relationship, rationale, computed_at)
                        relationship ∈ MATCHED | PARTIAL | UNMATCHED
```

Presentación en ficha, en su propia sección al final, con fondo distinto y encabezado explícito:

```
PELP ALIGNMENT                                    [ Capa prospectiva ]
Escenario           F2 — Exploratorio tendencial
Tecnología          Solar
Nodo                S/E Nueva Maitencillo
Horizonte           2040
Expansión modelada  500 MW
Relación            PARTIAL — mismo nodo y tecnología; 432 MW del proyecto
                    frente a 500 MW modelados para el horizonte 2040

El PELP es un ejercicio de planificación indicativa del Ministerio de Energía.
No confirma ni proyecta el estado, la viabilidad ni la fecha de este proyecto.
```

**Prohibiciones:** el PELP no entra en `normalized_status`, ni en madurez, ni en Ready to Build, ni en el score. `UNMATCHED` no es una señal negativa del proyecto.

---

## 16. Diseño visual propuesto

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚡ BESS ÁGUILA MORA                                          TL-1051 · NUP 4933│
│ Circinus SpA · Almacenamiento (BESS) · 300 MW / 1.200 MWh / 4 h              │
│ Antofagasta, María Elena · S/E Ana María 220 kV                              │
│                                                                              │
│ ┌─ ESTADO ────────────────────────────────────────────────────────────────┐ │
│ │ Oficial      "Proyecto autorizado para declararse en construcción"       │ │
│ │              Acceso Abierto · 11-08-2026                                 │ │
│ │ Transition   ADVANCED DEVELOPMENT          Confianza: ALTA               │ │
│ │ Ready to     UNKNOWN  ·  confianza MEDIA  ·  2 de 5 gates sin fuente     │ │
│ │ Build                                                                    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ HITOS CLAVE                                                                  │
│  ✓ Solicitud ingresada        07-2023   Acceso Abierto              ⓘ        │
│  ✓ Antecedente ambiental      04-09-2025 SEIA · DIA                 ⓘ        │
│  ✓ RCA favorable              04-09-2025 SEIA                       ⓘ        │
│  ✓ Conexión autorizada        11-08-2026 Acceso Abierto             ⓘ        │
│  — Declarado en construcción  sin registro en CEN ni en nómina CNE           │
│  — Obras iniciadas            sin registro en PGP                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ CONEXIÓN                          │ AMBIENTAL                                │
│ Proceso     SAC                   │ Vía        SEIA                          │
│ Etapa       AUTHORIZED_TO_DECLARE │ Estado     RCA_FAVORABLE                 │
│ Oficial     "Proyecto autorizado…"│ Oficial    "Aprobado" (DIA)              │
│ Punto       S/E Ana María 220 kV  │ Presentado 04-09-2025                    │
│ COD declar. 29-06-2027            │ Inversión  MMUSD 336                     │
│ En pausa    No                    │ Expediente ↗ seia.sea.gob.cl             │
├──────────────────────────────────────────────────────────────────────────────┤
│ CONSTRUCCIÓN                                                                 │
│ Preparación (TL)    Gates 1,2,5 cumplidos · 3 y 4 sin fuente                 │
│ Estado oficial      Sin declaración de construcción (CEN ni CNE)             │
│ Estado físico       Sin registro en PGP — no hay evidencia de obras          │
├──────────────────────────────────────────────────────────────────────────────┤
│ LÍNEA DE TIEMPO          ● observado   ◌ estimado                            │
│  ●───────●──────────●────────────◌────────────◌────────────◌                 │
│  Sol.   RCA    Autoriz.       Declar.       Const.        COD                │
│  2023  09-25    08-26       (estimado)                  06-2027              │
│  [ ] Superponer escenario estimado (modelo hacia atrás desde el COD)         │
├──────────────────────────────────────────────────────────────────────────────┤
│ PELP ALIGNMENT · capa prospectiva      │ PROPIEDAD · CONTACTOS · RELACIONADOS│
├──────────────────────────────────────────────────────────────────────────────┤
│ FUENTES Y EVIDENCIA                                                          │
│ Campo              Fuente          Fecha        Confianza   Evidencia        │
│ Estado conexión    Acceso Abierto  11-08-2026   ALTA        ↗ portal         │
│ RCA                SEIA            04-09-2025   ALTA        ↗ expediente     │
│ Potencia           Formulario      —            ALTA        formulario SAC   │
│ Tecnología         Clasif. IA      14-07-2026   MEDIA       —                │
└──────────────────────────────────────────────────────────────────────────────┘
```

Jerarquía: **estado y hitos arriba** (lo que el cliente pregunta primero), procesos al medio, modelos y capas prospectivas abajo, evidencia al pie. El Health Score deja de competir con el estado: se muestra dentro del bloque de estado como ordenador secundario.

---

## 17. Tres proyectos reales en distintas etapas

Datos reales de la base al 2026-08-11.

### 17.1 Etapa temprana — Chamonate BESS (Ex Rosario BESS) · TL-0727

| | |
|---|---|
| Oficial | "Desarrollo de estudios y/o antecedentes" — Acceso Abierto, 11-08-2026 |
| Normalizado | `DEVELOPMENT` · confianza ALTA |
| Conexión | SAC · `STUDIES` · S/E Rosario 66 kV · COD declarado 31-12-2026 |
| Ambiental | Vía `UNKNOWN` — sin expediente SEIA ni pertinencia vinculada. BESS standalone a 66 kV > 23 kV ⇒ **debería** requerir antecedente ambiental por obras asociadas |
| Construcción | Preparación: NO · Oficial: sin declaración · Física: sin registro PGP |
| Ready to Build | `FALSE` — G1 falla (conexión no autorizada) |
| Madurez | `DEVELOPMENT` |
| Conflicto | COD 31-12-2026 con etapa `STUDIES`: quedan ~4 meses y el trámite no llegó a informe preliminar ⇒ **alerta de plausibilidad de cronograma (G6)** |

### 17.2 Listo para construir — BESS Águila Mora · TL-1051

| | |
|---|---|
| Oficial | "Proyecto autorizado para declararse en construcción" — Acceso Abierto |
| Normalizado | `ADVANCED_DEVELOPMENT` · confianza ALTA |
| Conexión | SAC · `AUTHORIZED_TO_DECLARE` · S/E Ana María 220 kV · COD 29-06-2027 |
| Ambiental | Vía `SEIA` · `RCA_FAVORABLE` (DIA, presentada 04-09-2025, MMUSD 336) |
| Construcción | Preparación: gates 1, 2 y 5 OK · Oficial: sin declaración · Física: sin PGP |
| Ready to Build | **`UNKNOWN`, confianza MEDIA** — G1, G2, G5 cumplidos; G3 (permisos) y G4 (terreno) sin fuente |
| Madurez | `ADVANCED_DEVELOPMENT`, primero en su categoría |

Este es el caso que hoy la ficha resuelve peor: se ve casi igual que un proyecto en estudios, cuando comercialmente es el más relevante de la cartera.

### 17.3 En construcción con desviación — PFV Monte Águila · TL-1604

| | |
|---|---|
| Oficial | "Proyecto declarado en construcción" — Acceso Abierto |
| Normalizado | `UNDER_CONSTRUCTION` · confianza ALTA |
| Conexión | SUCTD · `DECLARED_IN_CONSTRUCTION` · Línea 2x220 kV Santa María–Charrúa · COD declarado 31-08-2026 |
| Ambiental | `RCA_FAVORABLE` (DIA, 21-12-2023, MMUSD 264) |
| Construcción | Oficial: declarado (CEN) — **falta la resolución CNE por desconexión de esa fuente** · Física: **8 %** al 07-08-2026 |
| Ready to Build | `TRUE` (superado: ya está en construcción) |
| Madurez | `UNDER_CONSTRUCTION` |
| **Conflicto** | COD declarado 31-08-2026 (dentro de 20 días) vs. 8 % de avance físico y estimación del propio titular en PGP: PES 21-03-2027, EO **30-06-2027**. **Desviación −90,7 pp.** La ficha debe mostrar las dos fechas y el badge de conflicto, no elegir |

---

## 18. Impacto en el esquema

**Se reutiliza** (sin duplicar nada): `project`, `project_connection`, `connection_status`, `data_attribution`, `project_event`, `data_source`, `entity_relationship`, `seia_record`, `pertinencia_consulta`, `pgp_project_progress_observation`, `construction_project`, `power_plant`, `ownership_*`.

**Cambios mínimos propuestos**, en orden de razón calidad/esfuerzo:

| # | Cambio | Por qué | Esfuerzo |
|---|---|---|---|
| 1 | `connection_status` += `stage_normalized`, `stage_order`, `is_on_hold`, `is_terminal`; deduplicar slugs; FK `project.connection_status_code` | Convierte la normalización hardcodeada en dato consultable. Elimina D1, D2 | Bajo |
| 2 | Persistir UTM del Formulario → `location.latitude/longitude` (`utmToLatLng` ya existe) | Desbloquea mapa y análisis geográfico. Elimina D9 | Bajo |
| 3 | Persistir `completition_pes` de PGP | Ya se calcula y se tira. Habilita `COMMISSIONING` | Muy bajo |
| 4 | `seia_record` += `rca_date`, `rca_number`, `last_checked_at` + job de refresco | Sin esto no se puede afirmar "RCA favorable". Elimina D10, D12 | Medio |
| 5 | `construction_project.project_id` + matcher por nombre/propietario (mismo patrón que `seia/match.ts`) | Trae el acto administrativo de CNE a la ficha. Elimina D5 | Medio |
| 6 | `project_status_assessment` (normalized_status, confidence, as_of, ready_to_build, rtb_confidence, reasons jsonb, computed_at) | Único lugar donde vive la conclusión de Transition Latam, con su historial | Medio |
| 7 | `data_attribution` += `source_url`, `source_ref`; extender cobertura a todos los campos de ficha | Provenance real. Elimina D7 | Medio |
| 8 | Renderizar `project_event` en la ficha + nuevos tipos de evento | El dato ya está. Elimina D8 | Bajo |
| 9 | Automatizar el matcheo de pertinencias (2.239 pendientes) | Elimina D11 | Medio |
| 10 | `project_permit` (permisos y derechos de terreno) | Único camino para que RTB llegue a confianza ALTA (G3, G4) | Alto — requiere fuente nueva |
| 11 | `pelp_scenario` / `pelp_expansion` / `project_pelp_alignment` | §15 | Alto — requiere fuente nueva |
| 12 | `project_workstream` (ingeniería/compras como intervalos solapables) | §10, sólo cuando haya evidencia | Medio |

**Lo que NO recomiendo:**

- Crear una tabla nueva de "milestones" — se derivan de `project_event` + estados; duplicarlas garantiza que se desincronicen.
- Reemplazar `project.status` por el código normalizado. El texto crudo debe seguir siendo el que se muestra como "oficial" (y es lo que hoy hace bien la ficha).
- Botar el cronograma estimado. Es un buen modelo, está bien etiquetado y es diferenciador; sólo debe dejar de ocupar el lugar de la evidencia.
- Un score único como titular de la ficha.

---

## 19. Preguntas abiertas que conviene cerrar antes de implementar

1. **G3/G4 de Ready to Build**: ¿se conecta una fuente de permisos/terreno, o se acepta que RTB tope en confianza MEDIA? Es la decisión que más cambia el valor comercial de la sección.
2. **CNE Declaración en Construcción**: ¿se automatiza la descarga del XLSX o se asume carga manual mensual con sello de frescura visible?
3. **Refresco de SEIA**: ¿job periódico sobre los 177 expedientes ya vinculados, o sólo re-consulta bajo demanda desde la ficha?
4. **PELP**: ¿qué edición y qué escenarios se cargan? El PELP tiene varios escenarios y mezclarlos sin declarar cuál es cuál sería peor que no tenerlo.
5. **Nomenclatura de cara al cliente**: los estados normalizados están propuestos en inglés (`READY_TO_BUILD`) siguiendo tu enunciado; la UI está en español/inglés con `AppLocale`. Definir si el badge se traduce o se mantiene el término de industria.
