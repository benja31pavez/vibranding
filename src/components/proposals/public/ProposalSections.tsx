import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { CalendarClock, Check, MessageCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/pricing/plans";
import { formatChileDate, type ProposalTotals } from "@/lib/proposals/model";
import { whatsappUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { PROCESS_STEPS, TIMELINE_NOTE, type FaqItem, type WeekStep } from "./proposalContent";

export const ACCEPT_ANCHOR = "aceptar";
const DAY_MS = 86_400_000;

export function Card({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      className="scroll-mt-6 rounded-app-lg outline-none focus-visible:ring-2 focus-visible:ring-ring border border-border-subtle bg-surface p-5 shadow-app-xs sm:p-6"
    >
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export interface PriceSummary {
  /** Precio principal (nunca negativo). */
  main: string;
  /** Pago único extra o descuento, si aplica. */
  detail: string | null;
  /** "Primer pago: $X" cuando hay mensualidad y pago único. */
  firstCharge: string | null;
}

/**
 * Resumen de precio para el hero y la barra móvil. Solo CLP (`formatMoney`).
 * Pago único extra solo si es > 0; si es negativo se muestra como descuento.
 */
export function priceSummary(totals: ProposalTotals): PriceSummary | null {
  const monthly = Math.max(0, totals.monthly);
  if (monthly > 0) {
    const detail =
      totals.oneTime > 0
        ? `+ ${formatMoney(totals.oneTime)} pago único`
        : totals.oneTime < 0
          ? `− ${formatMoney(-totals.oneTime)} descuento`
          : null;
    const firstCharge =
      totals.oneTime > 0 ? `Primer pago: ${formatMoney(Math.max(0, totals.firstCharge))}` : null;
    return { main: `${formatMoney(monthly)}/mes`, detail, firstCharge };
  }
  const oneTime = Math.max(0, totals.oneTime);
  if (oneTime === 0) return null;
  return { main: formatMoney(oneTime), detail: "pago único", firstCharge: null };
}

/** Lleva al formulario de aceptación con scroll suave y le pasa el foco. */
export function goToAccept(event: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById(ACCEPT_ANCHOR);
  if (!target) return;
  event.preventDefault();
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
  history.replaceState(null, "", `#${ACCEPT_ANCHOR}`);
}

export function contactUrl(title: string | null): string {
  const about = title ? ` "${title}"` : "";
  return whatsappUrl(`Hola Benja, estoy revisando la propuesta${about} y tengo una consulta: `);
}

/** Días que quedan (calculado en el cliente para no desalinear el SSR). */
function useDaysLeft(expiresAt: string | null): number | null {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const ms = new Date(expiresAt).getTime() - Date.now();
    setDays(Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / DAY_MS) : null);
  }, [expiresAt]);
  return days;
}

export function ValidityNote({ expiresAt }: { expiresAt: string | null }) {
  const days = useDaysLeft(expiresAt);
  if (!expiresAt) return null;
  const left = days === null ? "" : days === 1 ? " · queda 1 día" : ` · quedan ${days} días`;
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <CalendarClock aria-hidden className="h-4 w-4 shrink-0" />
      <span>
        Válida hasta el{" "}
        <span className="font-medium text-foreground">{formatChileDate(expiresAt)}</span>
        {left}
      </span>
    </p>
  );
}

interface HeroProps {
  recipientName: string | null;
  title: string | null;
  planLabel: string | null;
  outcome: string;
  totals: ProposalTotals;
  expiresAt: string | null;
  open: boolean;
}

