import { completeWithNemotron } from "@/lib/ai/provider/nvidia";
import type { FormularioData } from "./types";

const EMPTY_LOCATION = { utmZone: null, utmEast: null, utmNorth: null, comuna: null, region: null };

// Patrón de RUT chileno (NN.NNN.NNN-D) — inconfundible, a diferencia de nombres/
// teléfonos. Hallazgo real ("BESS Parque Fotovoltaico El Romero"): el RUT
// aparece varias líneas ANTES de su propia etiqueta "RUT" en el texto
// desordenado del PDF, y la IA a veces no logra asociarlos. Como red de
// seguridad, si la IA devuelve null, se busca el patrón directamente.
const RUT_PATTERN = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/;

function extractRutFallback(rawText: string): string | null {
  const match = rawText.match(RUT_PATTERN);
  return match ? match[0] : null;
}

export const SYSTEM_PROMPT = `Extraes datos estructurados de un formulario de ingreso de proyecto del Coordinador Eléctrico \
Nacional de Chile — "Solicitud de Autorización de Conexión (SAC)" o "Ingreso Proyecto Fehaciente" (mismos campos, \
distinto trámite) — a partir de texto plano extraído de un PDF cuyo orden de lectura puede estar desordenado \
respecto al layout visual original (nombres, teléfonos y correos pueden aparecer separados en el texto aunque \
pertenezcan a la misma persona).

El formulario siempre tiene esta estructura de campos (pueden faltar algunos):
- Razón Social, RUT, Domicilio Legal, Giro (de la empresa solicitante)
- Contacto de Representante Legal: nombre, teléfono, e-mail
- Coordinadores de proyecto (hasta 2): nombre, teléfono, e-mail cada uno — a veces rotulados "primer"/"segundo \
coordinador", a veces solo repetido "Nombre coordinador de proyecto" dos veces seguidas (en ese caso la primera \
aparición es project_coordinator_1, la segunda project_coordinator_2)
- Nombre del Proyecto, Tipo Proyecto, tipo de tecnología, Potencia Nominal [MW] o Potencia neta solicitada de \
inyección/retiro [MW], Factor de Potencia, Modo de control inversores
- Nombre de la S/E, Nivel de Tensión [kV], Carácter de conexión, Paño o N° de estructura(s)
- Fechas estimadas de Declaración en Construcción e Interconexión
- Comuna y Región del proyecto y del punto de conexión

Sobre el bloque de potencia por componente — hay DOS layouts reales distintos, distínguelos por lo que \
realmente aparece en el texto, no asumas uno:
1. Plantillas nuevas (ej. versión "2504-FORM-FEH-V1" o "2504-FORM-SAC-V1"): traen una sección separada \
"Parámetros Sistemas de Almacenamiento de Energía y Centrales Renovables con Capacidad de Almacenamiento" con \
DOS sub-bloques con su propio encabezado: "Componente generación" (un campo: Potencia [MW]) y "Componente de \
almacenamiento" (tres campos: Potencia [MW], Energía [MWh], Horas de almacenamiento [h]). Cuando el texto trae \
estos encabezados, usa esos valores para generationComponentMw/storageComponentMw/storageEnergyMwh/storageHours.
2. Plantillas viejas (ej. versión "07-06-21"): NO traen esa sección separada — solo hay un campo "Potencia \
Nominal [MW]" general, sin distinguir generación de almacenamiento. Cuando NO encuentres los encabezados \
"Componente generación"/"Componente de almacenamiento" en el texto: si el tipo de tecnología indica \
almacenamiento puro (ej. "BESS", "Baterías", "Almacenamiento", sin ningún componente de generación como \
solar/eólica/hidro/térmica mencionado junto), asigna ese valor único a storageComponentMw y deja \
generationComponentMw en null (criterio confirmado — hallazgo real: "BESS Parque Fotovoltaico El Romero", \
Potencia Nominal 196 MW, tecnología "BESS (almacenamiento)"). Si el tipo de tecnología es de generación pura o \
no queda claro cuál es, deja ambos (generationComponentMw y storageComponentMw) en null — nunca inventes una \
distinción que el documento no permite verificar.

Tu tarea: reconstruir correctamente qué nombre corresponde a qué teléfono y qué correo, usando el contexto \
(el orden en que aparecen las secciones, los dominios de correo compartidos entre personas de la misma \
empresa, y las etiquetas explícitas como "Nombre coordinador de proyecto"). Si un dato no aparece en el \
texto, usa null — nunca inventes un valor.

Responde ÚNICAMENTE con un JSON con esta forma exacta (sin texto adicional):
{
  "companyName": string|null,
  "companyRut": string|null,
  "companyLegalAddress": string|null,
  "contacts": [
    {"role": "legal_representative"|"project_coordinator_1"|"project_coordinator_2", "name": string|null, "email": string|null, "phone": string|null}
  ],
  "projectName": string|null,
  "projectKind": string|null,
  "technology": string|null,
  "netInjectionMw": number|null,
  "netWithdrawalMw": number|null,
  "powerFactor": number|null,
  "inverterControlMode": string|null,
  "generationComponentMw": number|null,
  "storageComponentMw": number|null,
  "storageEnergyMwh": number|null,
  "storageHours": number|null,
  "substationName": string|null,
  "voltageKv": number|null,
  "connectionType": string|null,
  "bay": string|null,
  "estimatedConstructionDate": string|null,
  "estimatedOperationDate": string|null,
  "projectComuna": string|null,
  "projectRegion": string|null,
  "connectionComuna": string|null,
  "connectionRegion": string|null
}`;

