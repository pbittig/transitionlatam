// Cliente para Kimi (Moonshot AI) — API compatible con OpenAI. Usado solo para
// comparar objetivamente contra Nemotron en la extracción de Formulario — ver
// scripts/compare-nemotron-models.ts. No es el proveedor de IA por defecto del
// proyecto (ver lib/ai/provider/nvidia.ts).

const KIMI_BASE_URL = "https://api.moonshot.ai/v1/chat/completions";
const DEFAULT_MODEL = "kimi-k2.6";

export interface KimiCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function completeWithKimi(
  systemPrompt: string,
  userPrompt: string,
  options: KimiCompletionOptions = {},
): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("KIMI_API_KEY no está configurada");

  const response = await fetch(KIMI_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // kimi-k2.6 rechaza cualquier temperature distinta de 1 (400 "only 1 is
      // allowed for this model") — a diferencia de Nemotron, no permite forzar
      // determinismo bajando la temperatura.
      temperature: options.temperature ?? 1,
      max_tokens: options.maxTokens ?? 1024,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Kimi (Moonshot) respondió ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string | null }; finish_reason: string }>;
  };
  const content = data.choices[0]?.message.content;
  if (!content) {
    console.error("Respuesta completa de Kimi:", JSON.stringify(data, null, 2));
    throw new Error(`Kimi no devolvió contenido (finish_reason=${data.choices[0]?.finish_reason})`);
  }
  return content;
}
