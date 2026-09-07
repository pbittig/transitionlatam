# Brechas operativas y recomendaciones de cumplimiento — documento interno

> **NO PUBLICAR. NO ES UN DOCUMENTO LEGAL.** Este es un análisis directo, para uso interno de ONIX, de las diferencias entre lo que dirán las políticas (`politica-privacidad.md`, `terminos-condiciones.md`) y lo que el sistema realmente hace hoy. Una política que promete algo que el sistema no cumple es un pasivo, no una protección — por eso este documento existe por separado y con este tono.

**Fecha:** 7 de septiembre de 2026. Basado en el mapeo técnico completo del tratamiento de datos personales del sistema (ver conversación de origen) y en `docs/09-seguridad.md` §9.7, que ya había identificado parte de este riesgo sin resolverlo.

## Priorización

🔴 Riesgo alto — expone a la empresa directamente, o las políticas nuevas serían contradichas por el sistema real.
🟡 Riesgo medio — brecha real, pero de menor probabilidad o impacto inmediato.
🔵 Mejora recomendada — buena práctica, no urgente.

---

### 🔴 1. No existe ningún checkbox de aceptación de Términos ni de Política de Privacidad en el registro

Verificado en `app/registro/RegistroForm.tsx` y `app/registro/actions.ts`: el formulario de alta no presenta, ni pide aceptar, ningún enlace a términos o política de privacidad. **Hoy nadie ha aceptado nada contractualmente.** Publicar las políticas sin este paso las deja sin valor probatorio de consentimiento — es la diferencia entre "tenemos una política" y "podemos demostrar que el usuario la aceptó".

**Recomendación concreta:** agregar al formulario de registro (y al alta manual por admin) un checkbox obligatorio: *"He leído y acepto los Términos y Condiciones y la Política de Privacidad"*, con enlaces a las páginas publicadas, y registrar en `user_profile` (o en una tabla nueva `policy_acceptance`) la versión aceptada y la fecha/hora. Esto es un cambio de código pequeño pero de alto valor legal — puedo implementarlo apenas el texto esté aprobado.

### 🔴 2. No hay forma de que un usuario elimine su cuenta o exporte sus datos

Confirmado por búsqueda exhaustiva en `app/` y `lib/`: no existe ninguna función de autoservicio de borrado ni de exportación. La única vía es un proceso manual que la política promete pero que hoy no tiene procedimiento documentado ni SLA interno.

**Recomendación concreta:** como mínimo, mientras no se automatice: definir un procedimiento interno escrito (quién ejecuta el borrado, en qué plazo, qué tablas se tocan — `user_profile`, `lead`, `lead_score`, `behavior_event`, `entitlement_override` tienen cascada desde `auth.users`, pero `person`/`ownership_entity` de terceros NO dependen de la cuenta del usuario y son un caso aparte). A mediano plazo, un botón "Eliminar mi cuenta" en `/perfil` que dispare `client.auth.admin.deleteUser` (la cascada de esquema ya existe) sería relativamente simple de construir.

### 🔴 3. La función "Ver contacto" es el mayor punto de exposición legal de la plataforma

`app/(public)/proyectos/[id]/RevealStakeholders.tsx` + `seiaActions.ts` revela nombre, correo y teléfono de personas naturales —que no son usuarios ni dieron su consentimiento a Transition LATAM— a cualquier usuario Premium que lo solicite. Esto ya estaba señalado como riesgo pendiente en `docs/09-seguridad.md` §9.7 ("no mostrar teléfonos de personas naturales sin criterio") y nunca se resolvió.

**Esto no es necesariamente ilegal** — la política que redacté se apoya en la base de "fuente de acceso público" para justificarlo — pero es exactamente el tipo de tratamiento que una autoridad de protección de datos (o el propio titular del dato, molesto por recibir contacto comercial no solicitado) revisaría primero. Recomendaciones, de mayor a menor prioridad:

- Confirmar con un abogado si la base de "fuente de acceso público" cubre razonablemente el **reformateo y distribución comercial repetida** de estos datos, o si conviene sumar otra base (interés legítimo documentado, con balance de intereses por escrito).
- Considerar agregar, antes de revelar un contacto, un segundo click de confirmación tipo *"Al revelar este contacto, usted declara que lo usará conforme a los Términos de Uso, sección 6"* — deja evidencia de que el usuario fue advertido en el momento exacto del acto de riesgo, no solo en un ToS genérico leído (o no) al registrarse.
- Habilitar operativamente el canal de "solicitar exclusión" que la política promete (sección 12) — hoy sería 100% manual, así que definir quién lo atiende y en qué plazo.
- Evaluar si el registro de auditoría mencionado en `docs/09-seguridad.md` §9.5 (`audit_log`) efectivamente cubre este evento específico (quién reveló qué contacto, cuándo) — si no, es una brecha adicional de trazabilidad.

