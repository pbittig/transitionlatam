# Acceso Abierto — trámite de conexión (Coordinador Eléctrico Nacional)

Base legal: LGSE arts. 79-80. Reglamento de Coordinación y Operación del SEN; CTD regulada por Res. Exenta CNE N°154/2017 y arts. 63-64 del Reglamento. *Los artículos citados vienen de la documentación oficial consultada el 2026-08-08; no se verificaron contra el texto reglamentario primario (bloqueo 403) — tratar como referencia, no como cita literal.*

## Tipos de solicitud

| Proceso | Cuándo aplica |
|---|---|
| **SAC** — Solicitud de Autorización de Conexión | Conexión a instalaciones de transmisión nacional o zonal |
| **SUCTD** — Solicitud de Uso de Capacidad Técnica Disponible | Conexión a instalaciones **dedicadas** de un tercero: se pide usar la capacidad que le sobra |
| **Proyecto Fehaciente** | El dueño de la instalación dedicada declara que la usará él. Lo exime de SUCTD y **reduce la CTD que queda disponible para terceros**. Se acredita con RCA u otro antecedente y se reporta antes del estudio de CTD |

La fuente emite seis valores para estos tres procesos: `SAC` (1.272), `SUCTD` (575), `FEHACIENTES` (166), `FEHACIENTE` (43), `SASC` (24), `SUCT` (16). Normalizar SASC→SAC, SUCT→SUCTD, FEHACIENTES→FEHACIENTE.

**Por qué importa el segmento de transmisión:** `project_connection.transmission_segment` (Dedicada 768 / Zonal 643 / Nacional 622) explica cuál de los tres procesos corresponde. Es un campo limpio al 97% y hasta agosto de 2026 no se mostraba en ninguna parte.

## Estados y su orden

La fuente emite 28 variantes de texto para ~14 estados reales, mezclando tildes y mayúsculas ("Proyecto declarado en construcción" / "...construccion" / "...Construcción"). **Comparar siempre normalizado** (NFD, sin diacríticos, minúsculas) y por prefijo.

Orden aproximado del trámite, agrupado:

1. Solicitud Ingresada · Proyecto ingresado
2. Evaluación Admisibilidad
3. Desarrollo de estudios y/o antecedentes · Revisión de antecedentes · Evaluación de antecedentes y/o requerimientos
4. Elaboración Informe CTD preliminar · Elaboración Informe de Autorización de Conexión Preliminar
5. Observaciones al informe CTD preliminar · Observaciones a Informe de Autorización de Conexión Preliminar
6. Audiencia y antecedentes adicionales · Periodo de presentación de discrepancias
7. Proyecto calificado como fehaciente · Proyecto Fehaciente debe presentar SUCTD
8. Elaboración de Informe de Autorización de Conexión Final / Definitivo / Proyecto Fehaciente
9. **Proyecto autorizado para declararse en construcción** · Clasificado como Obra Menor
10. **Proyecto declarado en construcción**
11. Proyecto finalizado

Terminales negativos: **Rechazada**, **Desistida**.

**"Detenida a la espera de…"** (definición de ingeniería / información técnica del propietario) **no es una etapa**: es una bandera ortogonal. Un proyecto detenido no está más avanzado que uno que sigue avanzando. Son 113 proyectos.

## Qué confirma y qué no

**Confirma:** que existe una solicitud; qué proceso es; en qué etapa está; dónde se conecta, a qué tensión y en qué paño; qué fecha de conexión declaró el titular.

**No confirma:** avance físico de obras, situación ambiental, permisos sectoriales, derechos de terreno, ni fecha real de operación. Tampoco potencia: sólo 28 de 2.766 filas del listado la traen — el desglose real viene del Formulario SAC.

## Cómo se modela hoy

- Ingesta: `lib/ingestion/sources/energia-abierta/listado/` (diaria) y `detalle-formulario/` (a demanda, con IA).
- Campos: `project.status` (texto crudo), `project_connection.request_type`, `connection_point`, `voltage_level`, `substation_bay`, `transmission_segment`.
- Normalización de madurez: `lib/shared/projectStatusMaturity.ts`.
- Fecha real de la solicitud: `project_event` con `event_type = 'announced'` (2.253 eventos, el más antiguo de 2017).
- La tabla `connection_status` existe con 38 códigos pero **ningún FK la referencia**; la normalización vive en TypeScript.

Fuentes: coordinador.cl, chileatiende.gob.cl.
