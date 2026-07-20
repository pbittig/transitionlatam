# 09 — Seguridad

## 9.1 Modelo de amenazas (resumen)

| Amenaza | Por qué importa aquí |
|---|---|
| Extracción masiva automatizada del dataset (scraping/bots, abuso de API o de Transition AI) | Es el activo principal del negocio — ver [01-vision-producto.md](01-vision-producto.md) §1.5 |
| Acceso no autorizado a campos restringidos por plan | Rompe el modelo de monetización futura y la confianza de clientes Enterprise |
| Exposición de inferencias de IA como hechos verificados | Riesgo reputacional/legal para ONIX (ver [04-modelo-datos.md](04-modelo-datos.md) §4.3) |
| Uso de datos de terceros sin base legal adecuada (ownership/SPV scraping) | Riesgo legal — ver §9.7 |
| Compromiso de credenciales/secretos | Estándar, pero crítico dado que hay integración con CRM externo |

## 9.2 Autenticación y autorización

- **AuthN:** Supabase Auth (email/password + posible SSO corporativo en Enterprise, futuro).
- **AuthZ a nivel de fila:** Row Level Security (RLS) en Postgres como mecanismo primario — cada policy referencia el plan/organización del usuario autenticado vía JWT claims.
- **AuthZ a nivel de característica:** sistema de entitlements (ver [08-modelo-suscripciones.md](08-modelo-suscripciones.md) §8.4), aplicado en la capa de API/data-access, no solo en RLS — RLS protege el dato crudo, entitlements protegen la lógica de negocio (ej. límites de consultas de IA, que no son expresables como RLS).
- Ningún componente de frontend recibe una API key con privilegios amplios; toda llamada autenticada pasa por el backend de Next.js.

## 9.3 Enforcement de campos restringidos

Implementado en `/lib/entitlements/fieldAccess.ts` (ver [08](08-modelo-suscripciones.md) §8.4): la capa de serialización de respuestas de API filtra campos antes de responder, no después ni en el cliente. Esto aplica igual a respuestas de Transition AI (los tools nunca reciben ni pueden citar un campo que el usuario no tendría derecho a ver — ver [06-arquitectura-ia.md](06-arquitectura-ia.md) §6.5).

## 9.4 Anti-extracción masiva (sin pretender ser infalible)

Medidas, en capas:

| Capa | Medida |
|---|---|
| API | Paginación obligatoria, límite máximo de resultados por request (independiente del plan) |
| API | Rate limiting por usuario/IP/API key (ventanas cortas y largas) |
| Transition AI | Límite de consultas por período según plan; cap duro de filas por respuesta (ver [06](06-arquitectura-ia.md) §6.6) |
| Exportación | Sin endpoint de exportación masiva CSV/Excel; Report Builder genera reportes acotados y con marca de agua/metadata de usuario, no volcados de datos |
| Detección | Logging de todas las consultas (API + IA) con `user_profile_id`; heurística de alerta ante patrones de paginación exhaustiva o variación sistemática de filtros típica de scraping |
| Legal | Términos de servicio que prohíben explícitamente la extracción automatizada, como respaldo del control técnico |

Principio explícito (heredado del brief, sección 19): ningún sistema impide que una persona copie manualmente o tome capturas de pantalla. El objetivo es impedir la **extracción automatizada a escala**, no el uso normal individual. El valor del producto está en la inteligencia y el análisis, no en el acceso al dato bruto — si este principio se mantiene en el diseño de producto, la superficie de ataque de "extracción" pierde valor por sí misma.

## 9.5 Auditoría

- `audit_log`: toda acción sensible (login, exportación de reporte, cambio de plan, acceso a dato restringido, invocación de tool de IA) queda registrada con actor, timestamp, entidad afectada.
- Los logs de consultas de IA (§6.6/6.7 en [06](06-arquitectura-ia.md)) son auditoría y a la vez insumo de Intent Engine — un solo pipeline de eventos, no dos sistemas paralelos.