### 🟡 4. Acceso de administrador por credencial compartida, sin cuentas individuales

`app/admin/acceso/actions.ts` usa un usuario/clave único (`ADMIN_PORTAL_USERNAME`/`ADMIN_PORTAL_PASSWORD`) compartido, no cuentas individuales de Supabase Auth. El código usa `isAdmin()` como bandera booleana. Esto significa que **si hay un incidente que involucre acceso indebido a datos personales por parte de alguien con acceso admin, no hay forma de determinar quién fue** — solo se puede decir "alguien con la clave compartida".

**Recomendación:** no es estrictamente un tema de la política de privacidad, pero sí de gobernanza de datos y de lo que exigiría cualquier auditoría seria. A mediano plazo, mover a cuentas individuales con rol admin en Supabase Auth (para trazabilidad real) es más robusto que seguir con la clave compartida, aunque implica más trabajo de migración.

### 🟡 5. Transferencia internacional de datos personales a proveedores de IA sin acuerdo de tratamiento verificado

Los formularios del Coordinador (con nombre/correo/teléfono de personas reales) pasan por NVIDIA NIM para extracción automatizada (`lib/ai/provider/nvidia.ts`, `lib/ingestion/sources/energia-abierta/detalle-formulario/extractWithAi.ts`). Además existe un proveedor alternativo, Moonshot AI (Kimi), con sede en China — un régimen normativo de protección de datos distinto al chileno/europeo.

**Recomendación:** verificar si existe un acuerdo de tratamiento de datos (DPA) vigente con NVIDIA y con OpenAI (ambos suelen tener DPA estándar disponibles); para Moonshot AI, evaluar si es estrictamente necesario que reciba datos de personas naturales identificables, o si conviene reservarlo para flujos que no incluyan ese tipo de dato, dado el mayor escrutinio que amerita una transferencia a ese país bajo la Ley 21.719.

### 🟡 6. Sin plazos de retención definidos ni proceso de purga

`behavior_event`, los registros de `nexo_run`/`nexo_tool_call`, y los datos de terceros (`person`, `ownership_entity`) se acumulan indefinidamente. La política que redacté deja esto marcado como pendiente porque no hay ninguna decisión tomada que yo pueda documentar honestamente.

**Recomendación:** definir, aunque sea de forma simple (ej. "los eventos de comportamiento se anonimizan a los 24 meses"), y hacerlo cumplir con un job periódico. No es urgente si el volumen de datos es manejable hoy, pero conviene decidirlo antes de que la base crezca y la purga se vuelva más costosa/riesgosa de ejecutar.

### 🔵 7. No hay un Delegado/Encargado de Protección de Datos designado

La Ley 21.719 crea la Agencia de Protección de Datos Personales y, según el volumen y sensibilidad del tratamiento, puede recomendar o exigir esta figura. Dado que Transition LATAM trata datos de terceros no consentidos a escala (el corazón del producto), designar formalmente a alguien —aunque sea Patrick mismo, inicialmente— y dejarlo en la política es una señal de buena fe barata de implementar.

### 🔵 8. No hay procedimiento documentado de respuesta a incidentes de seguridad/brechas de datos

La Ley 21.719 introduce obligaciones de notificación de brechas relevantes. Recomiendo un documento corto e interno (a quién avisar internamente, plazo objetivo, plantilla de comunicación a afectados/autoridad) — no existe hoy en el repositorio ni en `docs/`.

### 🔵 9. Sin registro formal de actividades de tratamiento (RAT) vivo

El mapeo que sirvió de base a estas políticas es exhaustivo pero es un documento de un momento en el tiempo. Recomiendo mantenerlo como un documento vivo (puede ser este mismo árbol `docs/legal/`) que se actualice cada vez que se agregue una fuente de datos, un proveedor de IA nuevo, o una función que exponga datos de terceros — como ya ocurrió sin registrar con la función "Ver contacto".

---

## Qué generar/completar antes de publicar las políticas

1. Razón social exacta, RUT y domicilio de la sociedad (usado en `politica-privacidad.md` y `terminos-condiciones.md`).
2. Un correo dedicado para privacidad (ej. `privacidad@transitionlatam.com`) — hoy todas las notificaciones internas caen en `patrick.bittig@onixcg.com` personal, lo cual funciona pero no escala ni transmite formalidad institucional.
3. Confirmación de región de alojamiento de Supabase y Vercel (configuración de panel, no está en el código).
4. Revisión de un abogado: plazos exactos de respuesta a derechos ARCO+ bajo la Ley 21.719, necesidad de DPO, y suficiencia de la base de licitud para la función "Ver contacto".
5. Decisión sobre el punto 1 de este documento (checkbox de aceptación) — sin esto, recomiendo no considerar las políticas "en vigor" aunque estén publicadas.
