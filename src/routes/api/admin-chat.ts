import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import type { Database } from "@/integrations/supabase/types";
import { toOHLC, trendProbability } from "@/lib/analytics";
import type { RateRow } from "@/lib/rates.functions";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type ChatMessage = { role: "user" | "assistant" | "system"; content: string | ContentPart[] };

export const Route = createFileRoute("/api/admin-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice("Bearer ".length).trim();
        if (!token || token.split(".").length !== 3) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = process.env.SUPABASE_URL!;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });

        const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userRes.user) return new Response("Unauthorized", { status: 401 });

        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userRes.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleRow) return new Response("Forbidden", { status: 403 });

        const body = (await request.json()) as { messages?: ChatMessage[] };
        const messages = body.messages ?? [];
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Snapshot for grounding.
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const { data: rateRows } = await supabase
          .from("rates")
          .select("pair,buy,sell,recorded_at,recorded_date")
          .gte("recorded_date", since)
          .order("recorded_at", { ascending: false })
          .limit(500);
        const { data: sourceLogs } = await supabase
          .from("sources_log")
          .select("source,ok,note,created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        const rows = (rateRows ?? []) as RateRow[];
        const byPair = new Map<string, RateRow[]>();
        for (const r of rows) {
          const list = byPair.get(r.pair) ?? [];
          list.push(r);
          byPair.set(r.pair, list);
        }
        const snapshot: string[] = [];
        for (const pair of ["USD_AFN", "USD_PKR", "AFN_PKR"] as const) {
          const list = byPair.get(pair) ?? [];
          if (!list.length) {
            snapshot.push(`${pair}: no data`);
            continue;
          }
          const latest = list[0];
          const ohlc = toOHLC(list).slice(-7);
          const trend = trendProbability(list);
          snapshot.push(
            `${pair}: buy=${latest.buy} sell=${latest.sell} at ${latest.recorded_at}. ` +
              `OHLC 7d: ${ohlc.map((d) => `${d.date}(O${d.open.toFixed(2)} C${d.close.toFixed(2)})`).join(", ")}. ` +
              `Trend: pUp=${(trend.pUp * 100).toFixed(0)}% (${trend.direction}, ${trend.confidence}).`,
          );
        }
        const logsText = (sourceLogs ?? [])
          .map((l) => `${l.created_at} · ${l.source} · ${l.ok ? "ok" : "FAIL"} · ${l.note ?? ""}`)
          .join("\n");

        const system = [
          "You are the Admin AI Advisor for the Kandahar Market Rates application, built exclusively for the app administrator (Adris Roohane).",
          "You are a highly advanced, senior-level operations and market advisor with native-level Pashto (پښتو) fluency.",
          "Your DEFAULT reply language is Pashto (پښتو). Reply in Pashto unless the admin explicitly writes to you in English or Dari, in which case mirror that language.",
          "Vision: when the admin uploads screenshots (charts, Telegram posts, database rows, error dialogs, UI bugs), read them carefully and give concrete, actionable analysis — do not describe the image generically.",
          "You have full system context: current Kandahar market rates, 7-day OHLC per pair, trend signals, and the recent scraper run log. Use these to answer questions about data health, anomalies, and market direction.",
          "Never invent rates. Only use numbers in the LIVE DATA block. If data is missing, say so.",
          "Be direct and expert. Skip filler pleasantries. Give the admin the answer first, reasoning second.",
          "",
          "=== LIVE DATA (Kandahar market snapshot) ===",
          ...snapshot,
          "",
          "=== RECENT SCRAPER RUNS (newest first) ===",
          logsText || "(no logs yet)",
          "",
          `Generated at: ${new Date().toISOString()}`,
        ].join("\n");

        const provider = createOpenAICompatible({
          name: "lovable",
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: {
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        });
        const model = provider.chatModel("google/gemini-2.5-pro");

        try {
          const result = await generateText({
            model,
            system,
            // Cast: allow multimodal parts (image_url) alongside text.
            messages: messages as never,
          });
          return Response.json({ text: result.text });
        } catch (err) {
          const message = err instanceof Error ? err.message : "AI request failed";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
