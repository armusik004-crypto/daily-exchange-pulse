import { createFileRoute } from "@tanstack/react-router";
import { chatPost } from "@/lib/ai-handlers.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: chatPost,
    },
  },
});
