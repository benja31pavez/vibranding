import { createFileRoute } from "@tanstack/react-router";
import { MARKETING_META, MARKETING_ORG_SCRIPT } from "@/lib/marketingSeo";
import { LegalPage } from "@/components/LegalPage";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      ...MARKETING_META,
      { title: translations.es.seo.privacy.title },
      { name: "description", content: translations.es.seo.privacy.description },
      { property: "og:title", content: translations.es.seo.privacy.title },
      { property: "og:description", content: translations.es.seo.privacy.description },
      { property: "og:url", content: "https://vibranding.pro/privacy" },
    ],
    scripts: [MARKETING_ORG_SCRIPT],
    links: [{ rel: "canonical", href: "https://vibranding.pro/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useLang();
  return <LegalPage content={t.privacy} />;
}
