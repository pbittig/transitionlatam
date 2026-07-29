const KIMI_BASE_URL = "https://api.moonshot.ai/v1/chat/completions";
const DEFAULT_MODEL = "kimi-k3";

export interface KimiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface KimiChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: KimiToolCall[];
  tool_call_id?: string;
}

export interface KimiTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface KimiCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  tools?: KimiTool[];
}

export interface KimiChatResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls?: KimiToolCall[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chatWithKimiOnce(messages: KimiChatMessage[], options: KimiCompletionOptions): Promise<KimiChatResult> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("KIMI_API_KEY no está configurada");
  const model = options.model ?? process.env.KIMI_CHAT_MODEL ?? DEFAULT_MODEL;

  const response = await fetch(KIMI_BASE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 1,
      max_tokens: options.maxTokens ?? 700,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(options.tools ? { tools: options.tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Kimi respondió ${response.status}: ${await response.text()}`);

  const data = (await response.json()) as {
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices: Array<{ message: { content: string | null; tool_calls?: KimiToolCall[] }; finish_reason: string }>;
  };
  const message = data.choices[0]?.message;
  const toolCalls = message?.tool_calls;
  const content = message?.content;
  if (!content && !toolCalls?.length) throw new Error(`Kimi no devolvió contenido (finish_reason=${data.choices[0]?.finish_reason})`);
  return {
    content: content ?? "",
    model: data.model ?? model,
    inputTokens: data.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4),
    outputTokens: data.usage?.completion_tokens ?? Math.ceil((content ?? "").length / 4),
    toolCalls,
  };
}

// Kimi K3 ocasionalmente devuelve finish_reason "stop" con contenido vacío y
// sin tool_calls — una respuesta degenerada transitoria de la API, no un
// error de nuestro lado. Reintenta un par de veces antes de rendirse (mismo
// criterio de resiliencia que withRetry en el sync de listado).
export async function chatWithKimi(
  messages: KimiChatMessage[],
  options: KimiCompletionOptions = {},
): Promise<KimiChatResult> {
  const maxAttempts = 3;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await chatWithKimiOnce(messages, options);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!lastError.message.includes("no devolvió contenido") || attempt === maxAttempts) throw lastError;
      await sleep(500 * attempt);
    }
  }
  throw lastError;
}

export async function completeWithKimi(
  systemPrompt: string,
  userPrompt: string,
  options: KimiCompletionOptions = {},
): Promise<string> {
  const result = await chatWithKimi(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { ...options, model: options.model ?? DEFAULT_MODEL },
  );
  return result.content;
}
