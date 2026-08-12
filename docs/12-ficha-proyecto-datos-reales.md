# 12 — Ficha de Proyecto construida sobre los datos que ya tenemos

**Estado:** modelo conceptual para validar. No implementado.
**Fecha:** 2026-08-11 · **Actualizado 2026-08-12** tras corregir el bug de cobertura de PGP

> ## Actualización — la cobertura de PGP se duplicó
>
> El perfilado original se hizo con el job de PGP leyendo sólo las primeras 1.000 filas de `project` (falta de paginación contra el tope de PostgREST). Corregido en [runSync.ts](../lib/ingestion/sources/pgp/runSync.ts) y re-ejecutado el ciclo completo, los elegibles pasaron de 88 a **230** y los datos disponibles cambiaron así:
>
> | Dato | Antes del fix | **Después** |
> |---|---|---|
> | Proyectos con avance físico | 73 | **170** (280 observaciones) |
> | Declarados en construcción **sin** información de obra | 147 | **50** |
> | `reception_date` | 71 | **161** |
> | `construction_declaration_date` | 15 | **55** |
> | `service_date` (PES registrada) | 50 | **128** |
> | `operative_date` (EO registrada) | 27 | **94** |
> | Proyectos con desviación de cronograma calculable | 72 | **163** |
> | ↳ con atraso > 90 días | 54 (75%) | **138 (85%)** |
> | ↳ desviación promedio | +495 días | **+750 días** |
> | ↳ desviación máxima | +1.988 días | **+2.396 días** |
>
> Dos tercios del que parecía ser el mayor vacío de datos era un bug propio. **Las cifras de PGP en el cuerpo del documento son las anteriores al fix** salvo donde se indique; las de esta tabla son las vigentes. Se conservan las originales porque muestran cómo un límite silencioso de la capa de datos se lee, desde arriba, como una carencia de la fuente.
>
> Efecto secundario relevante: hoy **ningún** proyecto declarado en construcción reporta 0% de avance (99 en ejecución, 71 completos). La regla R2 existe y no tiene casos — se mantiene porque el escenario es real y volverá a aparecer.
**Regla de este documento:** ningún campo, estado o regla aparece acá si no se puede construir con datos que **hoy existen en la base o que la fuente ya nos entrega**. Todo lo demás va a la sección DATA GAPS.

Reemplaza el diseño de [11-arquitectura-ficha-proyecto.md](11-arquitectura-ficha-proyecto.md) en lo que se contradigan. Tres correcciones al doc 11, encontradas al perfilar los datos reales:

| Doc 11 decía | Realidad medida |
|---|---|
| "PGP no expone fechas reales de PES/EO — verificado y confirmado ausente" | **Falso.** `service_date` (50 proyectos) y `operative_date` (27) están en el `source_payload` que ya guardamos en cada observación |
| `completition_pes` habilita el estado COMMISSIONING | **Falso.** Vale `0` en las 178 observaciones. No sirve para nada hoy |
| "No hay coordenadas" | Matizado: `location.latitude` = 0/260, pero `power_plant` tiene 1.242 puntos georreferenciados |

Además, entre la escritura del doc 11 y este: **PELP dejó de ser inexistente.** Hay ingesta escrita ([lib/ingestion/sources/pelp/](../lib/ingestion/sources/pelp/), [scripts/sync-pelp.ts](../scripts/sync-pelp.ts)) y migración ([20260812000000_pelp_expansion.sql](../supabase/migrations/20260812000000_pelp_expansion.sql)) — **la migración todavía no está aplicada: no hay ninguna tabla `pelp_*` en la base**. Se trata en §10.

---

# 1. Inventario real de datos

Perfilado columna por columna contra la base de producción, 2026-08-11. `USO` = si el campo se usa hoy en la ficha. `FICHA` = si sirve para la ficha propuesta.

## 1.1 `project` — 2.096 filas

| CAMPO | TIPO | FUENTE | EJEMPLO | POBLADO | USO HOY | CALIDAD | FICHA |
|---|---|---|---|---|---|---|---|
| `id` | uuid | interno | `15963329-…` | 100% | sí | — | interno |
| `name` | text | Acceso Abierto listado | `PFV Monte Águila` | 100% (1.986 distintos de 2.096) | sí | **110 nombres repetidos** entre proyectos | ✅ |
| `internal_code` | text | interno | `TL-1604` | 100% | sí | única | ✅ |
| `external_reference` | text | Acceso Abierto (id solicitud) | `2876` | 100% | sí (detalle de barra) | única | ✅ |
| `nup` | text | Acceso Abierto | `3904` | 87% (1.821) | sí (link PGP) | 18 NUP repetidos | ✅ |
| `technology_id` | uuid | listado > IA por nombre | Solar | 99% | sí | 10 tecnologías; 1.419 asignadas por IA | ✅ con marca de confianza |
| `project_kind` | text | listado | `storage` | 98% | sí | 4 valores | ✅ |
| `capacity_mw` | numeric | Formulario > listado | `240` | **27% (557)** | sí | el listado casi no trae potencia | ✅ con "no informado" |
| `capacity_mwh` | numeric | Formulario | `2000` | 16% (326) | sí | — | ✅ |
| `generation_capacity_mw` | numeric | Formulario | `48` | 18% (369) | sí | — | ✅ |
| `storage_capacity_mw` | numeric | Formulario | `200` | 16% (344) | sí | — | ✅ |
| `storage_hours` | numeric | Formulario | `5` | 18% (375) | sí | — | ✅ |
| `net_injection_mw` / `net_withdrawal_mw` | numeric | Formulario | `60` / `7` | 11% / 5% | sí | — | ✅ |
| `includes_storage` | boolean | derivado | `true` | 100% | sí | — | ✅ |
| `status` | text | Acceso Abierto | `Proyecto declarado en construcción` | 100% | sí (eje central) | **28 variantes crudas para ~14 estados** | ✅ como *official* |
| `estimated_connection_date` | date | Acceso Abierto | `2027-06-30` | 98% (2.050) | sí | declarada por el titular | ✅ |
| `construction_start_date` | date | — | — | **0%** | no | **columna muerta: nadie la escribe** | ❌ hoy |
| `location_id` | uuid | listado | — | 100% | sí | 260 ubicaciones para 2.096 proyectos (agrupadas por comuna) | ✅ |
| `developer_company_id` | uuid | listado/Formulario | — | 100% (617 empresas) | sí | — | ✅ |
| `spv_id` | uuid | Formulario | — | 57% (1.197) | sí | — | ✅ |
| `verified_at` | timestamptz | editorial interno | `2026-07-29` | 9% (198) | sí (gates de UI) | — | ✅ como confianza |
| `editorial_status` | text | interno | `published` | 100% | sí | 3 valores | interno |
| `detected_at` / `published_at` | timestamptz | interno | — | 100% / 96% | no | ≠ fecha de la solicitud | interno |
| `needs_reverification` / `reverification_reason` | bool/text | interno | `El estado retrocedió de…` | 100% / 0,2% (5) | admin | **señal de conflicto ya implementada** | ✅ |
| `ai_screened_at`, `ai_data_sanity`, `ai_data_sanity_reason`, `ai_seia_pick`, `ai_seia_pick_reason` | — | IA | `ok` | 2% (51) | admin | cobertura mínima | ⚠️ sólo admin |
| `prefilter_*` | text | IA | `out_of_scope` | 5% (96) | admin | — | ❌ |
| `country_id`, `created_at`, `updated_at` | — | interno | — | 100% | — | 1 solo país | interno |

## 1.2 `project_connection` — 2.096 filas (1:1 con project)

