import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Preguntas Frecuentes — Viralitycs" },
      { name: "description", content: "Respuestas a las dudas más comunes sobre nuestros servicios de Instagram y Meta Ads." },
    ],
  }),
  component: FAQPage,
});

const faqs = [
  { q: "¿Qué incluye una propuesta de Viralitycs?",
    a: "Una auditoría de tu Instagram actual, una propuesta visual de feed, biografía y destacados, un plan de contenido y, si aplica, una estrategia de Meta Ads con creatividades y presupuesto sugerido." },
  { q: "¿Trabajan con marcas pequeñas?",
    a: "Sí. Adaptamos el alcance al tamaño de tu marca. Tenemos planes desde una sola campaña hasta gestión mensual completa." },
  { q: "¿Cuánto tarda en verse resultados?",
    a: "Los cambios visuales son inmediatos. El crecimiento orgánico se nota desde el primer mes y las campañas pagadas entregan datos en días." },
  { q: "¿Necesito entregarles acceso a mis cuentas?",
    a: "Para Meta Ads sí, mediante Business Manager. Para Instagram orgánico podemos trabajar con propuestas que tú apruebas y publicas, o gestionar la cuenta por ti." },
  { q: "¿Cómo se hace el pago?",
    a: "Trabajamos con un anticipo al iniciar y el saldo a la entrega o mensualmente según el plan. Aceptamos transferencia y pagos en USD o moneda local." },
  { q: "¿Firmamos un contrato?",
    a: "Sí, siempre. Incluye alcance, plazos, formas de pago y condiciones de cancelación." },
  { q: "¿Puedo cancelar en cualquier momento?",
    a: "Los planes mensuales se pueden cancelar con 30 días de aviso. Los proyectos puntuales son no reembolsables una vez iniciados." },
  { q: "¿Qué pasa si no me gusta una propuesta?",
    a: "Incluimos hasta dos rondas de cambios sin costo. Cambios mayores se cotizan aparte." },
];

function FAQPage() {
  return (
    <LegalPage title="Preguntas Frecuentes" updated="13 de mayo de 2026">
      <Accordion type="single" collapsible className="not-prose">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </LegalPage>
  );
}
