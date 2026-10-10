import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  MessageCircle,
  ImagePlus,
  Code2,
  GraduationCap,
  Send,
  Paperclip,
  Camera,
  Plus,
  Menu,
  X,
  LogOut,
  Trash2,
  Sparkles,
  Loader2,
  ChevronDown,
  SlidersHorizontal,
  Lightbulb,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { chatDb } from "@/lib/chat-db";
import starScene from "@/assets/adris-orbit.webp.asset.json";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adris AI — ستاسو پښتو ویاند مرستیال" },
      { name: "description", content: "Adris AI — په پښتو ژبه ځوابونکي مصنوعي ځیرکتیا. خبرې اترې، عکس جوړول، کوډ او زده کړه. جوړونکی: ادریس روحاني." },
      { property: "og:title", content: "Adris AI — ستاسو پښتو ویاند مرستیال" },
      { property: "og:description", content: "په پښتو ژبه ځوابونکي مصنوعي ځیرکتیا — خبرې اترې، عکس جوړول، کوډ او زده کړه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdrisApp,
});

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  image?: string; // data URL (user attachment or generated image)
};

type Conversation = { id: string; title: string; created_at: string };

function StarLogo({ size = 40 }: { size?: number }) {
  return <Sparkles width={size} height={size} className="adris-star" aria-hidden />;
}

const QUICK_CARDS = [
  { icon: MessageCircle, title: "خبرې اترې", desc: "له ما سره په پښتو وغږېږئ", prompt: "سلام! ته څه کولای شې؟" },
  { icon: ImagePlus, title: "عکس جوړول", desc: "خپل تصور عکس ته واړوئ", prompt: "__IMAGE_MODE__" },
  { icon: Code2, title: "کوډ", desc: "پروګرامینګ مرسته", prompt: "ما سره د پایتون په زده کړه کې مرسته وکړه" },
  { icon: Lightbulb, title: "زده کړه", desc: "نوي شیان زده کړئ", prompt: "د مصنوعي ځیرکتیا په اړه راته وښيه" },
];

function AdrisApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadConversations = useCallback(async () => {
    const { data } = await chatDb
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setConversations(data as Conversation[]);
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error("ننوتل ناکام شول: " + error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setConversations([]);
    setActiveId(null);
    setMessages([]);
  };

  const openConversation = async (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    const { data } = await chatDb
      .from("messages")
      .select("id, role, content, image_url")
      .eq("conversation_id", id)
      .order("created_at");
    if (data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          image: m.image_url ?? undefined,
        })),
      );
    }
  };

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setImageMode(false);
    setSidebarOpen(false);
  };

  const deleteConversation = async (id: string) => {
    await chatDb.from("conversations").delete().eq("id", id);
    if (activeId === id) newChat();
    loadConversations();
  };

  const ensureConversation = async (firstText: string): Promise<string | null> => {
    if (activeId) return activeId;
    if (!user) return null;
    const title = firstText.slice(0, 40) || "نوې خبرې";
    const { data, error } = await chatDb
      .from("conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (error || !data) return null;
    setActiveId(data.id);
    loadConversations();
    return data.id;
  };

  const saveMessage = async (convId: string | null, msg: Msg) => {
    if (!convId || !user) return;
    await chatDb.from("messages").insert({
      conversation_id: convId,
      role: msg.role,
      content: msg.content,
      image_url: msg.image ?? null,
    });
  };

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("عکس ډېر لوی دی (تر ۸MB لاندې وي).");
      return;
    }
    setAttachment(await readFile(file));
  };

  const generateImage = async (prompt: string) => {
    setBusy(true);
    const convId = await ensureConversation(prompt);
    const userMsg: Msg = { role: "user", content: `🎨 عکس جوړ کړه: ${prompt}` };
    setMessages((p) => [...p, userMsg]);
    await saveMessage(convId, userMsg);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ناکام");
      const aiMsg: Msg = {
        role: "assistant",
        content: "ستاسو عکس چمتو دی! ✨",
        image: data.image,
      };
      setMessages((p) => [...p, aiMsg]);
      await saveMessage(convId, aiMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "د عکس جوړول ناکام شول");
    } finally {
      setBusy(false);
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content && !attachment) return;
    if (busy) return;
    if (!user) { await signIn(); return; }

    if (content === "__IMAGE_MODE__") {
      setImageMode(true);
      return;
    }
    if (imageMode) {
      setInput("");
      setImageMode(false);
      await generateImage(content);
      return;
    }

    setInput("");
    setBusy(true);
    const convId = await ensureConversation(content);

    const userMsg: Msg = { role: "user", content, image: attachment ?? undefined };
    setAttachment(null);
    const history = [...messages, userMsg];
    setMessages(history);
    await saveMessage(convId, userMsg);

    // placeholder assistant message to stream into
    setMessages((p) => [...p, { role: "assistant", content: "" }]);

    try {
      const apiMessages = history.map((m) => {
        if (m.image && m.role === "user") {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content || "دا عکس تحلیل کړه" },
              { type: "image_url", image_url: { url: m.image } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `ستونزه (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const snapshot = full;
        setMessages((p) => {
          const copy = [...p];
          copy[copy.length - 1] = { role: "assistant", content: snapshot };
          return copy;
        });
      }
      const aiMsg: Msg = { role: "assistant", content: full };
      await saveMessage(convId, aiMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "نامعلومه ستونزه";
      setMessages((p) => {
        const copy = [...p];
        copy[copy.length - 1] = { role: "assistant", content: `⚠️ بخښنه غواړم، ستونزه رامنځته شوه: ${msg}` };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  // ---------- Loading ----------
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <StarLogo size={56} />
      </div>
    );
  }

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "ملګري";

  // ---------- Main app ----------
  return (
    <div className="adris-app flex h-dvh bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-72 transform border-l border-sidebar-border bg-sidebar transition-transform  ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <StarLogo size={28} />
              <span className="font-bold text-sidebar-foreground">Adris AI</span>
            </div>
            <Button variant="ghost"
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
              aria-label="بندول"
            >
              <X size={18} />
            </Button>
          </div>
          <Button variant="ghost"
            onClick={newChat}
            className="mx-4 flex items-center justify-center gap-2 rounded-full bg-sidebar-primary px-4 py-2.5 text-sm font-semibold text-sidebar-primary-foreground transition hover:opacity-90"
          >
            <Plus size={16} /> نوې خبرې
          </Button>
          <div className="mt-4 flex-1 overflow-y-auto px-3 chat-scroll">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group mb-1 flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm transition ${
                  activeId === c.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                }`}
              >
                <Button variant="ghost" onClick={() => openConversation(c.id)} className="flex-1 truncate text-right">
                  {c.title}
                </Button>
                <Button variant="ghost"
                  onClick={() => deleteConversation(c.id)}
                  className="hidden rounded p-1 text-sidebar-foreground/50 hover:text-destructive group-hover:block"
                  aria-label="ړنګول"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            {!conversations.length && (
              <p className="px-3 py-6 text-center text-xs text-sidebar-foreground/50">
                لا تر اوسه خبرې نشته
              </p>
            )}
          </div>
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
                {firstName[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{firstName}</p>
                <p className="truncate text-xs text-sidebar-foreground/50">{user?.email}</p>
              </div>
              <Button variant="ghost"
                onClick={user ? signOut : signIn}
                className="rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="وتل"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="adris-header" dir="ltr">
          <Button variant="ghost" className="neon-icon" onClick={() => setSidebarOpen(true)} aria-label="مینو" title="مینو"><Menu /></Button>
          <div className="brand-stack">
            <div className="brand-title"><StarLogo size={24} /><span>Adris AI</span></div>
            <span className="pro-badge" title="Gemini 3.1 Pro">Pro <ChevronDown size={14} /></span>
          </div>
          <Button variant="ghost" className="profile-orb" onClick={user ? () => setSidebarOpen(true) : signIn} aria-label={user ? "حساب" : "له جیمیل سره ننوتل"} title={user ? "حساب" : "له جیمیل سره ننوتل"}>{user ? firstName.slice(0,2) : "Ar"}</Button>
        </header>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll">
          {!messages.length ? (
            <div className="welcome-screen">
              <img src={starScene.url} alt="د ادریس AI ځلېدونکی ستوری" className="star-scene" />
              <h1 className="welcome-title">سلام، <span>{firstName}!</span></h1>
              <p className="welcome-subtitle">نن څنګه مرسته درسره وکړم؟</p>
              <div className="quick-actions">
                {QUICK_CARDS.map((c, i) => (
                  <Button variant="ghost" key={c.title} onClick={() => send(c.prompt)} className={`quick-action action-${i}`} title={c.desc}>
                    <c.icon /><span>{c.title}</span><small>{c.desc}</small>
                  </Button>
                ))}
              </div>
              {!user && <Button variant="link" onClick={signIn} className="welcome-login">له جیمیل سره ننوتل</Button>}
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-6">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`mb-6 flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {m.role === "assistant" && (
                    <div className="mt-1 shrink-0">
                      <StarLogo size={26} />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] ${
                      m.role === "user"
                        ? "rounded-2xl rounded-tl-sm bg-primary px-4 py-3 text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {m.image && (
                      <img
                        src={m.image}
                        alt="عکس"
                        className="mb-2 max-w-full rounded-xl border border-border"
                        style={{ maxHeight: 320 }}
                      />
                    )}
                    {m.role === "assistant" ? (
                      m.content ? (
                        <div className="prose prose-sm prose-invert max-w-none leading-8 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3" dir="rtl">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex gap-1.5 py-2">
                          <span className="adris-dot h-2 w-2 rounded-full bg-primary" />
                          <span className="adris-dot h-2 w-2 rounded-full bg-primary" />
                          <span className="adris-dot h-2 w-2 rounded-full bg-primary" />
                        </div>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-7">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {busy && messages[messages.length - 1]?.role === "user" && (
                <div className="mb-6 flex gap-3">
                  <StarLogo size={26} />
                  <div className="flex gap-1.5 py-2">
                    <span className="adris-dot h-2 w-2 rounded-full bg-primary" />
                    <span className="adris-dot h-2 w-2 rounded-full bg-primary" />
                    <span className="adris-dot h-2 w-2 rounded-full bg-primary" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="composer-wrap">
          <div className="neon-composer">
            {attachment && <div className="attachment-preview"><img src={attachment} alt="ضمیمه" /><Button variant="ghost" size="icon" onClick={() => setAttachment(null)} aria-label="لرې کول"><X /></Button></div>}
            {imageMode && <div className="image-mode-label"><ImagePlus size={16} /><span>عکس جوړول</span><Button variant="ghost" size="icon" onClick={() => setImageMode(false)} aria-label="لغوه"><X /></Button></div>}
            <div className="composer-input"><StarLogo size={22} /><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={imageMode ? "څه ډول عکس جوړ کړم؟" : "له ادریس AI څخه وپوښتئ..."} aria-label="پیغام" rows={1} dir="rtl" /></div>
            <div className="composer-tools" dir="ltr">
              <Button variant="ghost" size="icon" onClick={() => setAttachmentsOpen(true)} aria-label="ضمیمه" title="ضمیمه"><Plus /></Button>
              <Button variant="ghost" size="icon" onClick={() => setImageMode((v) => !v)} aria-label="د عکس حالت" title="د عکس حالت"><SlidersHorizontal /></Button>
              <Button variant="ghost" size="icon" className="camera-tool" onClick={() => cameraRef.current?.click()} aria-label="کیمره" title="کیمره"><Camera /></Button>
              <Button variant="ghost" className="send-orb" onClick={() => send()} disabled={busy || (!input.trim() && !attachment)} aria-label="لېږل" title="لېږل">{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
            </div>
          </div>
        </div>
        {attachmentsOpen && <div className="attachment-overlay" onClick={() => setAttachmentsOpen(false)}>
          <section className="attachment-sheet" role="dialog" aria-modal="true" aria-label="ضمیمه ټاکل" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="sheet-close" onClick={() => setAttachmentsOpen(false)} aria-label="بندول"><X /></Button>
            <div className="sheet-handle" />
            <div className="attachment-options">
              <Button variant="ghost" onClick={() => { cameraRef.current?.click(); setAttachmentsOpen(false); }}><span><Camera /></span>کیمره</Button>
              <Button variant="ghost" onClick={() => { fileRef.current?.click(); setAttachmentsOpen(false); }}><span><ImagePlus /></span>ګالري</Button>
              <Button variant="ghost" onClick={() => { fileRef.current?.click(); setAttachmentsOpen(false); }}><span><Paperclip /></span>عکس فایل</Button>
            </div>
          </section>
        </div>}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickFile} />
      </main>
    </div>
  );
}