| CAMPO | TIPO | FUENTE | EJEMPLO | POBLADO | USO HOY | CALIDAD | FICHA |
|---|---|---|---|---|---|---|---|
| `request_type` | text | Acceso Abierto | `SUCTD` | 100% | sí | **6 valores para 3 procesos**: SAC 1.272, SUCTD 575, FEHACIENTES 166, FEHACIENTE 43, SASC 24, SUCT 16 | ✅ normalizando |
| `connection_point` | text | Formulario > listado | `S/E Ana María 220 kV` | 99% | sí | 1.475 distintos, texto libre | ✅ |
| `voltage_level` | text | listado | `220` | 99% | sí | 27 valores; número pelado sin unidad | ✅ |
| `substation_bay` | text | listado | `Por Definir` | 99% | **no** | 648 distintos, incluye "Por Definir" | ✅ nuevo |
| `transmission_segment` | text | listado | `Dedicada` | 97% | **no** | limpio: Dedicada 768, Zonal 643, Nacional 622, Polos de Desarrollo 1 | ✅ **nuevo y valioso** |

## 1.3 `connection_status` — 38 filas

| CAMPO | POBLADO | CALIDAD | FICHA |
|---|---|---|---|
| `code` | 100% | 38 códigos para **27 etiquetas** → slugs duplicados de dos generaciones | base para normalizar |
| `label` | 100% | duplicados por mayúsculas/tildes | — |
| `description` | **0%** | vacía | ❌ |

**Ninguna FK apunta a esta tabla.** `project.status` guarda el label crudo. La normalización real vive hardcodeada en [projectStatusMaturity.ts](../lib/shared/projectStatusMaturity.ts).

## 1.4 `seia_record` — 234 filas (177 vinculadas a proyecto)

| CAMPO | TIPO | EJEMPLO | POBLADO | CALIDAD | FICHA |
|---|---|---|---|---|---|
| `project_id` | uuid | — | 76% (177) | 145 vinculados con confianza media/baja | ✅ |
| `seia_id` | text | `2150864181` | 100% | única | ✅ |
| `submission_type` | text | `DIA` | 100% | 2 valores (DIA/EIA) | ✅ |
| `status` | text | `Aprobado` | 100% | 7 valores: Aprobado 186, En Calificación 29, Desistido 8, No calificado 4, Rechazado 3, No Admitido 3, Caducado 1 | ✅ |
| `filed_at` | date | `2023-12-21` | 100% | **hay un `1999-08-19` en un BESS → match malo** | ✅ |
| `investment_amount` | numeric | `264000000` | 100% | USD | ✅ |
| `titular_name` | text | `Red Eléctrica del Norte 2 S.A` | 100% | 208 distintos | ✅ contraste con titular TL |
| `url_ficha` | text | `seia.sea.gob.cl/…` | 100% | — | ✅ evidencia |
| `region` / `comuna` | text | `Región de Antofagasta` | 100% | ✅ contraste de ubicación | ✅ |
| `descripcion_tipologia` | text | `Líneas de transmisión eléctrica de alto voltaje` | 100% | 6 valores | ✅ |
| `tipo_proyecto_code` | text | `b1` | 100% | 5 valores, código SEIA | ⚠️ |
| `filing_reason` | text | `Ingreso previo a la publicación D.S. Nº30/2024,` | 100% | 4 valores | ⚠️ |
| `match_confidence` | text | `media` | 100% | **alta 82 · media 114 · baja 38** | ✅ como confianza |
| `match_method` | text | `nombre_normalizado_region` | 100% | 2 métodos | ✅ trazabilidad |
| `synced_at` | timestamptz | `2026-07-21` | 100% | **nunca se refresca** | ✅ como frescura |
| **RCA date / RCA number** | — | — | **no existen** | — | ❌ GAP crítico |

## 1.5 `pertinencia_consulta` — 2.247 filas (8 vinculadas)

| CAMPO | EJEMPLO | POBLADO | CALIDAD | FICHA |
|---|---|---|---|---|
| `estado` | `Resuelta` | 100% | 4 valores | ✅ |
| `sub_estado` | `Resuelta - No ingreso al SEIA` | 97% | 5 valores | ✅ |
| `requiere_ingreso` | `No` | 95% | Sí/No | ✅ |
| `fecha_presentacion` / `fecha_respuesta` | `2026-07-24` | 100% / 98% | limpias | ✅ |
| `tipologia_seia` | `Líneas de transmisión…` | 100% | 99 distintas | ✅ |
| `descripcion` | texto largo | 100% | descripción real del proyecto | ✅ |
| `documentos` | jsonb | 100% | URLs de resoluciones SEA | ✅ evidencia |
| `titular_rut` | `9993068-3` | 99% | **cruce directo con `company.rut`** | ✅ clave de matching |
| `suggested_project_id` / `suggested_match_score` | — | 59% (1.319) | score 0–100, 12 valores | ✅ para acelerar el cruce |
| `matched_project_id` / `match_status` | — | **0,4% (8)** | 2.239 pendientes | ❌ cuello de botella |
| `tipo_proyecto` | — | **0%** | columna vacía | ❌ |

## 1.6 `pgp_project_progress_observation` — 178 filas · 73 proyectos · 10 fechas de observación

**Columnas materializadas**

| CAMPO | EJEMPLO | POBLADO | USO HOY | FICHA |
|---|---|---|---|---|
| `progress_percent` | `8.00` | 100% | sí (barra) | ✅ |
| `declared_cod_snapshot` | `2026-10-07` | 100% | no | ✅ detecta cambios de COD |
| `project_status_snapshot` | `Proyecto declarado en construccion` | 100% | no | ✅ |
| `expected_progress_percent` / `deviation_pp` | `98.70` / `-90.70` | 84% | sí | ⚠️ **es un modelo nuestro** (`pdte-progress-1.0`), no PGP |
| `service_estimate_date` / `operative_estimate_date` | `2027-03-21` / `2027-06-30` | 53% / 52% | sí (tooltip) | ✅ |
| `observed_at` | `2026-08-11` | 100% | sí | ✅ frescura |
| `source_url` | `pgp.coordinador.cl/irequests/…` | 100% | sí | ✅ evidencia |
| `nup` | `4889` | 100% | sí | ✅ |
| `source_payload` | jsonb completo | 100% | **NO SE USA** | ✅ ver abajo |

**Dentro de `source_payload` — 34 claves ya almacenadas y nunca leídas** (medido sobre la última observación de cada uno de los 73 proyectos):

| CLAVE | QUÉ ES | POBLADO | FICHA |
|---|---|---|---|
| `reception_date` | Fecha de recepción de la solicitud en PGP | 71/73 | ✅ hito real |
| `construction_declaration_date` | **Fecha de declaración en construcción** | 15/73 | ✅ hito real |
| `service_date` | **Puesta en servicio (fecha registrada, no estimada)** | 50/73 | ✅ ⚠️ ver nota |
| `operative_date` | **Entrada en operación (fecha registrada)** | 27/73 | ✅ ⚠️ ver nota |
| `description` | Descripción técnica redactada del proyecto (MW, MWh, punto de conexión, línea) | 100% | ✅ **reemplaza la descripción autogenerada** |
| `applicant.name` | Empresa solicitante en PGP | 100% | ✅ contraste de titular |
| `project_type` | `{Fotovoltaica \| Almacenamiento de Energia \| Eólica \| Hidroeléctrica \| Gas \| Consumo \| Dedicado}` + `type` GX/CX/TX | 100% | ✅ valida tecnología |
| `process_type` | `Relevante` / `Automatismo` | 100% | ✅ |
| `extra_data` | `{region, commune, tension_level, connection_point}` | 100% | ✅ corrobora conexión |
| `name` | Nombre del proyecto en PGP (a veces distinto: *PSF Torino* ↔ *PMG Venezia Solar*) | 100% | ✅ alias |
| `phases` | 50–65 fases con `short_name`, requisitos y tareas | 100% | ⚠️ ver §6 |
| `phases_context` | Estado por fase: `is_ready`, `is_active`, `completition_status`, plazos por tarea | 100% | ⚠️ ver §6 |
| `completition_pes` | Avance de puesta en servicio | **`0` en las 178** | ❌ inservible hoy |
| `finished` / `published` | Banderas | **`false` en las 178** | ❌ |
| `stage` | Etapa numérica | 15/73, sin diccionario | ❌ NEEDS_EXTERNAL_CONFIRMATION |
| `synchronization_central_date` | — | 23/178 | ⚠️ |
| `manager`, `involved`, `substitute_admin`, `template_referenced`, `version`, `visible`, `is_super`, `cup_applicant`, `super_application_id`, `flow` | metadata operativa del Coordinador | — | ❌ |

