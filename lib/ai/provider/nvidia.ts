// Cliente para NVIDIA NIM (API compatible con OpenAI) — proveedor de modelos
// Nemotron. Ver /docs/06-arquitectura-ia.md §6.4 (capa de abstracción de IA).
// No usar directamente desde otros módulos fuera de /lib/ai — pasar siempre
// por una función de tarea específica (ver extractWithAi.ts como ejemplo).

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1.5";

// Sin esto, un fetch() nunca expira solo — un NIM colgado (visto en producción:
// 504 y respuestas sin contenido son frecuentes en el tier gratuito) deja la
// promesa pendiente indefinidamente, lo cual es especialmente grave cuando
// quien llama está bloqueando una respuesta al usuario (ver markProjectVerified).
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Marca los fallos que valen la pena reintentar: el servicio no llegó a
 * procesar la petición, o la cortó a mitad de camino. Un 400 o una respuesta
 * mal formada NO entran acá — reintentarlos da el mismo resultado y solo gasta
 * cuota. Se apoya en `cause` en vez de comparar el texto del mensaje, que es
 * frágil y además se traduce.
 */
export class NemotronTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NemotronTransientError";
  }
}

export interface NemotronCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /**
   * Cuánto esperar la respuesta. El valor por defecto es corto a propósito:
   * quien llama desde una ruta interactiva está bloqueando una respuesta al
   * usuario (ver markProjectVerified) y prefiere fallar antes que colgarse.
   * Un proceso por lotes no tiene esa restricción y puede dar más margen.
   */
  timeoutMs?: number;
  /**
   * Reintentos ante fallos transitorios, con espera creciente. Solo tiene
   * sentido fuera de una ruta interactiva: en el tier gratuito de NIM los 504 y
   * los timeouts son frecuentes, y en la ingesta por lotes el costo de esperar
   * es mucho menor que el de perder el documento (el script nunca reprocesa lo
   * que ya quedó registrado con error).
   */
  retries?: number;
}

export async function completeWithNemotron(
  systemPrompt: string,
  userPrompt: string,
  options: NemotronCompletionOptions = {},
): Promise<string> {
  const intentos = Math.max(0, options.retries ?? 0) + 1;
  let ultimoTransitorio: NemotronTransientError | null = null;

  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      return await pedirCompletion(systemPrompt, userPrompt, options);
    } catch (err) {
      if (!(err instanceof NemotronTransientError) || intento === intentos) throw err;
      ultimoTransitorio = err;
      // Espera creciente: 2s, 4s, 8s… Un 504 del tier gratuito suele venir de
      // saturación momentánea, y reintentar al instante cae en la misma.
      await new Promise((resolve) => setTimeout(resolve, 2_000 * 2 ** (intento - 1)));
    }
  }
  // Inalcanzable: el bucle o devuelve o relanza. Está por exhaustividad del tipo.
  throw ultimoTransitorio ?? new Error("NVIDIA NIM: fallo desconocido");
}

async function pedirCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: NemotronCompletionOptions,
): Promise<string> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_NIM_API_KEY no está configurada");
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetch(NIM_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        messages: [
          // "detailed thinking off" evita que el modelo gaste tokens en razonamiento
          // encadenado antes de responder — no necesario para extracción de campos.
          { role: "system", content: `detailed thinking off\n${systemPrompt}` },
          { role: "user", content: userPrompt },
        ],
        temperature: options.temperature ?? 0,
        max_tokens: options.maxTokens ?? 1024,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new NemotronTransientError(`NVIDIA NIM no respondió en ${timeoutMs / 1000}s (timeout)`);
    }
    // Un fallo de red (DNS, conexión cortada) tampoco es culpa del documento.
    if (err instanceof TypeError) throw new NemotronTransientError(`NVIDIA NIM inalcanzable: ${err.message}`);
    throw err;
  }

  if (!response.ok) {
    const detalle = `NVIDIA NIM respondió ${response.status}: ${await response.text()}`;
    // 429 (cuota) y 5xx (saturación) se pasan solos; un 4xx propio, no.
    if (response.status === 429 || response.status >= 500) throw new NemotronTransientError(detalle);
    throw new Error(detalle);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string | null; reasoning_content?: string | null }; finish_reason: string }>;
  };
  const content = data.choices[0]?.message.content;
  if (!content) {
    console.error("Respuesta completa de NVIDIA NIM:", JSON.stringify(data, null, 2));
    // Respuesta vacía: el modelo gastó el presupuesto de tokens razonando y no
    // llegó a escribir. Es del mismo tipo que un 504 —depende del momento, no
    // del documento— así que también se reintenta.
    throw new NemotronTransientError(
      `NVIDIA NIM no devolvió contenido (finish_reason=${data.choices[0]?.finish_reason}, ` +
        `reasoning_content len=${data.choices[0]?.message.reasoning_content?.length ?? 0})`,
    );
  }
  return content;
}
