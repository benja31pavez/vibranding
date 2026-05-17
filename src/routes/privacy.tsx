import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: translations.es.seo.privacy.title },
      { name: "description", content: translations.es.seo.privacy.description },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useLang();
  return <LegalPage content={t.privacy} />;
}