> **Nota sobre `service_date` / `operative_date`:** no son inequívocamente "fecha real de operación". De los 27 con `operative_date`, 18 tienen 100% de avance (coherente) pero **9 tienen menos de 100%**, incluido un caso con 3%. Son fechas *registradas en el expediente*, y su semántica exacta requiere confirmación → `NEEDS_EXTERNAL_CONFIRMATION`. Usables como hito sólo cuando concuerdan con `progress_percent = 100`.

## 1.7 `construction_project` (CNE Declaración en Construcción) — 193 filas

| CAMPO | EJEMPLO | POBLADO | CALIDAD | FICHA |
|---|---|---|---|---|
| `proyecto_central` | `PMG Santa Barbara` | 100% | **sólo 11 de 193 matchean por nombre exacto con `project`** | ⚠️ requiere matcher |
| `proyecto_bess_asociado` | `PMG San Marcos` | 23% | — | ✅ |
| `propietario` | `Santa Barbara SPA` | 100% | 183 distintos | ✅ clave de match |
| `potencia_neta_mw` | `9` | 100% | — | ✅ |
| `res_original` | `564/2022` | 100% | 152 distintas | ✅ **evidencia citable** |
| `num_res` / `fecha_res` | `338` / `2026-06-30` | 100% | **un solo valor: sólo tenemos la resolución vigente, no la serie** | ✅ |
| `fecha_original_interconexion` / `fecha_estimada_interconexion` | `2022-12-01` / `2023-07-01` | 99% / 100% | **par original vs vigente = atraso oficial CNE** | ✅ muy valioso |
| `region` | `Región de [caracter corrupto]uble` | 100% | **mojibake de encoding** | ⚠️ |
| `synced_at` | `2026-07-22` | 100% | congelada hace 3 semanas | ⚠️ |
| **`project_id`** | — | **no existe** | — | ❌ GAP crítico |

## 1.8 `power_plant` (CNE capacidad instalada) — 1.245 filas

| CAMPO | EJEMPLO | POBLADO | FICHA |
|---|---|---|---|
| `name`, `owner_name` | `CH COCHAMO`, `INVERGES (*)` | 100% | ✅ |
| `status` | `Operativa` | 100% (2 valores) | ✅ **única prueba de operación** |
| `net_capacity_mw` / `gross_max_power_mw` | `0.68` | 100% | ✅ |
| `latitude` / `longitude` | `-44.83 / -72.77` | **99,8% (1.242)** | ✅ **las únicas coordenadas de la base** |
| `utm_zone` / `utm_east` / `utm_north` | `WGS 84 huso 18` | 99,9% | ✅ |
| `technology_detail` | `Hidráulica Pasada` | 100% (19 valores) | ✅ |
| `operation_start_date` | — | **0%** | ❌ no hay COD real por acá |
| `connection_point`, `installation_code`, `min_technical_power_mw`, `own_consumption_mw`, `provincia`, `energy_conversion` | — | **0%** | ❌ columnas muertas |
| **link a `project`** | — | **no existe** (4 de 1.245 matchean por nombre exacto) | ❌ GAP |

## 1.9 `project_event` — 2.388 filas

| CAMPO | EJEMPLO | POBLADO | FICHA |
|---|---|---|---|
| `event_type` | `announced` 2.253 · `status_change` 94 · `seia_milestone` 37 · `connection_date_change` 4 | 100% | ✅ |
| `occurred_at` | **`2017-01-08`** (la más antigua) | 100% | ✅ **para `announced` es la fecha real de recepción de la solicitud**, no nuestra detección |
| `new_value` | `{"status":"Aprobado","expediente":"…"}` | 100% | ✅ |
| `previous_value` | `{"status":"Proyecto autorizado…"}` | **4% (98)** | ✅ donde exista |
| `description` | `Cambió el estado de la solicitud: "X" → "Y"` | 100% | ✅ texto listo para timeline |
| `data_source_id` | 2 fuentes | 100% | ✅ |
| `confidence_level` | `PUBLICO` | 100% (1 valor) | ⚠️ sin variación |

**No se muestra en ninguna parte de la ficha.** Es el activo peor aprovechado de la base.

## 1.10 `data_attribution` — 10.065 filas

Cubre **5 campos** (`status` 2.969, `estimated_connection_date` 2.873, `capacity_mw` 2.782, `technology_id` 1.419, `capacity_mwh` 22) sobre **2.969 proyectos**, desde 2 fuentes. `source_date` poblado 86%. `confidence_level`: `PUBLICO` / `INTELIGENCIA_DE_MERCADO`. `verification_status`: siempre `unverified`. `is_current`: siempre `true`. `entity_type`: siempre `project`. **Sin `source_url`.** No se renderiza.

## 1.11 Resto de tablas relevantes

| TABLA | FILAS | LO QUE APORTA A LA FICHA | CALIDAD |
|---|---|---|---|
| `entity_relationship` | 9.701 | Contactos por rol (`legal_representative` 1.237+743, `project_coordinator_1/2`), `developed_by` 1.641, `parent_company` 1.664 | **147 tipos de relación**: los 5 canónicos conviven con cargos crudos ("Senior Grid Engineer", "Empresa:"). `valid_from/to` 0% |
| `company` | 942 | Nombre, RUT (52%), razón social (52%), domicilio legal (53%) | RUT ausente en la mitad |
| `spv` | 1.197 | Sociedad vehículo | — |
| `location` | 260 | comuna (100%), región (90%) | **coordenadas 0%** |
| `substation` | 973 | Nombre, propietario, N° transformadores, MVA, niveles de tensión | **sin coordenadas**; no está vinculada a `project_connection` |
| `coordinador_empresa` | — | Grupo empresarial (se usa hoy) | — |
| `ownership_entity` / `ownership_relation` / `project_ownership_profile` | 47 / 35 / **12** | Cadena societaria verificada, % de propiedad, `coverage_status` | Sólo 12 proyectos. Fuente: "Información societaria provista por ONIX", 2026-08-04 |
| `formulario_ingest_log` | 1.360 | **Qué proyectos tienen Formulario procesado**: success 1.184, parse_error 111, no_formulario 46, no_documents 19 | ✅ indicador de completitud por proyecto |
| `schedule_calibration_stat` | 5 | Deslizamiento medio de COD por desarrollador | `construction_lag_*` en 0 muestras |
| `project_preverification` | — | Evidencia de la preverificación IA | Sólo admin |
| `technology` | 12 | Catálogo | limpio |
| `data_source` | 7 | Catálogo de fuentes con `base_url` | ✅ base de la provenance |
| `pelp_*` | **0 (migración sin aplicar)** | ver §10 | — |

---

# 2. Mapa tabla → campo → fuente

