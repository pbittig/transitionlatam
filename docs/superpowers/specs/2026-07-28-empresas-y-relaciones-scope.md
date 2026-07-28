# Empresas y relaciones — alcance funcional

**Estado:** aprobado para preparación  
**Fecha:** 2026-07-28  
**Nombre visible recomendado:** Empresas y relaciones  
**Descriptor secundario:** Inteligencia societaria y comercial

## 1. Objetivo

El módulo debe responder una pregunta comercial concreta:

> ¿Qué grupo está detrás de cada proyecto, qué otras empresas y proyectos están relacionados y con quién conviene conversar?

No busca reemplazar una due diligence legal ni reconstruir exhaustivamente todos los actos societarios. Su propósito es consolidar sociedades que pertenecen a una misma cuenta comercial y relacionarlas con la cartera energética de Transition LATAM.

## 2. Usuarios y valor esperado

| Usuario | Decisión que habilita |
|---|---|
| IPP | Identificar controladores, socios potenciales y exposición completa de un grupo |
| Developer | Encontrar grupos con cartera complementaria, socios o posibles compradores |
| Vendor / proveedor tecnológico | Dimensionar la oportunidad total de una cuenta más allá de una sola SPV |
| EPC / contratista | Detectar proyectos hermanos y próximas ventanas de ingeniería, compras o construcción |
| Inversionista / institución financiera | Consolidar sociedades, proyectos, capacidad y madurez bajo un mismo grupo |
| Consultor | Explicar estructura de mercado, relaciones y concentración empresarial |

## 3. Principio de producto

La unidad comercial es el **grupo empresarial**, no la sociedad aislada.

Una SPV puede aparecer como propietaria formal de un proyecto, pero la plataforma debe ayudar a descubrir:

1. la sociedad visible en el proyecto;
2. la empresa operativa o filial relacionada;
3. el grupo o matriz que aparece detrás;
4. otras SPV y empresas del mismo grupo;
5. los proyectos energéticos asociados a esas entidades;
6. las personas relevantes disponibles para iniciar una conversación.

## 4. Alcance de la primera versión

### 4.1 Identidad empresarial

- Razón social.
- Nombre comercial, cuando exista.
- RUT.
- País y domicilio empresarial.
- Tipo societario.
- Clasificación sectorial propia: IPP, developer, EPC, inversionista, utility, proveedor u otro.
- Rol respecto del proyecto: desarrollador, propietario, SPV, operador, accionista u otro.
- Fecha de última actualización.

### 4.2 Relación societaria simplificada

El grafo principal mostrará un máximo inicial de tres niveles:

```text
Grupo o matriz
└── Empresa operativa o filial
    └── SPV
        └── Proyecto energético
```

Tipos mínimos de relación:

- controla;
- participa en;
- accionista de;
- matriz de;
- filial de;
- sociedad relacionada;
- administra o representa;
- desarrolla;
- es propietaria del proyecto;
- opera el proyecto.

No se mostrará una relación como propiedad confirmada cuando sólo exista coincidencia de nombre.

### 4.3 Cartera consolidada

Para cada grupo o empresa:

- Número de proyectos relacionados.
- Capacidad total en MW y MWh.
- Distribución por tecnología.
- Distribución por región.
- Distribución por etapa.
- Próximas fechas relevantes.
- SPV asociadas.
- Proyectos vinculados a cada sociedad.

La interfaz debe generar resúmenes como:

> Esta sociedad pertenece a un grupo relacionado con 12 proyectos y 1,8 GW en Chile.

### 4.4 Personas relevantes

Los contactos se organizarán por utilidad comercial, no como una lista legal genérica:

- desarrollo de proyectos;
- ingeniería;
- conexión e interconexión;
- permisos y medio ambiente;
- compras y abastecimiento;
- construcción;
- operación y mantenimiento;
- finanzas e inversión;
- desarrollo comercial;
- dirección o gerencia.

Campos previstos:

- nombre;
- cargo;
- área funcional;
- empresa;
- proyectos relacionados;
- correo y teléfono corporativo, cuando corresponda;
- fuente;
- fecha de verificación;
- nivel de confianza;
- acción para agregar al CRM.

Dequienes, Trantor u otro proveedor societario no se consideran fuente garantizada de contactos laborales. Los contactos se consolidarán desde las fuentes energéticas, documentos públicos, sitios corporativos y revisión de ONIX.

### 4.5 Lectura comercial

La plataforma podrá producir reglas descriptivas como:

- el mismo grupo participa en otros proyectos de la misma tecnología;
- la oportunidad debería gestionarse a nivel de grupo y no sólo de SPV;
- existen proyectos del grupo próximos a compras o construcción;
- no existe todavía un contacto funcional para una etapa relevante;
- el grupo está entrando en una nueva región o tecnología;
- existe una empresa relacionada ya incorporada al CRM.

Estas señales serán explicables y derivadas de datos estructurados. No se presentarán inferencias como hechos societarios.

### 4.6 Acciones

- Abrir la ficha de la empresa.
- Abrir un proyecto relacionado.
- Explorar la relación en el grafo.
- Agregar empresa, proyecto o contacto al CRM.
- Seguir una empresa o grupo.
- Recibir alertas de nuevos proyectos o cambios relevantes.