## 9.6 Detección de comportamiento sospechoso (MVP: reglas simples, no ML)

Heurísticas iniciales suficientes para el MVP:
- Más de N requests/minuto sostenidos desde un mismo usuario/IP.
- Paginación secuencial exhaustiva sobre el mapa/listado de proyectos en una sola sesión.
- Consultas a Transition AI con variaciones mínimas y sistemáticas de parámetros (indicio de intento de reconstrucción del dataset vía IA).

Una alerta dispara: rate limit más agresivo temporal + notificación a un canal de operaciones (no bloqueo automático de cuenta en el MVP, para evitar falsos positivos costosos en clientes reales).

## 9.7 Consideraciones legales sobre fuentes de datos (riesgo no puramente técnico)

El brief incluye datos de ownership, SPVs y stakeholders que provienen en parte de fuentes públicas de terceros (registros societarios, SEIA, prensa). Antes de escalar la ingesta automatizada de estas fuentes:

- Verificar los términos de uso de cada fuente (algunas prohíben explícitamente scraping o republicación agregada).
- Distinguir entre "dato público" (legalmente accesible) y "dato republicable a escala como producto comercial" (no siempre lo mismo).
- Mantener siempre la atribución de fuente (`data_source`, ver [04](04-modelo-datos.md) §4.3) como respaldo de buena fe y trazabilidad.
- Esta revisión debe hacerla el equipo legal de ONIX antes del lanzamiento de fuentes de terceros a escala — se documenta aquí como riesgo, no se resuelve en este documento.

**Caso específico — Acceso Abierto (`accesoabierto.coordinador.cl`):** el portal corre sobre AWS Cognito (login) para al menos parte de su funcionalidad. Antes de automatizar el Nivel 2 (documento "Formulario" por proyecto, ver [05-arquitectura-tecnica.md](05-arquitectura-tecnica.md) §5.10):
- Confirmar si el detalle por proyecto es de acceso público (coherente con el nombre "Acceso Abierto", mandato de transparencia del sector eléctrico chileno) o si requiere una cuenta — y si requiere cuenta, usar únicamente credenciales legítimas de ONIX, nunca compartidas en el repositorio (ver §9.8).
- El "Formulario" contiene **datos personales** (nombre, teléfono de contacto del gestor del proyecto) — tratarlos conforme a normativa de protección de datos personales aplicable en Chile, no solo como "dato de mercado". Esto incluye limitar su exposición en la UI pública de Transition LATAM según el nivel de plan/permiso del usuario (ver [08-modelo-suscripciones.md](08-modelo-suscripciones.md)), no mostrar teléfonos de personas naturales sin criterio.
- No se intentó invocar endpoints internos de la API (AWS API Gateway) sin autorización durante esta fase de documentación — cualquier automatización contra el backend directo (en vez de la navegación normal del sitio) requiere primero confirmar con ONIX/Coordinador si existe una vía formal de acceso a datos.

## 9.8 Gestión de secretos y configuración

- Secretos (claves de proveedor de IA, credenciales de CRM, claves de Supabase service-role) nunca en el repositorio; variables de entorno gestionadas por el proveedor de hosting/secret manager.
- La clave `service_role` de Supabase (que evita RLS) se usa exclusivamente en jobs de backend controlados (ingesta, scoring batch), nunca en código accesible desde el cliente ni en rutas de API de uso general.

## 9.9 Resumen de responsabilidades por capa

| Capa | Responsable de |
|---|---|
| RLS (Postgres) | Aislamiento de datos por organización/usuario a nivel de fila |
| Entitlements (`/lib/entitlements`) | Qué features/campos/límites aplican según plan |
| API middleware | Rate limiting, autenticación, logging |
| Transition AI guardrails | No inventar, citar fuente/confianza, respetar entitlements |
| Legal/ToS | Respaldo no técnico de las políticas de uso aceptable |