```
Acceso Abierto (listado, diario)
  └─ project: name, external_reference, nup, status, estimated_connection_date,
              technology_id, project_kind, capacity_*, net_*
  └─ project_connection: request_type, connection_point, voltage_level,
                         substation_bay, transmission_segment
  └─ project_event: announced (fecha real de solicitud), status_change,
                    connection_date_change
  └─ data_attribution: status, capacity_mw, estimated_connection_date, capacity_mwh

Acceso Abierto (Formulario por proyecto, a demanda) — 1.184 procesados OK
  └─ company: name, rut, legal_name, legal_address
  └─ spv, person, entity_relationship (contactos por rol)
  └─ project: desglose de potencias donde el listado dejó null
  └─ formulario_ingest_log: trazabilidad del procesamiento
  ✗ NO persiste: UTM del proyecto, fecha estimada de construcción, fecha estimada de operación

SEIA (a demanda, sin job)
  └─ seia_record: 21 campos + match_confidence + url_ficha
  └─ project_event: seia_milestone (37)

SEA Pertinencias (diario)
  └─ pertinencia_consulta: 24 campos, incl. titular_rut y documentos

PGP (diario)
  └─ pgp_project_progress_observation: 15 columnas + source_payload con 34 claves

CNE Declaración en Construcción (manual, 2026-06-30)
  └─ construction_project: 17 campos, SIN vínculo a project

CNE Capacidad Instalada (semanal)
  └─ power_plant: 27 campos incl. lat/long, SIN vínculo a project

SIPUB Coordinador (semanal)
  └─ coordinador_empresa, substation, transmission_line, power_plant

Análisis interno (IA + editorial)
  └─ project: technology_id (1.419), verified_at (198), ai_*, prefilter_*
  └─ project_preverification, schedule_calibration_stat

ONIX (manual)
  └─ ownership_entity, ownership_relation, project_ownership_profile (12)
```

---

# 3. Connection Intelligence — qué podemos mostrar HOY

### Official
`project.status` crudo (100%) + `project_connection.request_type` crudo (100%). Se muestran tal cual, con la fuente y `data_attribution.source_date`.

### Process — ✅ derivable hoy
| Normalizado | Crudos | Proyectos |
|---|---|---|
| `SAC` | SAC, SASC | 1.296 |
| `SUCTD` | SUCTD, SUCT | 591 |
| `PROYECTO_FEHACIENTE` | FEHACIENTE, FEHACIENTES | 209 |

### Stage — ✅ derivable hoy con reserva
Los 28 valores crudos colapsan a 11 etapas + 2 terminales. Es un ordenamiento **nuestro** del trámite, ya implementado y probado en `projectStatusMaturity.ts`; el orden relativo de "informe preliminar → observaciones → discrepancias" es interpretación → **NEEDS_EXTERNAL_CONFIRMATION** para el orden exacto, no para la clasificación.

Dos correcciones sobre lo implementado hoy:
1. **`ON_HOLD` deja de ser etapa.** Los 113 proyectos "Detenida a la espera de…" hoy reciben orden 78 (entre informe final y autorizado), lo que es un supuesto sin respaldo. Pasan a bandera: `on_hold = true` + `on_hold_reason`, conservando la última etapa alcanzada.
2. **Las variantes de mayúsculas se colapsan** antes de contar: 385+113 = 498 autorizados; 178+42 = 220 declarados.

### Timeline de conexión — parcialmente disponible
| Hito | ¿HOY? | Fuente real |
|---|---|---|
| Fecha de solicitud | ✅ **sí** | `project_event.announced.occurred_at` (2.253 eventos, desde 2017-01-08) |
| Cambios de etapa | ⚠️ **sólo desde 2026-07-20** | `project_event.status_change` (94 eventos, con `previous_value` en 98) |
| Cambios de fecha de conexión | ⚠️ 4 eventos | `project_event.connection_date_change` |
| Recepción en PGP | ✅ 71/73 | `source_payload.reception_date` |
| Autorización / admisibilidad / informes | ❌ | Sólo capturables hacia adelante vía `status_change` |
| Plazo para declarar construcción | ❌ | Ninguna fuente lo entrega → **NEEDS_EXTERNAL_CONFIRMATION** |

**Datos de conexión que hoy tenemos y no mostramos:** `substation_bay` (99%) y `transmission_segment` (97%, valores limpios: Dedicada / Zonal / Nacional / Polos de Desarrollo). El segmento es directamente relevante: define si la conexión es a instalación dedicada (y por tanto si aplica SUCTD o Proyecto Fehaciente).

---

# 4. Environmental Intelligence — qué podemos mostrar HOY

| Dato pedido | ¿HOY? | Fuente / campo | Cobertura |
|---|---|---|---|
| Vía ambiental (SEIA / pertinencia / no aplica) | ✅ parcial | existencia de `seia_record` o `pertinencia_consulta` confirmada; umbral por `environmentalReviewRules.ts` | 177 con SEIA · **8 con pertinencia** |
| DIA / EIA | ✅ | `seia_record.submission_type` | 100% de los 234 |
| Estado del expediente | ✅ | `seia_record.status` (7 valores) | 100% |
| Fecha de presentación | ✅ | `seia_record.filed_at` | 100% |
| Inversión declarada | ✅ | `seia_record.investment_amount` | 100% |
| Tipología | ✅ | `descripcion_tipologia` | 100% |
| Evidencia | ✅ | `url_ficha` + `documentos` de pertinencia | 100% |
| Confianza del vínculo | ✅ | `match_confidence` (alta 82 / media 114 / baja 38) | 100% |
| Frescura | ✅ | `synced_at` — **pero nunca se refresca** | 100% |
| Ingreso al SEIA requerido | ✅ | `pertinencia.requiere_ingreso` + `sub_estado` | 95% de 2.247 |
| **RCA favorable como hecho** | ⚠️ | Sólo `status = 'Aprobado'` | **GAP: sin fecha ni número de RCA** |
| **RCA date** | ❌ | no existe | **GAP CRÍTICO** |
| **RCA number** | ❌ | no existe | **GAP CRÍTICO** |
| RCA caducada / modificada | ❌ | `Caducado` existe como estado (1 caso); modificaciones no se distinguen | GAP |

**Regla que se cae por falta de datos:** no podemos afirmar "RCA favorable del DD-MM-AAAA, Res. Ex. N°X". Lo máximo defendible hoy es: **"Expediente SEIA aprobado (DIA, presentado el 21-12-2023) — ver ficha"**, citando `url_ficha`. Eso se muestra; la RCA fechada queda en GAP.

---

# 5. Construction Intelligence

| # | Estado | DATA AVAILABLE | SOURCE | FIELD | CONFIDENCE | Proyectos |
|---|---|---|---|---|---|---|
| 1 | Autorizado para declararse | **YES** | Acceso Abierto | `project.status` = "Proyecto autorizado…" (+ "Clasificado como Obra Menor") | ALTA | **499** |
| 2 | Declarado en construcción | **YES (parcial)** | Acceso Abierto | `project.status` = "Proyecto declarado…" | ALTA | **220** |
| 2b | ↳ con fecha de declaración | **YES** | PGP | `source_payload.construction_declaration_date` | ALTA | **15** |
| 2c | ↳ con resolución CNE citable | **NO** | CNE | `construction_project` sin `project_id` | — | 0 de 193 |
| 3 | Construcción físicamente iniciada | **YES (parcial)** | PGP | `progress_percent > 0` | ALTA | **72 de 73 con PGP** |
| 4 | Avance físico | **YES (parcial)** | PGP | `progress_percent` | ALTA | 73 (**3,5% de la cartera**) |
| 5 | Commissioning | **NO** | — | `completition_pes` = 0 en todas | — | 0 |
| 5b | ↳ proxy: puesta en servicio registrada | **YES (débil)** | PGP | `source_payload.service_date` | MEDIA ⚠️ | 50 |
| 6 | Operación | **YES (débil)** | PGP | `source_payload.operative_date` | MEDIA ⚠️ | 27 (18 coherentes con 100%) |
| 6b | ↳ vía CNE capacidad instalada | **NO** | CNE | `power_plant` sin `project_id` | — | 0 de 1.245 |

