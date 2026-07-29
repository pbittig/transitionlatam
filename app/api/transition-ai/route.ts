import { askTransitionAi } from "@/app/(public)/aiActions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatRequest = {
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  question?: string;
};

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-16) : [];
  const question = typeof body.question === "string" ? body.question : "";
  const result = await askTransitionAi(history, question);
  if (!result.success) return Response.json({ error: result.error }, { status: 400 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const chunks = result.answer.match(/\S+\s*/g) ?? [result.answer];
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "delta", content: chunk })}\n`));
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
      controller.enqueue(
        encoder.encode(`${JSON.stringify({ type: "done", remainingTokens: result.remainingTokens })}\n`),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
