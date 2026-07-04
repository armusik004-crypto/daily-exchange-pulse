import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "ps" | "fa";

type Dict = Record<string, string>;

const en: Dict = {
  app_title: "Kandahar Market Rates",
  tagline: "Live and Accurate Market Rates of Kandahar",
  refresh: "Refresh",
  last_updated: "Last updated",
  no_data: "No rates loaded yet. Tap refresh to fetch the latest.",
  load_rates: "Load rates",
  buy: "Buy",
  sell: "Sell",
  view_chart: "View candlestick chart",
  charts: "Charts",
  home: "Home",
  quick_converter: "Quick Converter",
  from: "From",
  to: "To",
  trend_title: "Market Trend Signals",
  trend_disclaimer: "Statistical trend — not financial advice.",
  prob_up: "probability rate moves up",
  prob_down: "probability rate moves down",
  confidence: "confidence",
  low: "Low",
  medium: "Medium",
  high: "High",
  candlestick: "Candlestick",
  range_7d: "7 days",
  range_30d: "30 days",
  open: "Open",
  close: "Close",
  ohlc_high: "High",
  ohlc_low: "Low",
  ai_title: "Adris AI",
  ai_placeholder: "Ask about today's rates…",
  ai_greeting: "Salam! I'm Adris AI. Ask me anything about today's Kandahar market rates.",
  ai_send: "Send",
  language: "Language",
  footer: "Rates reflect the Kandahar local money-changers market. For information only.",
  pair_USD_AFN: "US Dollar → Afghani",
  pair_USD_PKR: "US Dollar → Pakistani Kaldar",
  pair_AFN_PKR: "Afghani → Pakistani Kaldar",
  back: "Back",
};

const ps: Dict = {
  app_title: "د کندهار د بازار نرخونه",
  tagline: "د کندهار د بازار ژوندي او دقیق نرخونه",
  refresh: "تازه کول",
  last_updated: "وروستی تازه‌والی",
  no_data: "لا هېڅ نرخ نه دی راوستی. د تازه کولو تڼۍ ووهئ.",
  load_rates: "نرخونه راوړه",
  buy: "اخیستل",
  sell: "پلورل",
  view_chart: "د شمعې چارټ وګورئ",
  charts: "چارټونه",
  home: "کور",
  quick_converter: "چټک بدلونګر",
  from: "له",
  to: "ته",
  trend_title: "د بازار د خوځښت نښې",
  trend_disclaimer: "احصایوي وړاندوینه — د مالي مشورې په توګه مه کاروئ.",
  prob_up: "احتمال چې نرخ پورته ځي",
  prob_down: "احتمال چې نرخ ښکته ځي",
  confidence: "باور",
  low: "ټیټ",
  medium: "منځنی",
  high: "لوړ",
  candlestick: "شمعې چارټ",
  range_7d: "۷ ورځې",
  range_30d: "۳۰ ورځې",
  open: "پرانیستل",
  close: "بندول",
  ohlc_high: "لوړ",
  ohlc_low: "ټیټ",
  ai_title: "ادریس AI",
  ai_placeholder: "د نن ورځې د نرخونو په اړه پوښتنه وکړئ…",
  ai_greeting: "سلام! زه ادریس AI یم. د کندهار د بازار د نرخونو په اړه له ما پوښتنه وکړئ.",
  ai_send: "لېږل",
  language: "ژبه",
  footer: "دا نرخونه د کندهار د صرافانو د محلي بازار انځوروي. یوازې د معلوماتو لپاره.",
  pair_USD_AFN: "امریکایي ډالر → افغانۍ",
  pair_USD_PKR: "امریکایي ډالر → پاکستانۍ کلداره",
  pair_AFN_PKR: "افغانۍ → پاکستانۍ کلداره",
  back: "بېرته",
};

const fa: Dict = {
  app_title: "نرخ‌های بازار قندهار",
  tagline: "نرخ‌های زنده و دقیق بازار قندهار",
  refresh: "تازه‌سازی",
  last_updated: "آخرین به‌روزرسانی",
  no_data: "هنوز نرخی بارگیری نشده. برای دریافت جدیدترین‌ها روی تازه‌سازی بزنید.",
  load_rates: "بارگذاری نرخ‌ها",
  buy: "خرید",
  sell: "فروش",
  view_chart: "نمایش نمودار شمعی",
  charts: "نمودارها",
  home: "خانه",
  quick_converter: "مبدل سریع",
  from: "از",
  to: "به",
  trend_title: "سیگنال‌های روند بازار",
  trend_disclaimer: "روند آماری — مشاورهٔ مالی نیست.",
  prob_up: "احتمال افزایش نرخ",
  prob_down: "احتمال کاهش نرخ",
  confidence: "اعتماد",
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  candlestick: "نمودار شمعی",
  range_7d: "۷ روز",
  range_30d: "۳۰ روز",
  open: "باز",
  close: "بسته",
  ohlc_high: "بالا",
  ohlc_low: "پایین",
  ai_title: "ادریس AI",
  ai_placeholder: "دربارهٔ نرخ‌های امروز بپرسید…",
  ai_greeting: "سلام! من ادریس AI هستم. هرچه دربارهٔ نرخ‌های بازار قندهار می‌خواهید بپرسید.",
  ai_send: "ارسال",
  language: "زبان",
  footer: "این نرخ‌ها بازار محلی صرافان قندهار را نشان می‌دهند. فقط برای اطلاع.",
  pair_USD_AFN: "دالر امریکایی → افغانی",
  pair_USD_PKR: "دالر امریکایی → کلدار پاکستانی",
  pair_AFN_PKR: "افغانی → کلدار پاکستانی",
  back: "بازگشت",
};

const DICTS: Record<Lang, Dict> = { en, ps, fa };

const LANG_META: Record<Lang, { label: string; dir: "ltr" | "rtl" }> = {
  en: { label: "English", dir: "ltr" },
  ps: { label: "پښتو", dir: "rtl" },
  fa: { label: "دري", dir: "rtl" },
};

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: keyof typeof en) => string;
  dir: "ltr" | "rtl";
  meta: typeof LANG_META;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem("km_lang") as Lang | null) : null;
    if (stored && DICTS[stored]) setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = LANG_META[lang].dir;
  }, [lang]);

  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        if (typeof window !== "undefined") localStorage.setItem("km_lang", l);
      },
      t: (k) => DICTS[lang][k] ?? DICTS.en[k] ?? String(k),
      dir: LANG_META[lang].dir,
      meta: LANG_META,
    }),
    [lang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
