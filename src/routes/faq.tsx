import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: translations.es.seo.faq.title },
      { name: "description", content: translations.es.seo.faq.description },
      { property: "og:title", content: translations.es.seo.faq.title },
      { property: "og:description", content: translations.es.seo.faq.description },
      { property: "og:url", content: "https://vibranding.pro/faq" },
    ],
    links: [{ rel: "canonical", href: "https://vibranding.pro/faq" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: translations.es.faq.items.map((it) => ({
          "@type": "Question",
          name: it.q,
          acceptedAnswer: { "@type": "Answer", text: it.a },
        })),
      }),
    }],
  }),
  component: FAQPage,
});

function FAQPage() {
  const { t } = useLang();
  return (
    <LegalPage content={{ title: t.faq.title, updated: t.faq.updated, blocks: [] }}>
      <Accordion type="single" collapsible className="not-prose">
        {t.faq.items.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </LegalPage>
  );
}
