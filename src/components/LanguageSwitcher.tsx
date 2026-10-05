import { useLang } from "@/i18n/LanguageContext";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border bg-card/70 backdrop-blur px-1 py-1 text-xs ${className}`}
      role="group"
      aria-label={t.langSwitcher.label}
    >
      <button
        type="button"
        onClick={() => setLang("es")}
        aria-pressed={lang === "es"}
        className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
          lang === "es"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {t.langSwitcher.es}
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
          lang === "en"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {t.langSwitcher.en}
      </button>
    </div>
  );
}
