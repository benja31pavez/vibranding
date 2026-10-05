import { createFileRoute } from "@tanstack/react-router";
import { MARKETING_META, MARKETING_ORG_SCRIPT } from "@/lib/marketingSeo";
import { LegalPage } from "@/components/LegalPage";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      ...MARKETING_META,
      { title: translations.es.seo.terms.title },
      { name: "description", content: translations.es.seo.terms.description },
      { property: "og:title", content: translations.es.seo.terms.title },
      { property: "og:description", content: translations.es.seo.terms.description },
      { property: "og:url", content: "https://vibranding.pro/terms" },
    ],
    scripts: [MARKETING_ORG_SCRIPT],
    links: [{ rel: "canonical", href: "https://vibranding.pro/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useLang();
  return <LegalPage content={t.terms} />;
}
