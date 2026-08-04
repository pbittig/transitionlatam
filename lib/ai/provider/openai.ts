const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_NVIDIA_MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1.5";

export interface AiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: AiToolCall[];
  tool_call_id?: string;
}

export interface AiTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface AiCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  tools?: AiTool[];
}

export interface AiChatResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls?: AiToolCall[];
}

function providerConfiguration(options: AiCompletionOptions) {
  const openAiKey = process.env.OPENAI_API_KEY;
  const nvidiaKey = process.env.NVIDIA_NIM_API_KEY;
  if (!openAiKey && !nvidiaKey) throw new Error("OPENAI_API_KEY or NVIDIA_NIM_API_KEY must be configured");
  const usingOpenAi = Boolean(openAiKey);
  return {
    endpoint: usingOpenAi ? OPENAI_BASE_URL : NVIDIA_BASE_URL,
    apiKey: (openAiKey || nvidiaKey) as string,
    model: options.model ?? process.env.NEXO_CHAT_MODEL ?? (usingOpenAi ? DEFAULT_MODEL : DEFAULT_NVIDIA_MODEL),
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 900,
  };
}

function authorizationHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function chatWithOpenAi(messages: AiChatMessage[], options: AiCompletionOptions = {}): Promise<AiChatResult> {
  const config = providerConfiguration(options);
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: authorizationHeaders(config.apiKey),
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      messages,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(options.tools ? { tools: options.tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!response.ok) throw new Error(`OpenAI responded ${response.status}: ${await response.text()}`);

  const data = (await response.json()) as {
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices: Array<{ message: { content: string | null; tool_calls?: AiToolCall[] }; finish_reason: string }>;
  };
  const message = data.choices[0]?.message;
  if (!message?.content && !message?.tool_calls?.length) {
    throw new Error(`OpenAI returned no content (finish_reason=${data.choices[0]?.finish_reason})`);
  }
  return {
    content: message.content ?? "",
    toolCalls: message.tool_calls,
    model: data.model ?? config.model,
    inputTokens: data.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4),
    outputTokens: data.usage?.completion_tokens ?? Math.ceil((message.content ?? "").length / 4),
  };
}

export async function streamOpenAi(messages: AiChatMessage[], onDelta: (content: string) => void, options: AiCompletionOptions = {}): Promise<AiChatResult> {
  const config = providerConfiguration(options);
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: authorizationHeaders(config.apiKey),
    body: JSON.stringify({ model: config.model, temperature: config.temperature, max_tokens: config.max_tokens, messages, stream: true, stream_options: { include_usage: true } }),
  });
  if (!response.ok) throw new Error(`OpenAI responded ${response.status}: ${await response.text()}`);
  if (!response.body) throw new Error("OpenAI returned no response stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let model = config.model;
  let inputTokens = 0;
  let outputTokens = 0;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:") || line === "data: [DONE]") continue;
      const payload = JSON.parse(line.slice(5).trim()) as {
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        choices?: Array<{ delta?: { content?: string | null } }>;
      };
      model = payload.model ?? model;
      inputTokens = payload.usage?.prompt_tokens ?? inputTokens;
      outputTokens = payload.usage?.completion_tokens ?? outputTokens;
      const delta = payload.choices?.[0]?.delta?.content;
      if (delta) {
        content += delta;
        onDelta(delta);
      }
    }
    if (done) break;
  }
  if (!content) throw new Error("OpenAI returned an empty response stream");
  return {
    content,
    model,
    inputTokens: inputTokens || Math.ceil(JSON.stringify(messages).length / 4),
    outputTokens: outputTokens || Math.ceil(content.length / 4),
  };
}
