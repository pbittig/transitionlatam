# Documentos legales — Transition LATAM

Todos los documentos de esta carpeta están **en estado de borrador, pendientes de revisión legal**, generados a partir de un mapeo técnico exhaustivo del tratamiento real de datos del sistema (no de plantillas genéricas). Ver la nota de estado al inicio de cada archivo.

- [`politica-privacidad.md`](politica-privacidad.md) — Política de Privacidad y Tratamiento de Datos Personales. El documento principal.
- [`terminos-condiciones.md`](terminos-condiciones.md) — Términos y Condiciones de Uso.
- [`politica-cookies.md`](politica-cookies.md) — Política de Cookies (breve; el sistema usa muy pocas).
- [`aviso-terceros.md`](aviso-terceros.md) — Aviso corto para personas cuyos datos aparecen en la plataforma sin ser usuarias (representantes legales, controladores societarios). Pensado como página independiente.
- [`brechas-y-recomendaciones.md`](brechas-y-recomendaciones.md) — **Interno, no publicar.** Diferencias entre lo que las políticas prometen y lo que el sistema hace hoy, priorizadas por riesgo, con recomendaciones concretas.

## Antes de publicar

1. Un abogado con competencia en protección de datos en Chile (Ley 19.628 / Ley 21.719) debe revisar y validar los cuatro documentos públicos.
2. Completar los campos `[COMPLETAR: …]` (razón social, RUT, domicilio, correos de contacto, región de infraestructura).
3. Resolver, o al menos decidir conscientemente no resolver todavía, los puntos 🔴 de `brechas-y-recomendaciones.md` — en particular, agregar el checkbox de aceptación al registro, sin el cual estas políticas no tienen valor de consentimiento demostrable.
4. Una vez aprobado el texto, construir las páginas públicas (`/politica-privacidad`, `/terminos-y-condiciones`, `/politica-cookies`, `/aviso-terceros`) y enlazarlas desde el pie de página del sitio y desde el formulario de registro.

Ver también `docs/09-seguridad.md` §9.7, que identificó este riesgo antes de que existiera esta carpeta.