export function ProposalHero({
  recipientName,
  title,
  planLabel,
  outcome,
  totals,
  expiresAt,
  open,
}: HeroProps) {
  const price = priceSummary(totals);
  return (
    <section className="space-y-5 rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs sm:p-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Propuesta para{" "}
          <span className="font-medium text-foreground">{recipientName ?? "ti"}</span>
          {planLabel && <> · {planLabel}</>}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
          {title ?? "Propuesta Vibranding"}
        </h1>
        <p className="text-base text-muted-foreground text-pretty">{outcome}</p>
      </div>

      {price && (
        <div className="rounded-app-md bg-surface-2 p-4">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              {price.main}
            </span>
            {price.detail && (
              <span className="text-sm text-muted-foreground tabular-nums">{price.detail}</span>
            )}
          </p>
          {price.firstCharge && (
            <p className="mt-1 text-sm font-medium text-foreground tabular-nums">
              {price.firstCharge}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Pesos chilenos (CLP) · IVA incluido</p>
        </div>
      )}

      <ValidityNote expiresAt={expiresAt} />

      {open && (
        <div className="hidden gap-3 sm:flex">
          <Button asChild size="lg">
            <a href={`#${ACCEPT_ANCHOR}`} onClick={goToAccept}>
              Aceptar propuesta
            </a>
          </Button>
          <ContactButton title={title} variant="outline" />
        </div>
      )}
    </section>
  );
}

export function ContactButton({
  title,
  variant = "outline",
  className,
}: {
  title: string | null;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  return (
    <Button asChild size="lg" variant={variant} className={className}>
      <a href={contactUrl(title)} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden className="mr-2 h-4 w-4" />
        Hablar con Benja
      </a>
    </Button>
  );
}

export function FeatureList({ features }: { features: readonly string[] }) {
  if (features.length === 0) return null;
  return (
    <ul className="mb-5 grid gap-2.5 sm:grid-cols-2">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm text-foreground">
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

export function Timeline({ steps }: { steps: readonly WeekStep[] }) {
  return (
    <>
      <ol className="space-y-5 border-l border-border-subtle pl-5">
        {steps.map((s) => (
          <li key={s.week} className="relative">
            <span
              aria-hidden
              className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary"
            />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.week}
            </p>
            <p className="font-medium text-foreground">{s.title}</p>
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs text-muted-foreground">{TIMELINE_NOTE}</p>
    </>
  );
}

export function ProcessSteps() {
  return (
    <ol className="grid gap-4 sm:grid-cols-2">
      {PROCESS_STEPS.map((s, idx) => (
        <li key={s.title} className="flex gap-3">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums"
          >
            {idx + 1}
          </span>
          <div>
            <p className="font-medium text-foreground">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Faq({ items }: { items: readonly FaqItem[] }) {
  return (
    <Accordion type="single" collapsible className="-mt-2">
      {items.map((f) => (
        <AccordionItem key={f.q} value={f.q} className="border-border-subtle">
          <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function ContactCard({ title }: { title: string | null }) {
  return (
    <section className="flex flex-col gap-4 rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">¿Tienes dudas antes de aceptar?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escríbele directo por WhatsApp a Benjamín Pavez, fundador de Vibranding.
        </p>
      </div>
      <ContactButton title={title} className="shrink-0" />
    </section>
  );
}

/** Barra fija inferior (solo móvil) con el precio y el botón de aceptar. Se oculta al llegar al formulario. */
export function StickyAcceptBar({ totals }: { totals: ProposalTotals }) {
  const [formVisible, setFormVisible] = useState(false);
  useEffect(() => {
    const target = document.getElementById(ACCEPT_ANCHOR);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), {
      threshold: 0.15,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const price = priceSummary(totals);
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-app-lg backdrop-blur transition-transform sm:hidden",
        formVisible && "invisible translate-y-full",
      )}
      inert={formVisible}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {price ? (
            <>
              <p className="truncate text-base font-semibold tabular-nums text-foreground">
                {price.main}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {price.detail ?? "IVA incluido"}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-foreground">¿Todo claro?</p>
          )}
        </div>
        <Button asChild size="lg" className="shrink-0">
          <a href={`#${ACCEPT_ANCHOR}`} onClick={goToAccept}>
            Aceptar propuesta
          </a>
        </Button>
      </div>
    </div>
  );
}
