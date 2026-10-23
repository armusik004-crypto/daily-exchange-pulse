import { createFileRoute } from "@tanstack/react-router";
import { imagePost } from "@/lib/ai-handlers.server";

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: imagePost,
    },
  },
});
