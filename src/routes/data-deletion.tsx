import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: translations.es.seo.dataDeletion.title },
      { name: "description", content: translations.es.seo.dataDeletion.description },
    ],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  const { t } = useLang();
  return <LegalPage content={t.dataDeletion} />;
}