## 5. Arquitectura de información

La página tendrá cinco áreas:

1. **Resumen:** grupo, cartera, capacidad, tecnologías, regiones y señales relevantes.
2. **Relaciones:** matriz, filiales, SPV, accionistas y administradores relevantes.
3. **Proyectos:** cartera consolidada y rol de cada sociedad.
4. **Personas:** contactos clasificados por función.
5. **Actividad:** cambios societarios, nuevos proyectos y movimientos de contactos.

“Stakeholders” podrá mantenerse como descriptor técnico, pero no como nombre principal de navegación. El nombre visible será **Empresas y relaciones**.

## 6. Datos mínimos requeridos del proveedor

Para evaluar Dequienes, Trantor u otra fuente se solicitará:

- búsqueda por RUT y razón social;
- RUT y razón social de cada entidad relacionada;
- tipo de relación;
- empresa matriz, socio o accionista;
- porcentaje de participación, cuando exista;
- persona administradora o representante, cuando exista;
- fecha de evidencia;
- fuente y documento;
- indicador de relación vigente o histórica;
- acceso incremental a cambios;
- límites y costo de API;
- condiciones de almacenamiento, transformación y exhibición a usuarios de Transition LATAM.

El proveedor preferido será el que pueda recibir un RUT y devolver relaciones estructuradas con tipo, fuente y fecha. Una colección de documentos sin relaciones estructuradas requiere procesamiento adicional.

## 7. Proveniencia y confianza

Cada relación conservará:

- `relationship_type`;
- `source_name`;
- `source_url`;
- `source_date`;
- `valid_from`;
- `valid_to`;
- `is_current`;
- `confidence_level`;
- `verification_status`;
- `verified_at`;
- `verified_by`.

Estados de presentación:

- confirmada documentalmente;
- informada por fuente oficial;
- probable, pendiente de revisión;
- histórica;
- vigente según última evidencia.

La interfaz usará “última evidencia encontrada” cuando no sea posible garantizar la vigencia completa.

## 8. Fuera de alcance inicial

- Due diligence legal completa.
- Reconstrucción jurídica exhaustiva de todas las modificaciones.
- Declaración garantizada de beneficiario final.
- Valoración financiera de empresas.
- Datos personales no relacionados con una función profesional.
- Scraping indiscriminado de personas.
- Relaciones internacionales no soportadas por una fuente contratada.
- Inferir propiedad por similitud de nombres.
- Grafos sin límite de profundidad.
- Presentar una publicación histórica como propiedad vigente sin validación.

## 9. Fases

### Fase A — prueba de fuentes

- Seleccionar diez RUT representativos del sector energético.
- Comparar Dequienes y Trantor con el mismo conjunto.
- Evaluar cobertura, estructura, vigencia, trazabilidad, API, licencia y costo.
- Seleccionar proveedor principal y fuente de respaldo.

### Fase B — identidad y relaciones

- Resolver empresas por RUT.
- Persistir relaciones tipadas con proveniencia.
- Construir grafo simplificado de hasta tres niveles.
- Vincular empresas y SPV existentes en Transition LATAM.

### Fase C — cartera consolidada

- Agregar proyectos, MW, tecnologías, regiones y etapas por grupo.
- Crear ficha de grupo empresarial.
- Incorporar resúmenes comerciales explicables.

### Fase D — personas y acciones

- Clasificar contactos por función.
- Integrar acciones de CRM.
- Permitir seguimiento y alertas.

### Fase E — inteligencia avanzada

- Comparación de grupos.
- Ruta de relación entre dos actores.
- Señales de oportunidad.
- Consultas mediante Transition AI.

## 10. Criterios de aceptación del MVP del módulo

1. Un usuario puede buscar una empresa por nombre o RUT.
2. La plataforma identifica la sociedad visible y, cuando existe evidencia, el grupo relacionado.
3. El grafo diferencia relación societaria, administración y relación con proyectos.
4. Cada vínculo muestra fuente, fecha y confianza.
5. La plataforma consolida proyectos y capacidad por grupo.
6. El usuario puede navegar desde empresa a SPV y proyecto.
7. Los contactos aparecen clasificados por función.
8. El usuario puede agregar una entidad o contacto al CRM.
9. Ninguna coincidencia de nombre se presenta automáticamente como propiedad.
10. La experiencia responde en menos de tres clics quién está detrás, qué cartera relacionada existe y cuál podría ser el siguiente paso comercial.

## 11. Métricas de éxito

- Porcentaje de empresas de proyectos resueltas por RUT.
- Porcentaje con grupo o matriz identificada.
- Porcentaje de relaciones con fuente y fecha.
- Proyectos promedio consolidados por grupo.
- Contactos funcionales identificados por cuenta.
- Empresas o contactos enviados al CRM.
- Alertas abiertas y oportunidades creadas desde el módulo.
- Uso recurrente de la vista de cartera relacionada.

## 12. Decisiones pendientes

- Proveedor principal: Dequienes, Trantor u otro.
- Contrato y condiciones de reutilización.
- Límite inicial de profundidad del grafo por plan.
- Frecuencia de actualización.
- Reglas exactas para considerar una relación vigente.
- Campos de contacto que legal y comercialmente pueden mostrarse.
- Límites de uso dentro de Premium.
