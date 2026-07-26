// Cliente para GLM-5.2 (Z.ai / Zhipu AI) servido a través del catálogo NVIDIA
// NIM (build.nvidia.com/z-ai/glm-5.2) — mismo endpoint base que nvidia.ts
// (Nemotron), pero con su propia clave (ZAI_GLM_API_KEY) y sin el prefijo
// "detailed thinking off" que sí aplica a Nemotron: ese es un control token
// específico de NVIDIA/Nemotron, no de GLM. Usado solo para comparar contra
// Kimi/Nemotron como juez de verificación — ver scripts/kimi-verification-pilot.ts.

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "z-ai/glm-5.2";

export interface GlmCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function completeWithGlm(
  systemPrompt: string,
  userPrompt: string,
  options: GlmCompletionOptions = {},
): Promise<string> {
  const apiKey = process.env.ZAI_GLM_API_KEY;
  if (!apiKey) throw new Error("ZAI_GLM_API_KEY no está configurada");

  const response = await fetch(NIM_BASE_URL, {
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
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 1024,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`GLM (NVIDIA NIM) respondió ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string | null; reasoning_content?: string | null }; finish_reason: string }>;
  };
  const content = data.choices[0]?.message.content;
  if (!content) {
    console.error("Respuesta completa de GLM:", JSON.stringify(data, null, 2));
    throw new Error(
      `GLM no devolvió contenido (finish_reason=${data.choices[0]?.finish_reason}, ` +
        `reasoning_content len=${data.choices[0]?.message.reasoning_content?.length ?? 0})`,
    );
  }
  return content;
}
