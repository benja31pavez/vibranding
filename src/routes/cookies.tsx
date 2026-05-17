import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: translations.es.seo.cookies.title },
      { name: "description", content: translations.es.seo.cookies.description },
      { property: "og:title", content: translations.es.seo.cookies.title },
      { property: "og:description", content: translations.es.seo.cookies.description },
      { property: "og:url", content: "https://vibranding.pro/cookies" },
    ],
    links: [{ rel: "canonical", href: "https://vibranding.pro/cookies" }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  const { t } = useLang();
  return <LegalPage content={t.cookies} />;
}