**El hallazgo que más importa (corregido tras el fix de cobertura):** de los 220 declarados en construcción, **50 siguen sin registro en PGP** — eran 147 antes de arreglar la paginación. Para esos 50 la plataforma **no puede decir si las obras empezaron**, y debe mostrarse como "sin información de obra", nunca como "en construcción". Para los otros 170 ahora sí hay avance físico con fuente.

---

# 6. PGP — convertir lo que ya guardamos en inteligencia

Todo lo de abajo sale de `pgp_project_progress_observation`, incluido el `source_payload` que hoy no se lee. Cobertura máxima: 73 proyectos.

### EXECUTION STATUS
```
progress_percent = 0            → "Declarado, sin avance reportado"      (1 proyecto)
0 < progress_percent < 100      → "En ejecución (X%)"                    (54)
progress_percent = 100 y operative_date presente → "Operación reportada" (18)
progress_percent = 100 sin operative_date        → "Obra completa, operación no reportada"
sin registro PGP                → "Sin información de obra"              (2.023)
```

### PROJECT TIMELINE (hitos reales de PGP)
`reception_date` (71) → `construction_declaration_date` (15) → `service_date` (50) → `operative_date` (27). Cuatro fechas por proyecto, con `source_url` a la ficha PGP.

### SCHEDULE STATUS / DEVIATION — ✅ el activo más fuerte que tenemos
`project.estimated_connection_date` (COD declarado al Coordinador) vs. `operative_estimate_date` (estimación del propio titular en PGP). **Ambas presentes en 72 proyectos.** Resultado medido:

| | Antes del fix | **Vigente** |
|---|---|---|
| Proyectos con ambas fechas | 72 | **163** |
| Atraso > 90 días | 54 (75%) | **138 (85%)** |
| En línea (±90 días) | 9 | **14** |
| **Desviación promedio** | +495 días | **+750 días (2 años)** |
| Máxima | +1.988 días | **+2.396 días** |

Es una contradicción **entre dos declaraciones del mismo titular a la misma autoridad**. No requiere ningún modelo nuestro.

### PHYSICAL PROGRESS
`progress_percent` (oficial) + `expected_progress_percent` / `deviation_pp` — con la advertencia de que estos dos **son un modelo nuestro** (`model_version = 'pdte-progress-1.0'`, curva S), no un dato de PGP. Deben etiquetarse ESTIMATE, no FACT. Hoy la ficha ya lo hace bien en el texto de la barra.

### Fases — ⚠️ NO usable como etapa
`phases` trae 50–65 fases por proyecto con nombres reales del proceso (CEM Definitiva, DUF, ANIT, SITR, Pruebas, Enlace…) y `phases_context` sus estados. Pero:
- `is_ready` es `false` en 3.807 de 3.809 fases → **no discrimina**.
- `is_active` es `true` en el 75% → tampoco.
- Los 7.684 archivos adjuntos tienen `created_at`, pero sólo **~2,9 fechas distintas por proyecto** → son cargas por lote, no fechas de hito.
- Lo único aprovechable: `deadline[].final` existe en 8.513 de 14.858 plazos → posible fecha de cierre por tarea, **pendiente de validar**.

**Conclusión:** el árbol de fases se guarda y se puede explorar, pero **no se publica como etapa del proyecto** hasta confirmar la semántica con el Coordinador → `NEEDS_EXTERNAL_CONFIRMATION`.

### Datos de PGP que además sirven para otras secciones
- `description`: descripción técnica real y específica. **Debería reemplazar la descripción autogenerada por plantilla** que hoy muestra la ficha (4 variantes elegidas por hash del id).
- `applicant.name` y `name`: contraste de titular y alias de nombre.
- `project_type` / `extra_data`: validación cruzada de tecnología, región, comuna, tensión y punto de conexión.

---

# 7. Relaciones entre variables (el núcleo)

Todas verificadas contra la base. `n` = proyectos que hoy caen en cada regla.

| # | INPUT | RULE | OUTPUT | CONFIDENCE | SOURCE | n |
|---|---|---|---|---|---|---|
| **R1** | `status = autorizado` + `seia.status = Aprobado` + sin declaración | Conexión autorizada y ambiental resuelta, sin declarar construcción | **`RTB_LIKELY`** — "habilitado para construir, aún no declarado" | ALTA (ambos hechos de fuente oficial) | AA + SEIA | **82** |
| **R2** | `status = declarado` + `pgp = 0%` | Trámite cerrado, sin obra reportada | **`DECLARED_NO_WORKS`** — señal comercial: declaró para no perder la capacidad | ALTA | AA + PGP | **1** |
| **R3** | `status = declarado` + `pgp > 0%` | Obra confirmada por el titular | **`UNDER_CONSTRUCTION`** + % | ALTA | AA + PGP | **72** |
| **R4** | `status = declarado` + **sin registro PGP** | No sabemos si hay obra | **`CONSTRUCTION_UNKNOWN`** — se muestra "sin información de obra" | — | AA | **50** (eran 147 antes del fix) |
| **R5** | `estimated_connection_date` + `operative_estimate_date` | Diferencia en días entre COD declarado al Coordinador y EO estimada por el titular en PGP | **`SCHEDULE_DEVIATION`** = +X días | ALTA (dos declaraciones del titular) | AA + PGP | **163** (138 con atraso >90d, prom. **+750d**) |
| **R6** | `seia.status = Aprobado` + `status = autorizado` + `construction_declaration_date` | Los tres hitos duros presentes | **`READY_TO_BUILD` con máxima evidencia disponible** | ALTA | AA + SEIA + PGP | **6** (sólo 6 proyectos activos tienen SEIA *y* PGP) |
| **R7** | `estimated_connection_date < hoy` + no declarado + no terminal | La fecha comprometida pasó sin declarar construcción | **`COD_OVERDUE`** — proyecto atrasado respecto de su propia declaración | ALTA | AA | **169** |
| **R8** | sin `seia_record` ni pertinencia + (`generation_capacity_mw > 3` o BESS con `voltage_level > 23`) | Debería tener antecedente ambiental y no lo tenemos vinculado | **`ENVIRONMENTAL_UNLINKED`** — vacío de matching nuestro, **no** falta del proyecto | MEDIA | derivado | **367** |
| **R9** | `status = declarado` + sin antecedente ambiental | No se llega legalmente a declarar sin resolver lo ambiental | **`ENVIRONMENTAL_ASSUMED_RESOLVED`** — se muestra como nota, nunca como RCA | MEDIA | derivado | (subconjunto de R8) |
| **R10** | `pertinencia.titular_rut` = `company.rut` + similitud de nombre | Cruce de pertinencia a proyecto por RUT | **vínculo sugerido** (`suggested_match_score` ya existe en 1.319) | MEDIA → ALTA al confirmar | SEA + Formulario | 1.319 candidatos |
| **R11** | `declared_cod_snapshot` (PGP) ≠ `estimated_connection_date` (AA) | El COD cambió entre fuentes u observaciones | **`COD_CHANGED`** + evento en timeline | ALTA | PGP + AA | calculable en 73 |
| **R12** | `construction_project.fecha_original_interconexion` vs `fecha_estimada_interconexion` | Atraso reconocido por la propia CNE | **`CNE_ACKNOWLEDGED_DELAY`** | ALTA | CNE | 192 filas (**bloqueado**: sin `project_id`) |
| **R13** | `seia_record.titular_name` ≠ `company.name` del proyecto | Titular ambiental distinto del solicitante de conexión | **`TITULAR_MISMATCH`** — revisar match o cambio de propiedad | MEDIA | SEIA + AA | calculable |
| **R14** | `match_confidence = baja` | Vínculo SEIA débil | Degradar toda conclusión ambiental a **BAJA** | — | interno | **38 (32 vinculados)** |
| **R15** | `needs_reverification = true` | El estado retrocedió | **`STATUS_REGRESSION`** — alerta | ALTA | interno | 5 |

