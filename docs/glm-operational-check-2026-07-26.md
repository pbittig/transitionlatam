# Prueba operacional — sugerencia de IA del Verificador (2026-07-26)

Muestra aleatoria de 20 proyectos de la cola real del Verificador (de 1000 pendientes). Corre el mismo código integrado en /admin/verificador — no un script aparte. Solo lectura, nada se escribió en la base de datos.

**Errores:** 0/20 (0%) — **Sanity ok:** 18 — **Sospechoso:** 2 — **Con candidatos SEIA:** 5 — **Con pick sugerido:** 2 — **Tiempo promedio:** 11508ms

---

## 1. Instalación Sexto Transformador de Poder en S/E Collahuasi

- **Sanity:** ok — Los datos son coherentes con un proyecto de consumo/minería; el RUT nulo y capacidades en 0 son normales para este tipo de solicitud.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para comparar.
- **Tiempo:** 8824ms

## 2. BESS Halcón 27

- **Sanity:** ok — Los datos del proyecto son consistentes; capacidadMwh es nulo pero no invalida la solicitud.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para este proyecto.
- **Tiempo:** 5492ms

## 3. PSF BESS Nogal

- **Sanity:** ok — Los datos clave son consistentes: el nombre indica BESS, incluye almacenamiento, y la capacidad de 90 MW es razonable; los campos nulos corresponden a información opcional o no aplicable.
- **Candidatos SEIA:** 8
- **Pick:** ninguno — Ningún candidato coincide: el proyecto es un BESS de Orion Power en Melipilla (RM), y todos los candidatos son líneas, subestaciones o centrales en otras regiones y comunas con titulares distintos.
- **Tiempo:** 9056ms

## 4. Conexión Nuevo Alimentador Catillo 13,2 kV 

- **Sanity:** ok — Los datos son consistentes para un proyecto de consumo (alimentador) sin capacidad de generación ni almacenamiento.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA, lo cual es esperable ya que proyectos de distribución de este tipo suelen no ingresar al SEIA.
- **Tiempo:** 6811ms

## 5. BESS Renacer Tarapacá

- **Sanity:** sospechoso — El nombre del proyecto indica 'BESS' pero el campo incluyeAlmacenamiento es false.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA.
- **Tiempo:** 8193ms

## 6. BESS Sol de Los Andes II

- **Sanity:** ok — Los datos son consistentes con un proyecto BESS puro; el RUT tiene formato válido y la capacidad de almacenamiento es coherente.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para este proyecto.
- **Tiempo:** 8666ms

## 7. Conexión Alimentador 3 a Paño E3 - SE La Misión

- **Sanity:** ok — Los datos son consistentes con un proyecto de consumo sin almacenamiento.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No hay candidatos SEIA en la lista para comparar.
- **Tiempo:** 12054ms

## 8. Sol de la Rosa

- **Sanity:** ok — Los datos principales son consistentes; la falta de tecnología y RUT no invalida el registro.
- **Candidatos SEIA:** 5
- **Pick:** ninguno — Ningún candidato calza en región/comuna ni coincide con el titular Solarig; los nombres similares corresponden a otras ubicaciones y empresas.
- **Tiempo:** 6682ms

## 9. Ampliación Catalina del Verano

- **Sanity:** ok — Los datos son consistentes; el RUT nulo y la capacidad en 0 son habituales en formularios de modificación o ampliación.
- **Candidatos SEIA:** 1
- **Pick:** `2163756244` — Coincide exactamente en nombre del proyecto, comuna, región y tipo de central generadora solar.
- **Tiempo:** 9033ms

## 10. Sistema de almacenamiento PF El Manzano

- **Sanity:** ok — Los datos son consistentes; la falta de tecnología, RUT y capacidad en MWh no es crítica para un proyecto de almacenamiento.
- **Candidatos SEIA:** 7
- **Pick:** ninguno — Ningún candidato corresponde al ser un proyecto de almacenamiento de Enel en Tiltil; los candidatos son de otros titulares, tecnologías o comunas.
- **Tiempo:** 14756ms

## 11. Hibrido Gene

- **Sanity:** ok — Los datos principales están completos y son consistentes; la falta de tecnología y capacidad de almacenamiento es coherente con el campo incluyeAlmacenamiento en false.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para poder realizar una asociación.
- **Tiempo:** 9883ms

## 12. Híbrido Longotoma

- **Sanity:** ok — Los datos principales están completos y son consistentes entre sí; la falta de tecnología o capacidad de almacenamiento no es una inconsistencia.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para poder realizar una comparación o elección.
- **Tiempo:** 7485ms

## 13. BESS Centauro (Ex BESS Lampa)

- **Sanity:** ok — Los datos son consistentes para un proyecto BESS; la ausencia de RUT y capacidad en MWh se considera falta de datos opcionales.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para validar el proyecto.
- **Tiempo:** 16866ms

## 14. Nuevo Alimentador Til Til

- **Sanity:** ok — Los datos son consistentes para un proyecto de consumo (alimentador) sin almacenamiento; el RUT nulo no es crítico si la empresa es municipal.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para comparar.
- **Tiempo:** 11317ms

## 15. Ampliación Parque Eólico Chequenes (ex Pemuco) + BESS

- **Sanity:** ok — Los datos clave como nombre, empresa, región y comuna están presentes y son coherentes; la falta de capacidad y RUT no es crítica para invalidar el registro.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para comparar.
- **Tiempo:** 33109ms

## 16. Ampliación Mila del Verano Solar

- **Sanity:** ok — Los datos del proyecto son consistentes entre sí y no presentan inconsistencias críticas.
- **Candidatos SEIA:** 1
- **Pick:** `2146512445` — El nombre, titular, región y comuna del expediente coinciden exactamente con el proyecto de ampliación solar.
- **Tiempo:** 9825ms

## 17. PV+BESS Cala

- **Sanity:** ok — Los datos de capacidad y tecnologías son consistentes entre sí para un proyecto solar con almacenamiento.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para comparar y validar el proyecto.
- **Tiempo:** 8341ms

## 18. Nuevo Alimentador 12 KV Limarí en S/E Santa Raquel 

- **Sanity:** ok — Los datos son consistentes para un proyecto de consumo de distribución sin capacidad de generación ni almacenamiento.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA, lo cual es habitual para este tipo de proyectos menores de distribución.
- **Tiempo:** 14962ms

## 19. Nuevo Alimentador 12 kV Perdices en S/E Macul     

- **Sanity:** ok — Los datos del proyecto son coherentes: el RUT y empresa corresponden a Enel Distribución, y la tecnología, tensiones y ubicación son consistentes.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA, lo cual es esperable ya que es un proyecto de distribución/consumo de baja tensión que típicamente no ingresa al SEIA.
- **Tiempo:** 22380ms

## 20. BESS Halcón 23

- **Sanity:** sospechoso — El nombre del proyecto indica 'BESS' pero el campo incluyeAlmacenamiento es false y la capacidadMwh está vacía.
- **Candidatos SEIA:** 0
- **Pick:** ninguno — No se encontraron candidatos en el SEIA para realizar la validación.
- **Tiempo:** 6420ms
