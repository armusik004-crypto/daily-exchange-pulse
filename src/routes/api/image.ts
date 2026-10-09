import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const IMAGE_MODEL = "google/gemini-3.1-flash-image";

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "د AI کیلي تنظیم شوې نه ده." }, { status: 500 });
        }

        let body: { prompt?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "ناباوري غوښتنه." }, { status: 400 });
        }
        const prompt = (body.prompt || "").trim();
        if (!prompt) {
          return Response.json({ error: "د عکس تشریح نشته." }, { status: 400 });
        }

        try {
          const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: IMAGE_MODEL,
              messages: [
                {
                  role: "user",
                  content: `Generate an image: ${prompt}`,
                },
              ],
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            return Response.json(
              { error: `د عکس جوړول ناکام شول (${res.status}): ${text.slice(0, 200)}` },
              { status: res.status },
            );
          }

          const data = await res.json();
          const message = data?.choices?.[0]?.message;
          const images = message?.images as
            | Array<{ image_url?: { url?: string } }>
            | undefined;
          const url = images?.[0]?.image_url?.url;
          if (!url) {
            return Response.json(
              { error: "عکس ونه جوړ شو. بیا هڅه وکړئ." },
              { status: 502 },
            );
          }
          return Response.json({ image: url });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "نامعلومه ستونزه";
          return Response.json({ error: `د عکس جوړولو ستونزه: ${msg}` }, { status: 500 });
        }
      },
    },
  },
});
