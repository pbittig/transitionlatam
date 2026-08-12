---
name: sector-electrico-chile
description: Referencia de dominio sobre los trámites regulatorios chilenos que Transition Latam rastrea. Usar cuando aparezcan SEIA, PGP, Acceso Abierto, SAC, SUCTD, SASC, Coordinador Eléctrico Nacional, CNE, DIA, EIA, RCA, consulta de pertinencia, proyecto fehaciente, declaración en construcción, PMGD, CTD, o cuando haya que decidir qué se puede afirmar de un proyecto con la evidencia disponible.
---

# Sector eléctrico chileno — referencia de dominio

Tres trámites distintos, tres autoridades, tres cosas que **no** significan lo mismo. La mayoría de los bugs de dominio de este repo salieron de confundirlos.

## Glosario

| Sigla | Qué es | Quién lo administra |
|---|---|---|
| **SAC** | Solicitud de Autorización de Conexión — instalaciones nacionales/zonales | Coordinador Eléctrico Nacional |
| **SUCTD** | Solicitud de Uso de Capacidad Técnica Disponible — instalaciones dedicadas de terceros | Coordinador |
| **SASC** / **SUCT** | Variantes que la fuente emite para SAC y SUCTD. Normalizar, no tratar como procesos distintos | Coordinador |
| **CTD** | Capacidad Técnica Disponible de una instalación dedicada | Coordinador |
| **Proyecto Fehaciente** | Exención de SUCTD para el dueño de la instalación dedicada; reduce la CTD disponible para terceros | Coordinador |
| **PGP** | **Plataforma** de Gestión de Proyectos — seguimiento de avance de interconexión | Coordinador |
| **SEIA** | Sistema de Evaluación de Impacto Ambiental | SEA |
| **DIA / EIA** | Declaración / Estudio de Impacto Ambiental | SEA |
| **RCA** | Resolución de Calificación Ambiental — el acto que aprueba o rechaza | SEA |
| **Pertinencia** | Consulta previa de si corresponde ingresar al SEIA. **No es una RCA** | SEA |
| **Declaración en Construcción** | Acto administrativo mensual por resolución | CNE |
| **PMGD** | Pequeño Medio de Generación Distribuida (≤9 MW) — clasifica el tipo de conexión | CNE / Coordinador |

> **Nombre correcto de PGP:** "Plataforma de Gestión de Proyectos", confirmado en coordinador.cl. Varios comentarios del repo dicen "Programa de Grandes Proyectos" — está mal y se corrige al tocarlos.

## Las cinco confusiones que ya causaron bugs

1. **Autorizado ≠ declarado ≠ construyendo.** "Proyecto autorizado para declararse en construcción" habilita; "Proyecto declarado en construcción" es el acto; que haya obra sólo lo dice el avance físico de PGP. Al 2026-08-12: 499 autorizados, 220 declarados, 170 con avance reportado.
2. **Pertinencia ≠ RCA.** "Resuelta - No ingreso al SEIA" significa que no se requiere evaluación, no que fue aprobada. "Resuelta - Ingreso al SEIA" es lo contrario de un logro: abre el trámite.
3. **Umbral SEIA (3 MW) ≠ umbral PMGD (9 MW).** El primero (art. 3 letra c, DS 40/2012) define si el ingreso ambiental es obligatorio; el segundo clasifica el tipo de conexión. Un proyecto puede ser PMGD y tener ingreso SEIA obligatorio a la vez.
4. **Un BESS standalone no ingresa automáticamente al SEIA** por la categoría de central generadora, pero sus obras asociadas —líneas o subestaciones sobre 23 kV— sí pueden gatillarlo. Ver `lib/shared/environmentalReviewRules.ts`.
5. **La fecha de conexión declarada no es una predicción.** Contra la estimación del propio titular en PGP la desviación promedio es de **+750 días** (163 proyectos con ambas fechas, 138 con más de 90 días de atraso). Cualquier regla que dependa de esa fecha necesita una ventana de tolerancia — ver `VIGENCIA_GRACE_DAYS` en `lib/data-access/projects.ts`.

## Cuándo abrir cada referencia

- `references/acceso-abierto.md` — proceso de conexión, tipos de solicitud, estados y su orden, qué significa cada uno.
- `references/seia.md` — vía ambiental, estados, umbrales, qué se puede afirmar y qué no.
- `references/pgp.md` — avance físico, hitos registrados, qué campos existen de verdad y cuáles no sirven.

## Regla que atraviesa todo

**No afirmar lo que la fuente no confirma.** Si falta el dato, la ficha dice "sin información", no "no ocurrió" (ver `docs/02-prd.md` §2.3 y `docs/12-ficha-proyecto-datos-reales.md`). Un dato inventado cuesta más que un dato ausente: en agosto de 2026 se encontraron 32 proyectos con expedientes SEIA ajenos colgados por un cruce automático de confianza baja, ocho de ellos ya verificados editorialmente.
