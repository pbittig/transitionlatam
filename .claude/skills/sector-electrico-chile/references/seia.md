# SEIA y pertinencias — trámite ambiental (Servicio de Evaluación Ambiental)

Base legal: Ley 19.300; Reglamento del SEIA DS 40/2012 y su modificación DS 17/2025. *Citas tomadas de la documentación oficial consultada el 2026-08-08 y de `lib/shared/environmentalReviewRules.ts`; los artículos no se verificaron contra el texto reglamentario primario.*

## Dos vías distintas, nunca fusionarlas

**Vía SEIA** — ingreso formal. DIA o EIA según la significancia del impacto (art. 11 Ley 19.300). Termina en una **RCA** favorable o desfavorable. En EIA la Participación Ciudadana es obligatoria.

**Vía pertinencia** — consulta previa de si corresponde ingresar (art. 10 Ley / art. 3 Reglamento). Sub-estados reales observados: "Resuelta - No ingreso al SEIA" (1.835), "Resuelta - Desistida" (179), "Resuelta - Ingreso al SEIA" (114), "Resuelta - Abandono" (49), "En análisis" (35), "No admitida a tramitación" (12).

**Una pertinencia resuelta no es una aprobación ambiental.** "No ingreso" = no se requiere evaluación. "Ingreso al SEIA" = hay que hacer el trámite completo, es un requisito abierto.

## Umbrales

- **Generación > 3 MW** → ingreso obligatorio al SEIA (art. 3 letra c del Reglamento).
- **No confundir con PMGD (9 MW)**: ese umbral es de otro reglamento y clasifica el tipo de conexión, no la obligación ambiental.
- **BESS standalone**: no es "central generadora", así que no tiene ingreso automático por esa categoría (Resolución SEA 202399101970). Pero sus obras asociadas —líneas o subestaciones **sobre 23 kV**— sí pueden gatillarlo.

Implementado en `lib/shared/environmentalReviewRules.ts` (`SEIA_MANDATORY_GENERATION_THRESHOLD_MW`, `SEIA_MANDATORY_BESS_VOLTAGE_THRESHOLD_KV`).

## Estados del expediente

Observados en la base: Aprobado (186), En Calificación (29), Desistido (8), No calificado (4), Rechazado (3), No Admitido a Tramitación (3), Caducado (1).

## Qué NO tenemos, y por qué importa

El buscador público del SEIA entrega el **estado** del expediente, pero **no la fecha ni el número de la RCA**. Por lo tanto:

> No se puede afirmar "RCA favorable del DD-MM-AAAA, Res. Ex. N°X". Lo máximo defendible es "expediente SEIA aprobado (DIA, presentado el …)", citando la URL de la ficha.

Tampoco distinguimos RCA modificada, ni vigencia/caducidad más allá del estado "Caducado".

## Confianza del cruce proyecto ↔ expediente

El matcher automático cruza por nombre normalizado + región y se autocalifica alta/media/baja. **Los de confianza baja son ruido**: auditados el 2026-08-12, incluyen expedientes de 1997-1999 de obras de transmisión colgando de proyectos BESS de 2026, y un caso que matcheó por una sola palabra ("Parque Eólico Ramal + BESS" en Calbuco vinculado al "Ramal de gas al Observatorio ALMA" en San Pedro de Atacama, a ~2.000 km).

Regla implementada en `lib/shared/seiaMatchTrust.ts`: un vínculo de confianza baja se conserva como candidato para el verificador, pero **no alimenta ningún estado derivado ni se presenta como hecho** en la ficha pública.

## Cómo se modela hoy

- Ingesta SEIA: `lib/ingestion/sources/seia/` — **sin job periódico**: se dispara desde el verificador admin y desde los flujos de IA. El estado guardado no se refresca.
- Ingesta pertinencias: `lib/ingestion/sources/sea-pertinencia/` (diaria). 2.247 consultas ingeridas, sólo 8 vinculadas a un proyecto — el cruce es el cuello de botella.
- Madurez: `seiaStatusMaturity.ts`, `pertinenciaStatusMaturity.ts`.
- Tablas: `seia_record` (234 filas, 177 vinculadas), `pertinencia_consulta`.

Fuente: sea.gob.cl.