**Lectura de negocio de las tres primeras:** R1 (82 proyectos) es la lista de "listos para construir" — el activo comercial más vendible de la plataforma. R4 (147) es el hueco de información más grande. R5 (72, +495 días promedio) es la evidencia dura de que el pipeline declarado no se cumple.

---

# 8. FACTS / DERIVED STATES / ESTIMATES

Separación obligatoria en la UI. Nada cruza de columna sin fuente.

| FACTS (de la fuente, citables) | DERIVED STATES (regla determinista sobre facts) | ESTIMATES (modelo nuestro) |
|---|---|---|
| `status` crudo + fecha | `connection_stage_normalized` | `expected_progress_percent` / `deviation_pp` (curva S) |
| `request_type` crudo | `connection_process` | Cronograma de fases (cálculo hacia atrás desde el COD) |
| `progress_percent` + `observed_at` | `EXECUTION_STATUS` (§6) | `cod_slippage_days_avg` (calibración por desarrollador) |
| `seia.status`, `submission_type`, `filed_at` | `environmental_pathway` + `environmental_status` | Health Score |
| `pertinencia.sub_estado`, `requiere_ingreso` | `RTB_LIKELY` / `NOT_RTB` (§10) | Etapa "estimada" de desarrollo |
| `estimated_connection_date` | `SCHEDULE_DEVIATION` (resta de dos facts) | Clasificación de tecnología por IA (1.419) |
| `operative_estimate_date`, `service_date`, `operative_date`, `construction_declaration_date`, `reception_date` | `COD_OVERDUE`, `CONSTRUCTION_UNKNOWN` | |
| Potencias, punto de conexión, tensión, segmento, paño | `maturity_category` (§9) | |
| `res_original`, `num_res`, `fecha_res` (CNE) | | |

Tratamiento visual: FACTS en texto normal con chip de fuente; DERIVED con badge de marca y tooltip con la regla; ESTIMATES en trama rayada con la palabra "Estimado" siempre visible.

---

# 9. Estados que podemos calcular HOY

Aplicando las reglas de §7 a los 2.096 proyectos:

| STATUS | REQUIRED DATA | AVAILABLE | SOURCE | RULE | **n hoy** |
|---|---|---|---|---|---|
| `WITHDRAWN` / `REJECTED` | `status` terminal | ✅ | AA | Desistida (298) / Rechazada (776) | **1.074** |
| `EARLY_DEVELOPMENT` | `status` ∈ {ingresada, admisibilidad} | ✅ | AA | — | **34** |
| `DEVELOPMENT` | `status` ∈ {estudios, revisión, informe preliminar, observaciones} | ✅ | AA | — | **97** |
| `ADVANCED_DEVELOPMENT` | `status` ∈ {discrepancias, fehaciente, informe final} | ✅ | AA | — | **48** |
| `AUTHORIZED` (sin ambiental) | `status` = autorizado, sin RCA vinculada | ✅ | AA | — | **417** |
| `RTB_LIKELY` | autorizado + `seia = Aprobado` | ✅ | AA + SEIA | R1 | **82** |
| `DECLARED_IN_CONSTRUCTION` | `status` = declarado, sin PGP | ✅ | AA | R4 | **147** |
| `UNDER_CONSTRUCTION` | declarado + `pgp > 0` | ✅ | AA + PGP | R3 | **46** |
| `OPERATIONAL` (débil) | `operative_date` presente | ⚠️ | PGP | 18 coherentes con 100% | **27** |
| `PROCESS_COMPLETED` | `status` = "Proyecto finalizado" | ✅ | AA | — | **10** |
| `ON_HOLD` (bandera) | `status` = "Detenida a la espera de…" | ✅ | AA | ortogonal | **113** |
| `IDENTIFIED` | sin solicitud de conexión | ✅ | — | hoy todo proyecto nace de una solicitud | **1** |

### Estados que NO podemos calcular hoy

| STATUS | POR QUÉ | QUÉ FALTA |
|---|---|---|
| `COMMISSIONING` | `completition_pes` = 0 en las 178 observaciones; no hay otro indicador | Confirmar con el Coordinador qué campo marca puesta en servicio, o usar `service_date` validado |
| `OPERATIONAL` con confianza ALTA | `power_plant` no está vinculada a `project`; `operation_start_date` vacío; `operative_date` incoherente en 9 de 27 | Matcher `project` ↔ `power_plant` + validar semántica de `operative_date` |
| `READY_TO_BUILD` **confirmado** | No hay datos de permisos sectoriales ni de terreno | ver §10 |
| Etapas de ingeniería / EPC / compras | Ninguna fuente las reporta; `phases` de PGP no discrimina | Confirmar semántica de `phases_context`, o dato del titular vía CRM |
| `DECLARED_IN_CONSTRUCTION` con resolución CNE | `construction_project` sin `project_id` | Matcher por nombre + propietario (hoy 11 de 193 por nombre exacto) |

---

# 10. Ready to Build con los datos reales

| Gate | Dato | ¿EXISTE HOY? | Cobertura |
|---|---|---|---|
| G1 · Autorización de conexión | `project.status` | ✅ | 100% |
| G2 · Resolución ambiental | `seia_record.status` / `pertinencia.sub_estado` | ⚠️ parcial | 177 + 8 de 2.096 |
| G3 · Declaración de construcción | `project.status` / `construction_declaration_date` | ✅ / ⚠️ | 220 / 15 |
| G4 · Avance físico | `pgp.progress_percent` | ⚠️ | 73 |
| G5 · Sin bloqueos | `status` terminal, `on_hold`, `needs_reverification` | ✅ | 100% |
| G6 · Permisos sectoriales | — | ❌ **MISSING DATA** | 0 |
| G7 · Terreno / servidumbres | — | ❌ **MISSING DATA** | 0 |

**Categorías construibles hoy** (G6 y G7 no existen, así que ninguna categoría puede llamarse "confirmada" en sentido pleno; se define `RTB_CONFIRMED` por el hecho posterior, que es más fuerte que cualquier gate):

| Categoría | Regla | n |
|---|---|---|
| **RTB_CONFIRMED** | Ya declarado en construcción o con obra en PGP — la construcción misma prueba que estaba listo | **220** |
| **RTB_LIKELY** | G1 (autorizado) + G2 (RCA aprobada) + G5 (sin bloqueos) | **82** |
| **NOT_RTB** | Terminal negativo, o G1 no alcanzado | **1.074 + 179** |
| **UNKNOWN** | G1 cumplido pero sin antecedente ambiental vinculado | **417** |

`rtb_confidence` topa en **MEDIA** para `RTB_LIKELY`: con G6 y G7 ausentes, ningún proyecto no-construido puede alcanzar ALTA. Es una limitación real, no del modelo, y así debe declararse en la UI: *"Basado en conexión y situación ambiental. No incluye permisos sectoriales ni derechos de terreno."*

---

# 11. Schedule Intelligence

| Métrica | ¿HOY? | Cálculo | Cobertura |
|---|---|---|---|
| COD declarado | ✅ | `project.estimated_connection_date` | 2.050 |
| COD histórico (cambios) | ⚠️ | `project_event.connection_date_change` (4) + `declared_cod_snapshot` (73) | limitada |
| Planned construction start | ❌ | `construction_start_date` vacío; el Formulario lo trae y no se persiste | 0 |
| Actual construction start | ⚠️ | `construction_declaration_date` (PGP) — es la declaración, no el inicio de obra | 15 |
| PES | ⚠️ | `service_date` (registrada) / `service_estimate_date` (estimada) | 50 / 95 |
| EO | ⚠️ | `operative_date` / `operative_estimate_date` | 27 / 93 |
| **Deviation** | ✅ | `operative_estimate_date` − `estimated_connection_date` | **72** |
| Delay reconocido por CNE | ⚠️ | `fecha_estimada_interconexion` − `fecha_original_interconexion` | 192 filas, **sin vínculo a proyecto** |
| Schedule confidence | ✅ | `match`/frescura de cada fecha + `schedule_calibration_stat` | 5 calibraciones |

