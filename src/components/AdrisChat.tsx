import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function AdrisChat() {
  const { t, lang, dir } = useI18n();
  const [open, setOpen] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ lang }),
      }),
    [lang],
  );

  const { messages, sendMessage, status } = useChat({
    id: "adris-chat",
    transport,
  });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("ai_title")}
        className="fixed bottom-5 end-5 z-40 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center hover:bg-emerald-500 transition"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div
          dir={dir}
          className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "min(70vh, 560px)" }}
        >
          <header className="px-4 py-3 border-b border-border bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
            <h3 className="font-semibold text-sm">{t("ai_title")}</h3>
            <p className="text-[11px] opacity-90">Kandahar Market Rates · live data</p>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-muted-foreground text-center py-6 text-xs">{t("ai_greeting")}</div>
            )}
            {messages.map((m: UIMessage) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      isUser
                        ? "max-w-[85%] rounded-2xl bg-emerald-600 text-white px-3 py-2"
                        : "max-w-[85%] text-foreground"
                    }
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="text-xs text-muted-foreground animate-pulse">Thinking…</div>
            )}
          </div>

          <form onSubmit={submit} className="border-t border-border p-2 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("ai_placeholder")}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={busy}
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label={t("ai_send")}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
