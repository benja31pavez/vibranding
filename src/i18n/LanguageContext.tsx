import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Dict, type Lang } from "./translations";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
};

const LanguageContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "vibranding:lang";

/** BCP-47 tag for the <html lang> attribute. The site targets Chile only. */
export const HTML_LANG: Record<Lang, string> = { es: "es-CL", en: "en" };

/**
 * Spanish (Chile) is the default for everyone. We only switch when the visitor
 * made an explicit choice (?lang= or a previously saved selection) — never from
 * navigator.language, so the public site and its SSR HTML stay in Spanish.
 */
function detectInitial(): Lang {
  if (typeof window === "undefined") return "es";
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("lang");
    if (q === "en" || q === "es") return q;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back to Spanish.
  }
  return "es";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const initial = detectInitial();
    if (initial !== "es") setLangState(initial);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", HTML_LANG[lang]);
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // localStorage puede no estar disponible (modo privado); se ignora.
    }
  };

  const value = useMemo<Ctx>(() => ({ lang, setLang, t: translations[lang] }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Fallback for routes outside the provider — never throws.
    return { lang: "es", setLang: () => {}, t: translations.es };
  }
  return ctx;
}