**Sólo se calcula si existen ambos extremos.** Donde falte uno, la ficha muestra el dato disponible y omite la resta — no la aproxima.

---

# 12. Timeline construible HOY

Todos los eventos con `DATE · EVENT · SOURCE · SOURCE_URL · CONFIDENCE`:

| Evento | Fuente | Campo | Disponibles |
|---|---|---|---|
| Solicitud de conexión ingresada | Acceso Abierto | `project_event.announced.occurred_at` | **2.253** (desde 2017-01-08) |
| Cambio de estado del trámite | Acceso Abierto | `project_event.status_change` + `description` | 94 (sólo desde 2026-07-20) |
| Cambio de fecha de conexión | Acceso Abierto | `project_event.connection_date_change` | 4 |
| Expediente SEIA encontrado / hito | SEIA | `project_event.seia_milestone` | 37 |
| Presentación al SEIA | SEIA | `seia_record.filed_at` + `url_ficha` | 177 |
| Consulta de pertinencia presentada / resuelta | SEA | `fecha_presentacion` / `fecha_respuesta` + `documentos` | 8 vinculadas |
| Recepción en PGP | PGP | `source_payload.reception_date` | 71 |
| Declaración en construcción | PGP | `source_payload.construction_declaration_date` | 15 |
| Observación de avance físico | PGP | `progress_percent` + `observed_at` + `source_url` | 178 obs / 73 proyectos |
| Puesta en servicio registrada | PGP | `source_payload.service_date` | 50 ⚠️ |
| Entrada en operación registrada | PGP | `source_payload.operative_date` | 27 ⚠️ |

**Limitación que hay que decir en la UI:** salvo `announced` (que trae la fecha real de la solicitud) y las fechas de SEIA/PGP, el historial de cambios de estado **empieza el 2026-07-20**, cuando arrancó el pipeline. La ficha debe rotularlo: *"Historial observado por Transition Latam desde el 20-07-2026"*.

---

# 13. Ficha propuesta — sólo con datos existentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                      │
│ PFV Monte Águila                                    TL-1604 · NUP 3904      │
│ Grenergy Renovables Pacific Ltda · Solar · 240 MW                           │
│ Biobío, Cabrero · Línea 2x220 kV Santa María–Charrúa · Segmento: Nacional   │
│ [Sin coordenadas]                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ PROJECT STATUS                                                              │
│ Oficial      "Proyecto declarado en construcción"  · Acceso Abierto · 11-08 │
│ Proceso      SUCTD                                                          │
│ Etapa (TL)   DECLARED_IN_CONSTRUCTION                                       │
│ Ejecución    En ejecución — 8% de avance físico · PGP · 07-08-2026          │
│ Ready to     RTB_CONFIRMED (ya declarado)                                   │
│ Build                                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ KEY MILESTONES                              (— = sin dato, no = "no ocurrió")│
│ ✓ Solicitud ingresada           2023        project_event · Acceso Abierto  │
│ ✓ Expediente SEIA (DIA)         21-12-2023  SEIA ↗  · confianza de match: alta│
│ ✓ Expediente aprobado           —           SEIA (sin fecha de RCA) ⚠       │
│ ✓ Conexión autorizada           —           observado sólo desde 07-2026    │
│ ✓ Declarado en construcción     —           Acceso Abierto (sin fecha)      │
│ ✓ Obras iniciadas               07-08-2026  PGP · 8%                        │
│ — Puesta en servicio            sin registro                                │
│ — Operación                     sin registro                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ CONNECTION                        │ ENVIRONMENTAL                           │
│ Proceso      SUCTD                │ Vía         SEIA                        │
│ Etapa        DECLARED_IN_CONSTR.  │ Expediente  DIA · Aprobado              │
│ Oficial      "Proyecto declarado…"│ Presentado  21-12-2023                  │
│ Punto        Línea 2x220 kV S.M.–C│ Inversión   MMUSD 264                   │
│ Tensión      220 kV               │ Titular     (SEIA) vs (TL): coincide    │
│ Paño         —                    │ Match       alta · sincronizado 21-07   │
│ Segmento     Nacional             │ ⚠ Sin fecha ni número de RCA            │
│ En pausa     No                   │                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ CONSTRUCTION                                                                │
│ Autorizado         Sí (implícito por declaración)   Acceso Abierto          │
│ Declarado          Sí                               Acceso Abierto          │
│ Resolución CNE     Sin vincular ⚠                   (193 filas sin match)   │
│ Obra iniciada      Sí — 8%                          PGP · 07-08-2026        │
│ Avance esperado    98,7% · desviación −90,7 pp      ESTIMADO (curva S)      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PGP / EXECUTION                                                             │
│ Recepción PGP          —                                                    │
│ Avance físico          8%                          07-08-2026 ↗ PGP         │
│ PES estimada           21-03-2027                                           │
│ EO estimada            30-06-2027                                           │
│ Descripción (PGP)      [texto técnico real del expediente]                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCHEDULE                                                                    │
│ COD declarado (Coordinador)   31-08-2026                                    │
│ EO estimada (PGP, titular)    30-06-2027                                    │
│ ⚠ DESVIACIÓN                  +303 días — dos declaraciones del mismo       │
│                               titular que no coinciden                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ TIMELINE   ● hecho con fuente   ◌ estimado                                  │
│ ●2023 solicitud ─ ●21-12-2023 SEIA ─ ●07-08-2026 obra 8% ─ ◌30-06-2027 EO   │
│ Historial de cambios de estado observado desde el 20-07-2026                │
├─────────────────────────────────────────────────────────────────────────────┤
│ PELP            Sin datos — ingesta en desarrollo, migración sin aplicar    │
│ OWNERSHIP       SPV: Grenergy Renovables Pacific Ltda · cadena societaria   │
│                 no cargada (12 proyectos de 2.096 la tienen)                │
│ CONTACTOS       Rep. legal y coordinadores (Formulario) · según plan        │
│ EMPRESAS REL.   Grupo según Coordinador                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ SOURCES & EVIDENCE                                                          │
│ Campo             Fuente          Fecha       Confianza  Evidencia          │
│ Estado conexión   Acceso Abierto  11-08-2026  ALTA       ↗ portal           │
│ Expediente SEIA   SEIA            21-07-2026  ALTA       ↗ ficha            │
│ Avance físico     PGP             07-08-2026  ALTA       ↗ irequest         │
│ Potencia 240 MW   Formulario      —           ALTA       formulario SAC     │
│ Tecnología Solar  Clasificación IA 14-07-2026 MEDIA      —                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Secciones que hoy quedan vacías o casi**, y que la ficha debe declarar como tales en vez de rellenar: coordenadas (0%), PELP (sin datos), cadena societaria (12 de 2.096), paño (existe pero con "Por Definir" frecuente), fecha de RCA, resolución CNE.

---

# 14. DATA GAPS

### Critical — impiden determinar correctamente el estado

