import OpenAI from "openai";
import { getConfig } from "../config";
import { previewText } from "./chat-utils";
import type { ChatProcessStage } from "./chat-utils";

export const optimizeToolDecisionContext = async ({
  openai,
  latestUserMessage,
  latestAssistantMessage,
  toolSemanticGuide,
  emitChatProcess,
}: {
  openai: OpenAI;
  latestUserMessage: string;
  latestAssistantMessage: string;
  toolSemanticGuide: string;
  emitChatProcess: (
    stage: ChatProcessStage,
    message: string,
    data?: Record<string, unknown>,
  ) => void;
}): Promise<{ toolDecisionQuery: string; hasOptimizedToolContext: boolean }> => {
  let toolDecisionQuery = latestUserMessage;
  let hasOptimizedToolContext = false;

  if (latestUserMessage.trim().length > 0 && latestAssistantMessage.trim().length > 0) {
    const optimizationPrompt = `Merge the former assistant response and latest user message into a concise context optimized for tool calling.

Return only the optimized context text.

Use the following tool semantics to shape intent and terminology:
${toolSemanticGuide}

Former assistant response:
${latestAssistantMessage || "<none>"}

Latest user message:
${latestUserMessage}`;
    try {
      emitChatProcess("tool-context-start", "Optimizing context for smarter tool selection.");
      console.info(
        `[chat][tool-context] optimize_start latest_user_len=${latestUserMessage.length} latest_assistant_len=${latestAssistantMessage.length}`,
      );
      const optimizationCompletion = await openai.chat.completions.create({
        model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You produce concise retrieval-oriented context for downstream tool selection. Respect available tool semantics and optimize for intentional tool routing.",
          },
          { role: "user", content: optimizationPrompt },
        ],
      });
      const optimized = optimizationCompletion.choices[0]?.message?.content?.trim() || "";
      if (optimized.length > 0) {
        toolDecisionQuery = optimized;
        hasOptimizedToolContext = true;
        emitChatProcess("tool-context-done", "Tool-selection context optimized.", {
          optimized_len: optimized.length,
          optimized_preview: previewText(optimized),
        });
        console.info(
          `[chat][tool-context] optimize_done optimized_len=${optimized.length} preview="${previewText(optimized)}"`,
        );
      } else {
        emitChatProcess(
          "tool-context-failed",
          "Context optimizer returned empty output. Using your original question.",
        );
        console.warn("[chat][tool-context] optimize_empty fallback=latest_user_message");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitChatProcess(
        "tool-context-failed",
        "Context optimization failed. Continuing with your original question.",
        { error: message },
      );
      console.warn(
        `[chat][tool-context] optimize_failed fallback=latest_user_message error=${message}`,
      );
    }
  } else {
    emitChatProcess("tool-context-skipped", "Using latest user message directly for tool routing.");
  }

  return { toolDecisionQuery, hasOptimizedToolContext };
};
