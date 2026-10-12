import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateImage, imageSettings } from "@/lib/image-gateway.server";

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  stream: z.boolean().optional().default(true),
});

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "د AI کیلي تنظیم شوې نه ده." }, { status: 500 });
        }

        let body: z.infer<typeof requestSchema>;
        try {
          body = requestSchema.parse(await request.json());
        } catch {
          return Response.json({ error: "د عکس تشریح سمه نه ده." }, { status: 400 });
        }

        try {
          const upstream = await generateImage({ ...imageSettings, apiKey }, body.prompt, body.stream);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
              "Cache-Control": "no-cache, no-transform",
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "نامعلومه ستونزه";
          return Response.json({ error: `د عکس جوړولو ستونزه: ${msg}` }, { status: 500 });
        }
      },
    },
  },
});
