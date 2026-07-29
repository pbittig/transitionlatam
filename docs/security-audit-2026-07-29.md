# Auditoría de seguridad — 29 de julio de 2026

## Alcance

Revisión estática de autenticación, autorización, Server Actions, clientes Supabase,
RLS, secretos, rutas cron y exposición de datos. No incluye pentest externo ni
análisis de la configuración remota del proyecto Supabase/Vercel.

## Hallazgos

### Crítico — los planes no protegen la data directamente en Supabase

Las políticas `public_read` permiten a `anon` consultar directamente tablas como
`project`, `seia_record`, `company`, `spv`, `opportunity` y `market_signal`.
Los candados de plan aplicados en React/API no impiden que alguien use la URL y la
anon key públicas para leer esas tablas por REST.

**Recomendación:** reemplazar acceso público directo por vistas/RPC de proyección
mínima o por una capa backend; reservar tablas enriquecidas para usuarios
autenticados y aplicar autorización por plan en servidor.

### Alto — contactos disponibles para cualquier usuario autenticado

La política de `person` autoriza lectura completa a todo rol `authenticated`.
El comentario indica que la restricción por plan viviría en la API, pero un cliente
puede consultar Supabase directamente.

**Recomendación:** retirar `authenticated_read` general y exponer contactos mediante
una función o endpoint que verifique entitlement y registre el acceso.

### Alto — acceso administrativo alternativo mediante secreto compartido

Las acciones de asociación SEIA aceptan `SEIA_ADMIN_SECRET` cuando no existe sesión
de administrador. Esto amplía la superficie de ataque, dificulta atribuir acciones y
no permite revocar a una persona sin rotar la clave para todos.

**Recomendación:** eliminar el acceso alternativo y exigir sesión administrativa.

### Alto — administrador único sin MFA, rate limiting ni bloqueo

El login interno compara usuario y contraseña de variables de entorno. La sesión
está firmada, es `httpOnly`, `SameSite=Lax` y segura en producción, pero no hay MFA,
límite de intentos, bloqueo temporal ni auditoría por administrador.

**Recomendación:** migrar el administrador a Supabase Auth con rol, MFA y eventos de
auditoría. Mientras tanto, aplicar rate limiting y comparación constante.

### Medio — rutas cron dependen de un único secreto

Las rutas cron validan `Authorization: Bearer CRON_SECRET`, lo que es correcto como
control básico. Falta confirmar rotación, longitud, separación por tarea y alertas
ante intentos fallidos.

**Recomendación:** rotar periódicamente, usar secretos distintos para tareas de alto
impacto y registrar fallos sin almacenar el valor recibido.

### Medio — faltan cabeceras defensivas explícitas

`next.config.ts` no define una Content Security Policy ni cabeceras como
`X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`.

**Recomendación:** introducir primero CSP en modo reporte, ajustar orígenes de
Supabase/mapas/IA y luego hacerla bloqueante.

### Medio — uso amplio de `service_role`

La clave de servicio está correctamente aislada en un módulo `server-only`, pero
muchas páginas y acciones la utilizan. Un error de autorización en cualquiera de
ellas omitiría completamente RLS.

**Recomendación:** centralizar operaciones privilegiadas en una DAL administrativa,
con `requireAdmin()` interno, validación de argumentos y auditoría.

### Bajo — sesión administrativa sin rotación o revocación individual

El JWT administrativo dura siete días. Cambiar la contraseña no invalida tokens ya
emitidos y no existe identificador de sesión revocable.

**Recomendación:** agregar versión de sesión o registro de sesiones y reducir la
vigencia para operaciones críticas.

## Controles observados

- Clave `service_role` en módulo marcado `server-only`.
- Cookies administrativas `httpOnly`, `SameSite=Lax` y `Secure` en producción.
- Algoritmo JWT restringido explícitamente a HS256.
- Acciones administrativas principales vuelven a comprobar `isAdmin()` en servidor.
- RLS activado en tablas relevantes y sin políticas públicas de escritura.
- Rutas cron rechazan solicitudes sin el bearer esperado.

## Orden recomendado de remediación

1. Cerrar lectura directa de datos Premium y contactos mediante RLS.
2. Eliminar `SEIA_ADMIN_SECRET` como acceso alternativo.
3. Migrar administradores a identidad individual con MFA y auditoría.
4. Reducir y centralizar el uso de `service_role`.
5. Incorporar CSP y cabeceras defensivas.
6. Añadir rate limiting y monitoreo a login, IA y cron.