export async function extractFormularioWithAi(rawText: string): Promise<FormularioData> {
  // Esta ruta corre en ingesta por lotes, nunca bloqueando a un usuario, así que
  // se le da más margen que el defecto de 25s y se reintenta ante fallos del
  // servicio. Medido el 2026-08-18: 42 de 45 errores de una corrida de 287
  // Formularios fueron timeouts o 504, no problemas del documento — y como el
  // script no reprocesa lo ya registrado, cada uno perdía el PDF para siempre.
  const raw = await completeWithNemotron(SYSTEM_PROMPT, rawText, {
    jsonMode: true,
    maxTokens: 7000,
    // 60s cubre con holgura una respuesta normal (los aciertos rondan los 10-20s)
    // sin que un documento colgado se lleve minutos de la corrida. Dos reintentos
    // porque las caídas suelen venir en rachas de saturación del tier gratuito.
    timeoutMs: 60_000,
    retries: 2,
  });
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  // La IA a veces devuelve un valor con forma incorrecta para companyRut (hallazgo
  // real: confundió la "Fecha de solicitud" del checklist de verificación,
  // "16-02-2024", con el RUT). Un valor con forma equivocada es peor que null —
  // parece válido pero es basura — así que se valida contra el patrón antes de
  // aceptarlo, y si no calza se usa el fallback por regex sobre el texto crudo.
  const aiRut = (parsed.companyRut as string) ?? null;
  const validAiRut = aiRut && RUT_PATTERN.test(aiRut) ? aiRut : null;

  return {
    templateVersion: null,
    companyName: (parsed.companyName as string) ?? null,
    companyRut: validAiRut ?? extractRutFallback(rawText),
    companyLegalAddress: (parsed.companyLegalAddress as string) ?? null,
    contacts: Array.isArray(parsed.contacts) ? (parsed.contacts as FormularioData["contacts"]) : [],

    projectName: (parsed.projectName as string) ?? null,
    projectKind: (parsed.projectKind as string) ?? null,
    technology: (parsed.technology as string) ?? null,
    netInjectionMw: (parsed.netInjectionMw as number) ?? null,
    netWithdrawalMw: (parsed.netWithdrawalMw as number) ?? null,
    powerFactor: (parsed.powerFactor as number) ?? null,
    inverterControlMode: (parsed.inverterControlMode as string) ?? null,
    generationComponentMw: (parsed.generationComponentMw as number) ?? null,
    storageComponentMw: (parsed.storageComponentMw as number) ?? null,
    storageEnergyMwh: (parsed.storageEnergyMwh as number) ?? null,
    storageHours: (parsed.storageHours as number) ?? null,
    projectLocation: {
      ...EMPTY_LOCATION,
      comuna: (parsed.projectComuna as string) ?? null,
      region: (parsed.projectRegion as string) ?? null,
    },

    substationName: (parsed.substationName as string) ?? null,
    connectionType: (parsed.connectionType as string) ?? null,
    voltageKv: (parsed.voltageKv as number) ?? null,
    bay: (parsed.bay as string) ?? null,
    estimatedConstructionDate: (parsed.estimatedConstructionDate as string) ?? null,
    estimatedOperationDate: (parsed.estimatedOperationDate as string) ?? null,
    connectionLocation: {
      ...EMPTY_LOCATION,
      comuna: (parsed.connectionComuna as string) ?? null,
      region: (parsed.connectionRegion as string) ?? null,
    },
  };
}
