import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: translations.es.seo.dataDeletion.title },
      { name: "description", content: translations.es.seo.dataDeletion.description },
      { property: "og:title", content: translations.es.seo.dataDeletion.title },
      { property: "og:description", content: translations.es.seo.dataDeletion.description },
      { property: "og:url", content: "https://vibranding.pro/data-deletion" },
    ],
    links: [{ rel: "canonical", href: "https://vibranding.pro/data-deletion" }],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  const { t } = useLang();
  return <LegalPage content={t.dataDeletion} />;
}
