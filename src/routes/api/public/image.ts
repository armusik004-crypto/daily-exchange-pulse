import { createFileRoute } from "@tanstack/react-router";
import { imagePost, corsPreflight } from "@/lib/ai-handlers.server";

// Public endpoint used by the packaged Android app (different WebView origin,
// needs CORS). No private data is returned; the AI key stays server-side.
export const Route = createFileRoute("/api/public/image")({
  server: {
    handlers: {
      POST: imagePost,
      OPTIONS: () => corsPreflight(),
    },
  },
});