| # | Gap | Impacto medido | Origen |
|---|---|---|---|
| C1 | **`construction_project` sin `project_id`** | 193 declaraciones CNE con resolución citable no llegan a ninguna ficha; 0 proyectos pueden mostrar su resolución | falta matcher (11/193 por nombre exacto) |
| C2 | ~~147~~ → **50 declarados sin PGP** | **RESUELTO EN SU MAYOR PARTE.** Era un bug propio: la consulta de proyectos no paginaba y PostgREST corta en 1.000 filas, así que el job veía 88 elegibles de 230. Corregido; la cobertura pasó de 73 a 170 proyectos. Los 50 restantes sí son ausencia real de la fuente | [runSync.ts](../lib/ingestion/sources/pgp/runSync.ts) |
| C3 | **RCA sin fecha ni número** | No se puede afirmar "RCA favorable del DD-MM-AAAA" en ningún proyecto | `seia_record` no tiene las columnas |
| C4 | **SEIA sin refresco** | Los 177 vínculos conservan el estado del día del match; el más antiguo es del 21-07-2026 | no existe job |
| C5 | **2.239 pertinencias sin vincular** | La vía ambiental de casi toda la cartera queda `UNKNOWN`; 367 proyectos deberían tener antecedente | `matched_project_id` en 8 |
| C6 | **`status` sin normalizar en la base** | 28 variantes crudas; cualquier consulta debe normalizar en código | `connection_status` sin FK |
| C7 | **38 vínculos SEIA con `match_confidence` baja** | Un `filed_at` de 1999 en un BESS revela matches erróneos publicados como hechos | matcher automático sin revisión |

### Important — mejorarían mucho la ficha

| # | Gap | Nota |
|---|---|---|
| I1 | **UTM del Formulario no se persiste** | El extractor ya los saca y `utmToLatLng` ya existe ([utm.ts](../lib/ingestion/sources/sipub/shared/utm.ts), `proj4` ya es dependencia). 0 de 260 ubicaciones georreferenciadas |
| I2 | **Fechas del Formulario no se persisten** | `estimatedConstructionDate` y `estimatedOperationDate` se extraen y se botan; `project.construction_start_date` está vacía en 2.096 filas |
| I3 | **`source_payload` de PGP sin leer** | 4 fechas de hito + descripción + tipo de proyecto + solicitante, ya en nuestra base |
| I4 | **`project_event` no se muestra** | 2.388 eventos, incluida la fecha real de solicitud de 2.253 proyectos |
| I5 | **`power_plant` sin vincular a `project`** | Bloquea el estado OPERATIONAL con confianza alta y las únicas 1.242 coordenadas de la base |
| I6 | **`data_attribution` cubre 5 campos y no tiene `source_url`** | Sin provenance por campo en la UI |
| I7 | **`substation_bay` y `transmission_segment` no se muestran** | Datos limpios al 97-99% que hoy nadie ve |
| I8 | **CNE Declaración en Construcción es manual** | Congelada en la resolución 338 del 30-06-2026, cargada el 22-07 |
| I9 | **`sync-sea-pertinencia` falla** | 9 de 12 corridas fallidas |
| I10 | **Semántica de `operative_date` / `service_date`** | 9 de 27 con `operative_date` tienen avance < 100% → NEEDS_EXTERNAL_CONFIRMATION |

### Nice to have

| # | Gap |
|---|---|
| N1 | `entity_relationship` con 147 tipos sucios (cargos crudos mezclados con los 5 canónicos) y `valid_from/to` vacíos |
| N2 | `company.rut` y `legal_address` al 52% |
| N3 | `connection_status.description` vacía; slugs duplicados |
| N4 | Mojibake en `construction_project.region` ("Región de [caracter corrupto]uble") |
| N5 | `substation` sin coordenadas ni vínculo con `project_connection` (973 subestaciones catalogadas) |
| N6 | 110 nombres de proyecto duplicados y 18 NUP repetidos |
| N7 | Permisos sectoriales y derechos de terreno (G6/G7 de RTB) — requieren fuentes nuevas, fuera del alcance de "datos actuales" |
| N8 | `power_plant.operation_start_date` y otras 5 columnas vacías al 100% |

---

# 15. Cambios mínimos recomendados

### 15.1 Base de datos — ordenados por (valor ÷ esfuerzo)

| # | Cambio | Desbloquea | Esfuerzo |
|---|---|---|---|
| 1 | **Leer `source_payload` de PGP** hacia columnas: `reception_date`, `construction_declaration_date`, `service_date`, `operative_date`, `pgp_description`, `applicant_name`, `project_type` | 4 hitos reales + descripción real, para 73 proyectos. **Cero fetch nuevo: el dato ya está guardado** | Muy bajo |
| 2 | `connection_status` += `stage_normalized`, `stage_order`, `is_on_hold`, `is_terminal`; deduplicar slugs; FK `project.connection_status_code` | C6 — normalización consultable en SQL en vez de hardcodeada | Bajo |
| 3 | Persistir UTM del Formulario → `location.latitude/longitude` | I1 — mapa y análisis geográfico | Bajo |
| 4 | Persistir `estimatedConstructionDate` / `estimatedOperationDate` del Formulario | I2 — llena `construction_start_date` (hoy 0%) | Bajo |
| 5 | `data_attribution` += `source_url`; extender a los campos de la ficha | I6 — provenance real | Medio |
| 6 | `construction_project` += `project_id` + matcher por nombre normalizado + propietario + potencia | C1 + R12 (atraso reconocido por CNE) | Medio |
| 7 | `seia_record` += `rca_date`, `rca_number`, `last_checked_at` + job de refresco de los 177 | C3 + C4 | Medio |
| 8 | Automatizar el cruce de pertinencias por `titular_rut` (ya hay 1.319 sugerencias con score) | C5 + R10 | Medio |
| 9 | `power_plant` += `project_id` (matcher) | I5 + estado OPERATIONAL confiable | Medio |
| 10 | Tabla `project_status_assessment` (normalized_status, confidence, as_of, rtb, reasons jsonb) | Historial de nuestras conclusiones | Medio |

**No hace falta ninguna tabla nueva para el 80% de la ficha propuesta.** Los puntos 1, 3 y 4 son lectura y persistencia de datos que ya pasan por el pipeline.

### 15.2 Frontend — cambios mínimos

| # | Cambio | Por qué |
|---|---|---|
| 1 | Bloque **PROJECT STATUS** con 4 líneas (oficial / proceso / etapa TL / ejecución) reemplazando el estado suelto del header | Hoy el estado crudo es el único eje |
| 2 | **KEY MILESTONES** con la convención `✓ / — / ✗` donde `—` = sin dato | Evita leer "sin información" como "no ocurrió" |
| 3 | Renderizar **`project_event`** como timeline, con el rótulo "observado desde el 20-07-2026" | I4 — el dato ya está |
| 4 | Bloque **SCHEDULE** con COD declarado vs EO estimada PGP y la desviación en días | R5 — 72 proyectos, +495 días promedio |
| 5 | Reemplazar la descripción autogenerada por `source_payload.description` de PGP cuando exista | Texto técnico real vs plantilla con 4 variantes |
| 6 | Mostrar `substation_bay` y `transmission_segment` en Conexión | I7 — 97-99% poblado |
| 7 | Badge de **confianza de match** en SEIA (alta/media/baja) y fecha de `synced_at` | C7 + C4 visibles en vez de ocultos |
| 8 | Marcar visualmente FACTS / DERIVED / ESTIMATES (§8) y bajar el cronograma estimado a capa opcional | Regla de [02-prd.md](02-prd.md) §2.3 |
| 9 | Sección **SOURCES & EVIDENCE** al pie | Provenance |
| 10 | Estados vacíos explícitos ("Sin información de obra", "Sin coordenadas", "PELP sin datos") | 147 declarados sin PGP no pueden verse igual que 46 con obra confirmada |

### 15.3 Qué NO hacer todavía

- **No publicar un score 0–100 como titular.** El Health Score actual mezcla dos escalas propias con una penalización; sirve para ordenar, no para afirmar. Queda dentro del bloque de estado, etiquetado ESTIMATE.
- **No publicar las fases de PGP como etapa del proyecto** hasta confirmar la semántica de `phases_context` (hoy `is_ready` es false en 3.807 de 3.809 fases).
- **No crear `COMMISSIONING`** mientras `completition_pes` valga 0 en el 100% de las observaciones.
- **No inferir RCA desde pertinencia** ni desde "declarado en construcción".
- **No mezclar PELP con estado de proyecto** — la migración ya lo aísla por diseño y conviene mantener esa decisión.
