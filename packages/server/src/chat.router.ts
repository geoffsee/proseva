import { AutoRouter } from "itty-router";
import { asIttyRoute, openapiFormat } from "./openapi";
import { handleChat } from "./chat/chat-service";

const router = AutoRouter({ base: "/api", format: openapiFormat });

router.post(
  "/chat",
  asIttyRoute("post", "/chat", async (req) => {
    const { messages } = (await req.json()) as {
      messages: { role: string; content: string }[];
    };
    return await handleChat(messages);
  }),
);

export { router as chatRouter };
