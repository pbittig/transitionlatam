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
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await askTransitionAi(history, question, (content) => {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "delta", content })}\n`));
        });
        if (!result.success) {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", error: result.error, quota: result.quota ?? null })}\n`));
        } else {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done", quota: result.quota })}\n`));
        }
      } catch (error) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "No pudimos consultar a Nexo." })}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
