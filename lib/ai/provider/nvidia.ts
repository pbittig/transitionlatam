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

export interface NemotronCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function completeWithNemotron(
  systemPrompt: string,
  userPrompt: string,
  options: NemotronCompletionOptions = {},
): Promise<string> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_NIM_API_KEY no está configurada");

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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`NVIDIA NIM no respondió en ${REQUEST_TIMEOUT_MS / 1000}s (timeout)`);
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(`NVIDIA NIM respondió ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string | null; reasoning_content?: string | null }; finish_reason: string }>;
  };
  const content = data.choices[0]?.message.content;
  if (!content) {
    console.error("Respuesta completa de NVIDIA NIM:", JSON.stringify(data, null, 2));
    throw new Error(
      `NVIDIA NIM no devolvió contenido (finish_reason=${data.choices[0]?.finish_reason}, ` +
        `reasoning_content len=${data.choices[0]?.message.reasoning_content?.length ?? 0})`,
    );
  }
  return content;
}
