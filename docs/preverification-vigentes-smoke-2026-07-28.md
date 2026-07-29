# Demo de pre-verificación con IA

- Run ID: `cb8ab5d0-c77d-4bca-9b5e-9d0f4e83c0a6`
- Modo: apply
- Proyectos: 3

## Conexión Alimentador Bunster a Paño C3 - SE Deuco

- Project ID: `e5a265fa-b36d-41d1-99c4-bbd4b801abea`
- Solicitud: 2874
- Documentos: formulario — Formulario_SAC_SE_Deuco_Paño_C3-Alim_Bunster.xlsx (Formulario SAC)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | already_present | consumption | — | no | high | formulario: Formulario_SAC_SE_Deuco_Paño_C3-Alim_Bunster.xlsx. El campo ya tenía valor; no se tocó. |
| capacityMw | undetermined | — | — | no | high | formulario: Formulario_SAC_SE_Deuco_Paño_C3-Alim_Bunster.xlsx. El formulario clasifica el proyecto como Consumo, declarando retiro de red y sin componentes de generación o BESS. |
| storageHours | undetermined | — | — | no | high | formulario: Formulario_SAC_SE_Deuco_Paño_C3-Alim_Bunster.xlsx. El formulario clasifica el proyecto como Consumo, declarando retiro de red y sin componentes de generación o BESS. |
| capacityMwh | undetermined | — | — | no | high | formulario: Formulario_SAC_SE_Deuco_Paño_C3-Alim_Bunster.xlsx. El formulario clasifica el proyecto como Consumo, declarando retiro de red y sin componentes de generación o BESS. |

- Contactos: completed; encontrados 3, cargados 3. Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono.
- SEIA sugerido: ninguno (sin confianza). SEIA no devolvió candidatos.

## Proyecto Arqueros 

- Project ID: `96c9e95d-3cc0-49d5-bd04-920798bfc6d7`
- Solicitud: 1361
- Documentos: formulario — Formulario_de_solicitud_y_antecedentes_SAC.xlsx (Formulario SAC); informe_preliminar — 2309-DAA-IACP-PR3901-V1.pdf (Informe de autorización de conexión preliminar)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | already_present | consumption | — | no | — | formulario: Formulario_de_solicitud_y_antecedentes_SAC.xlsx; informe_preliminar: 2309-DAA-IACP-PR3901-V1.pdf. El campo ya tenía valor; no se tocó. |
| capacityMw | undetermined | — | — | no | — | formulario: Formulario_de_solicitud_y_antecedentes_SAC.xlsx; informe_preliminar: 2309-DAA-IACP-PR3901-V1.pdf. El formulario no registra datos de BESS o tecnología; el informe preliminar identifica el proyecto Arqueros como 'Consumo' de 27,93 MW, sin mencionar almacenamiento. |
| storageHours | undetermined | — | — | no | — | formulario: Formulario_de_solicitud_y_antecedentes_SAC.xlsx; informe_preliminar: 2309-DAA-IACP-PR3901-V1.pdf. El formulario no registra datos de BESS o tecnología; el informe preliminar identifica el proyecto Arqueros como 'Consumo' de 27,93 MW, sin mencionar almacenamiento. |
| capacityMwh | undetermined | — | — | no | — | formulario: Formulario_de_solicitud_y_antecedentes_SAC.xlsx; informe_preliminar: 2309-DAA-IACP-PR3901-V1.pdf. El formulario no registra datos de BESS o tecnología; el informe preliminar identifica el proyecto Arqueros como 'Consumo' de 27,93 MW, sin mencionar almacenamiento. |

- Contactos: completed; encontrados 3, cargados 3. Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono.
- SEIA sugerido: ninguno (low). El proyecto eléctrico corresponde a un centro de consumo (SAC) de Compañía Minera Arqueros S.A. en La Serena, pero el único expediente SEIA candidato (2160243763) es de tipo 'Líneas de transmisión eléctrica de alto voltaje' (DIA Art. 10 b1), lo que indica que corresponde a la línea de transmisión asociada y no a la central/consumo en sí. No hay un expediente que represente la central o BESS del proyecto. Devuelvo null por evidencia insuficiente.

## Nuevo Alimentador 12 KV Lonquimay en S/E Santa Raquel 

- Project ID: `1bcd904d-b550-42ae-a5a0-e6ae22d78fb5`
- Solicitud: 2458
- Documentos: formulario — 01_Formulario-de-solicitud-y-antecedentes-SAC_-_Lonquimay.pdf (Formulario SAC); informe_preliminar — 2508-DAA-IACP-PR5653-V1.pdf (Informe de autorización de conexión preliminar)

| Campo | Estado | Anterior | Propuesto | Aplicado | Confianza | Fuente / motivo |
|---|---|---:|---:|---|---|---|
| technologyCombo | already_present | consumption | — | no | high | formulario: 01_Formulario-de-solicitud-y-antecedentes-SAC_-_Lonquimay.pdf; informe_preliminar: 2508-DAA-IACP-PR5653-V1.pdf. El campo ya tenía valor; no se tocó. |
| capacityMw | undetermined | — | — | no | — | formulario: 01_Formulario-de-solicitud-y-antecedentes-SAC_-_Lonquimay.pdf; informe_preliminar: 2508-DAA-IACP-PR5653-V1.pdf. Proyecto de consumo (alimentador 12 kV) sin componentes de generación ni BESS declarados; el informe confirma tipo 'Consumo' con 8,3 MW de potencia nominal. |
| storageHours | undetermined | — | — | no | — | formulario: 01_Formulario-de-solicitud-y-antecedentes-SAC_-_Lonquimay.pdf; informe_preliminar: 2508-DAA-IACP-PR5653-V1.pdf. Proyecto de consumo (alimentador 12 kV) sin componentes de generación ni BESS declarados; el informe confirma tipo 'Consumo' con 8,3 MW de potencia nominal. |
| capacityMwh | undetermined | — | — | no | — | formulario: 01_Formulario-de-solicitud-y-antecedentes-SAC_-_Lonquimay.pdf; informe_preliminar: 2508-DAA-IACP-PR5653-V1.pdf. Proyecto de consumo (alimentador 12 kV) sin componentes de generación ni BESS declarados; el informe confirma tipo 'Consumo' con 8,3 MW de potencia nominal. |

- Contactos: completed; encontrados 3, cargados 3. Contactos extraídos; la carga aplica las validaciones vigentes de nombre/email/teléfono.
- SEIA sugerido: ninguno (sin confianza). SEIA no devolvió candidatos.
