# Demo de pre-verificación con IA

- Run ID: `8fd08027-29b9-466a-bd26-9fe720d170a6`
- Modo: apply
- Proyectos: 6

## Parque Eólico Ovejera Sur

- Project ID: `2e5e6175-76d0-42c6-b729-f324b96c91af`
- Solicitud: 3068
- Documentos: formulario — Formulario_de_Solicitud_Proyecto_PE_Ovejera_Sur.xlsx (Formulario SAC)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | completed | — | wind_bess | sí | high | formulario: Formulario_de_Solicitud_Proyecto_PE_Ovejera_Sur.xlsx. El formulario declara el proyecto como 'Eólico con Baterías' y lo clasifica como CRCA. |
| capacityMw | already_present | 216 | 216 | no | high | formulario: Formulario_de_Solicitud_Proyecto_PE_Ovejera_Sur.xlsx. El campo ya tenía valor; no se tocó. |
| storageHours | already_present | 5 | 5 | no | high | formulario: Formulario_de_Solicitud_Proyecto_PE_Ovejera_Sur.xlsx. El campo ya tenía valor; no se tocó. |
| capacityMwh | already_present | 1080 | 1080 | no | high | formulario: Formulario_de_Solicitud_Proyecto_PE_Ovejera_Sur.xlsx. El campo ya tenía valor; no se tocó. |

- Contactos: completed; encontrados 3, cargados 3. Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono.
- SEIA sugerido: 2151788123 — PARQUE EÓLICO OVEJERA SUR (high). Coincidencia exacta de nombre distintivo ('Parque Eólico Ovejera Sur'), titular (SpA del proyecto), región (Los Ríos) y comuna (Paillaco). El tipo de expediente 'Centrales generadoras de energía mayores a 3 MW' confirma que corresponde a la central eólica/BESS y no a líneas o subestaciones. Se selecciona el expediente con estado 'Aprobado' (2151788123) por sobre el 'No calificado' (2145821997), ya que el proyecto en evaluación se encuentra activo.

## Central Hidroeléctrica Rucalhue

- Project ID: `99775f8d-7de4-40ef-9580-9a899b300a6d`
- Solicitud: 3066
- Documentos: formulario — Formulario_de_verificación_de_entrega_de_antecedentes_SAC_2_de_2.pdf (Formulario SAC)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | undetermined | — | — | no | — | formulario: Formulario_de_verificación_de_entrega_de_antecedentes_SAC_2_de_2.pdf. El formulario no contiene información sobre la tecnología del proyecto; todos los campos relevantes están nulos. |
| capacityMw | already_present | 90 | — | no | — | formulario: Formulario_de_verificación_de_entrega_de_antecedentes_SAC_2_de_2.pdf. El campo ya tenía valor; no se tocó. |
| storageHours | undetermined | — | — | no | — | formulario: Formulario_de_verificación_de_entrega_de_antecedentes_SAC_2_de_2.pdf. El formulario extraído no contiene datos sobre tecnología, potencia, horas ni energía de almacenamiento. |
| capacityMwh | undetermined | — | — | no | — | formulario: Formulario_de_verificación_de_entrega_de_antecedentes_SAC_2_de_2.pdf. El formulario extraído no contiene datos sobre tecnología, potencia, horas ni energía de almacenamiento. |

- Contactos: undetermined; encontrados 0, cargados 0. El Formulario no entregó contactos plausibles.
- SEIA sugerido: 2128925735 — Central Hidroeléctrica Rucalhue (high). El expediente SEIA coincide consistentemente con el proyecto en múltiples señales independientes: nombre idéntico ('Central Hidroeléctrica Rucalhue'), misma región (Biobío), la comuna del proyecto (Santa Bárbara) está incluida en las comunas del expediente, y el tipo de expediente corresponde a una central generadora (no a línea o subestación). El titular difiere ligeramente (Rucalhue Energía SpA vs. ATIAIA/Empresa de Energía S.A.), lo cual es común por cambios de titularidad o uso de SPV, pero no invalida la coincidencia.

## Data Center Noviciado I

- Project ID: `645be3e1-026d-4db4-9c15-d846a6b3cec9`
- Solicitud: 3065
- Documentos: formulario — Formulario_de_Solicitud_Proyecto_Data_Center_Noviciado_I.xlsx (Formulario SAC)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | already_present | consumption | — | no | high | formulario: Formulario_de_Solicitud_Proyecto_Data_Center_Noviciado_I.xlsx. El campo ya tenía valor; no se tocó. |
| capacityMw | already_present | 500 | — | no | high | formulario: Formulario_de_Solicitud_Proyecto_Data_Center_Noviciado_I.xlsx. El campo ya tenía valor; no se tocó. |
| storageHours | undetermined | — | — | no | high | formulario: Formulario_de_Solicitud_Proyecto_Data_Center_Noviciado_I.xlsx. El formulario define el proyecto como 'Consumo' con retiro de 500 MW, dejando explícitamente nulos los campos de almacenamiento y generación. |
| capacityMwh | undetermined | — | — | no | high | formulario: Formulario_de_Solicitud_Proyecto_Data_Center_Noviciado_I.xlsx. El formulario define el proyecto como 'Consumo' con retiro de 500 MW, dejando explícitamente nulos los campos de almacenamiento y generación. |

