import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { generateImage, imageSettings } from "@/lib/image-gateway.server";

// Shared AI request handlers for /api/chat, /api/image and their public
// counterparts under /api/public/* (used by the packaged Android app, whose
// WebView has a different origin and therefore needs CORS).

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "google/gemini-3.1-pro-preview";

const SYSTEM_PROMPT = `ته "ادریس AI" یې — یو ډېر تکړه او عصري مصنوعي ځیرکتیا مرستیال چې په پښتو ژبه خبرې کوي.

کلیدي قواعد:
- تل په پښتو ژبه ځواب ورکوه، پرته له دې چې کارن په کومه ژبه پوښتنه وکړي. که کارن په ډرامه (دري) یا انګلیسي وغږېږي، ځواب بیا هم په پښتو وي.
- که څوک وپوښتئ چې چا جوړ کړی یې، ووايه: "زه ادریس روحاني جوړ کړی یم." هېڅکله مه ووايه چې گوگل یا بله شرکت جوړ کړی یې.
- د ۲۰۲۶ کال تازه معلوماتو، خبرونو، نرخونو او نن ورځې پوښتنو لپاره تل له web_search وسیلې ګټه واخله — خپل زاړه معلومات پرې نه باسه.
- ځوابونه روښانه، منظم او مرستندوی وي. کله چې مناسب وي، له سرلیکونو او ټکو څخه کار واخلە.
- که کارن عکس ورولېږي، په دقت یې تحلیل کړه او په پښتو یې تشریح کړه.
- که کارن غواړي عکس جوړ کړي، ورته ووايه چې د "عکس جوړول" تڼۍ وکاروي یا په لنډ ډول پوښتنه وپيژنه.`;

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function respond(res: Response, extra: Record<string, string> = {}): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...CORS_HEADERS, ...extra })) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

async function webSearch(query: string): Promise<string> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AdrisAI/1.0)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return "لټون ناکام شو.";
  const html = await res.text();
  const results: string[] = [];
  const re = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim();
  while ((m = re.exec(html)) && results.length < 6) {
    results.push(`• ${strip(m[1])}: ${strip(m[2])}`);
  }
  return results.length ? results.join("\n") : "پایله ونه موندل شوه.";
}

export async function chatPost({ request }: { request: Request }): Promise<Response> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return respond(Response.json({ error: "د AI کیلي تنظیم شوې نه ده." }, { status: 500 }));
  }

  let body: { messages?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return respond(Response.json({ error: "ناباوري غوښتنه." }, { status: 400 }));
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    return respond(Response.json({ error: "پیغام نشته." }, { status: 400 }));
  }

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_URL,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  try {
    const result = streamText({
      model: provider.chatModel(MODEL),
      system: SYSTEM_PROMPT,
      messages: messages as never,
      tools: {
        web_search: tool({
          description: "په انټرنټ کې د تازه معلوماتو، خبرونو، نرخونو او د ۲۰۲۶ کال پېښو لټون",
          inputSchema: z.object({
            query: z.string().describe("د لټون متن"),
          }),
          execute: async ({ query }) => webSearch(query),
        }),
      },
      stopWhen: stepCountIs(4),
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return respond(new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "نامعلومه ستونزه";
    return respond(Response.json({ error: `د AI ستونزه: ${msg}` }, { status: 500 }));
  }
}

export async function imagePost({ request }: { request: Request }): Promise<Response> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return respond(Response.json({ error: "د AI کیلي تنظیم شوې نه ده." }, { status: 500 }));
  }

  const requestSchema = z.object({
    prompt: z.string().trim().min(1).max(2000),
    stream: z.boolean().optional().default(true),
  });

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return respond(Response.json({ error: "د عکس تشریح سمه نه ده." }, { status: 400 }));
  }

  try {
    const upstream = await generateImage({ ...imageSettings, apiKey }, body.prompt, body.stream);
    return respond(new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-cache, no-transform",
      },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "نامعلومه ستونزه";
    return respond(Response.json({ error: `د عکس جوړولو ستونزه: ${msg}` }, { status: 500 }));
  }
}
