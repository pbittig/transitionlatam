import { completeWithGlm } from "@/lib/ai/provider/glm";
import { completeWithNemotron } from "@/lib/ai/provider/nvidia";
import { waitForPreverificationGlmSlot } from "./rateLimit";

export type PreverificationReviewProvider = "glm" | "nemotron";

export async function completePreverificationReview(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  await waitForPreverificationGlmSlot();
  const provider = (process.env.PREVERIFICATION_REVIEW_PROVIDER ?? "glm") as PreverificationReviewProvider;
  if (provider === "nemotron") {
    return completeWithNemotron(systemPrompt, userPrompt, { jsonMode: true, maxTokens });
  }
  return completeWithGlm(systemPrompt, userPrompt, { jsonMode: true, maxTokens });
}
