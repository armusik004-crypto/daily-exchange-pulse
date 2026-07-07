import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Send, X, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Attachment = { dataUrl: string; name: string };
type Msg = { role: "user" | "assistant"; text: string; images?: string[] };

export function AdminChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const pickImages = () => fileRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      if (!f.type.startsWith("image/")) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      next.push({ dataUrl, name: f.name });
    }
    setAttachments((a) => [...a, ...next].slice(0, 4));
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (busy) return;
    setBusy(true);
    setError(null);

    const userMsg: Msg = {
      role: "user",
      text,
      images: attachments.map((a) => a.dataUrl),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");

      const apiMessages = next.map((m) => {
        if (m.role === "assistant") return { role: "assistant", content: m.text };
        const parts: Array<
          { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
        > = [];
        if (m.text) parts.push({ type: "text", text: m.text });
        for (const img of m.images ?? []) {
          parts.push({ type: "image_url", image_url: { url: img } });
        }
        return { role: "user", content: parts };
      });

      const res = await fetch("/api/admin-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { text: string };
      setMessages((m) => [...m, { role: "assistant", text: data.text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      // Restore attachments so admin can retry.
      setAttachments(sentAttachments);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Admin AI"
        className="fixed bottom-5 end-24 z-40 h-14 w-14 rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/40 flex items-center justify-center hover:bg-slate-800 transition ring-2 ring-amber-400"
      >
        {open ? <X className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6 text-amber-400" />}
      </button>

      {open && (
        <div
          dir="ltr"
          className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-2xl border border-amber-400/40 bg-background shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "min(75vh, 620px)" }}
        >
          <header className="px-4 py-3 border-b bg-gradient-to-r from-slate-900 to-slate-700 text-white">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              Admin AI Advisor
            </h3>
            <p className="text-[11px] opacity-80">Pashto-native · Vision · System context</p>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-muted-foreground text-center py-6 text-xs" dir="rtl">
                سلام اډریس! زه ستاسو د ایډمن مرستیال یم. د پروژې د معلوماتو، سکرین شاټ یا هر پوښتنه راولېږئ.
              </div>
            )}
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      isUser
                        ? "max-w-[85%] rounded-2xl bg-slate-900 text-white px-3 py-2 space-y-1"
                        : "max-w-[85%] text-foreground"
                    }
                  >
                    {m.images && m.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-1">
                        {m.images.map((src, j) => (
                          <img
                            key={j}
                            src={src}
                            alt=""
                            className="rounded-md max-h-40 object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {m.text && (
                      <p className="whitespace-pre-wrap leading-relaxed" dir="auto">
                        {m.text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing…
              </div>
            )}
            {error && <div className="text-xs text-rose-600">{error}</div>}
          </div>

          {attachments.length > 0 && (
            <div className="px-3 pt-2 flex flex-wrap gap-2 border-t">
              {attachments.map((a, i) => (
                <div key={i} className="relative">
                  <img src={a.dataUrl} alt={a.name} className="h-14 w-14 object-cover rounded-md" />
                  <button
                    onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}
                    className="absolute -top-1 -end-1 h-4 w-4 bg-slate-900 text-white rounded-full text-[10px] flex items-center justify-center"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={send} className="border-t p-2 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={pickImages}
              disabled={busy}
              aria-label="Attach image"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="پوښتنه ولیکئ یا تصویر ولېږئ…"
              dir="auto"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={busy}
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || (!input.trim() && attachments.length === 0)}
              className="bg-slate-900 hover:bg-slate-800"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
