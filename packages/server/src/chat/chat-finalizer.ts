import OpenAI from "openai";
import { broadcast } from "../broadcast";
import { getConfig } from "../config";
import { previewMessageContent } from "./chat-utils";
import type { ChatProcessStage } from "./chat-utils";

export const buildPhase2Messages = ({
  toolMessages,
  toolRunSummary,
}: {
  toolMessages: OpenAI.ChatCompletionMessageParam[];
  toolRunSummary: string;
}): OpenAI.ChatCompletionMessageParam[] => [
  ...toolMessages,
  {
    role: "system",
    content: `Tool run summary (post-phase1): ${toolRunSummary}`,
  },
];

export const generateFinalChatReply = async ({
  openai,
  conversationMessages,
  emitChatProcess,
}: {
  openai: OpenAI;
  conversationMessages: OpenAI.ChatCompletionMessageParam[];
  emitChatProcess: (
    stage: ChatProcessStage,
    message: string,
    data?: Record<string, unknown>,
  ) => void;
}): Promise<{ reply: string }> => {
  const phase2ContextPreview = conversationMessages
    .map((message, idx) => {
      const role = message.role;
      const content = previewMessageContent(message.content);
      const toolCallId =
        role === "tool" && "tool_call_id" in message ? message.tool_call_id : undefined;
      const idPart = toolCallId ? ` tool_call_id=${toolCallId}` : "";
      return `#${idx + 1} role=${role}${idPart} content="${content}"`;
    })
    .join(" | ");
  console.info(
    `[chat][final-context] message_count=${conversationMessages.length} context=${phase2ContextPreview}`,
  );
  emitChatProcess("final-context-ready", "Final answer context assembled.", {
    message_count: conversationMessages.length,
  });

  broadcast("activity-status", { source: "chat", phase: "generating" });
  emitChatProcess("final-generation-start", "Generating final response for you.");
  try {
    const finalCompletion = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_LARGE") || "gpt-4o",
      messages: conversationMessages,
    });
    broadcast("activity-status", { source: "chat", phase: "idle" });
    emitChatProcess("final-generation-done", "Final response generated.");

    return {
      reply:
        finalCompletion.choices[0].message.content ??
        "Sorry, I was unable to complete the request.",
    };
  } catch (error) {
    broadcast("activity-status", { source: "chat", phase: "idle" });
    const message = error instanceof Error ? error.message : String(error);
    emitChatProcess("error", "Chat response generation failed.", { error: message });
    throw error;
  }
};