- Contactos: completed; encontrados 3, cargados 3. Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono.
- SEIA sugerido: ninguno (sin confianza). SEIA no devolvió candidatos.

## Híbrido Longotoma

- Project ID: `25c2d9ba-68e9-44cf-abf8-10d92f1552bd`
- Solicitud: 3064
- Documentos: formulario — FORM-SAC-Híbrido_Longotoma.xlsx (Formulario SAC)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | completed | — | solar_bess | sí | high | formulario: FORM-SAC-Híbrido_Longotoma.xlsx. El formulario declara 'Solar con Baterías' y el tipo de proyecto como CRCA. |
| capacityMw | already_present | 89 | 89 | no | high | formulario: FORM-SAC-Híbrido_Longotoma.xlsx. El campo ya tenía valor; no se tocó. |
| storageHours | already_present | 5 | 5 | no | high | formulario: FORM-SAC-Híbrido_Longotoma.xlsx. El campo ya tenía valor; no se tocó. |
| capacityMwh | already_present | 445 | 445 | no | high | formulario: FORM-SAC-Híbrido_Longotoma.xlsx. El campo ya tenía valor; no se tocó. |

- Contactos: completed; encontrados 2, cargados 2. Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono.
- SEIA sugerido: ninguno (sin confianza). SEIA no devolvió candidatos.

## Sistema de Impulsión de Agua

- Project ID: `dc94d2e0-63c0-4203-b104-b45befb6800e`
- Solicitud: 3063
- Documentos: formulario — 1005-02-C-INT-000-7255-EL-FRM-00002.pdf (Formulario SUCTD)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | already_present | consumption | wind | no | high | formulario: 1005-02-C-INT-000-7255-EL-FRM-00002.pdf. El campo ya tenía valor; no se tocó. |
| capacityMw | already_present | 6 | — | no | low | formulario: 1005-02-C-INT-000-7255-EL-FRM-00002.pdf. El campo ya tenía valor; no se tocó. |
| storageHours | undetermined | — | — | no | low | formulario: 1005-02-C-INT-000-7255-EL-FRM-00002.pdf. El formulario declara un proyecto eólico puro con 150 MW de inyección neta, sin componentes de almacenamiento informados. |
| capacityMwh | undetermined | — | — | no | low | formulario: 1005-02-C-INT-000-7255-EL-FRM-00002.pdf. El formulario declara un proyecto eólico puro con 150 MW de inyección neta, sin componentes de almacenamiento informados. |

- Contactos: undetermined; encontrados 3, cargados 0. Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono.
- SEIA sugerido: ninguno (sin confianza). No hay coincidencia con ningún candidato. El proyecto es de consumo eléctrico (6 MW de retiro) asociado a Compañía Minera Zaldívar en Antofagasta, mientras que los candidatos son sistemas de impulsión de agua (acueductos o líneas de transmisión) de otros titulares (Collahuasi, Codelco Andina, Municipalidad de Valparaíso) en otras regiones. El contexto documental menciona tecnología eólica de 150 MW, lo que tampoco coincide con el proyecto ni con los candidatos. Evidencia insuficiente para seleccionar un expediente SEIA.

## Proyecto NEHVTI

- Project ID: `c0cbac80-1b4d-426a-9c8b-7e0757601757`
- Solicitud: 3061
- Documentos: formulario — OT3126_BHP_-_Formulario_SUCTD.xlsx (Formulario SUCTD)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | undetermined | — | — | no | — | formulario: OT3126_BHP_-_Formulario_SUCTD.xlsx. El proyecto se declara como 'Consumo' (projectKind: Otro, technology: Consumo), por lo que no corresponde a generación ni almacenamiento. |
| capacityMw | already_present | 0 | — | no | — | formulario: OT3126_BHP_-_Formulario_SUCTD.xlsx. El campo ya tenía valor; no se tocó. |
| storageHours | undetermined | — | — | no | — | formulario: OT3126_BHP_-_Formulario_SUCTD.xlsx. El formulario declara el proyecto como tecnología 'Consumo' con todos los campos de almacenamiento y generación nulos. |
| capacityMwh | undetermined | — | — | no | — | formulario: OT3126_BHP_-_Formulario_SUCTD.xlsx. El formulario declara el proyecto como tecnología 'Consumo' con todos los campos de almacenamiento y generación nulos. |

- Contactos: completed; encontrados 3, cargados 3. Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono.
- SEIA sugerido: ninguno (sin confianza). SEIA no devolvió candidatos.
