import { useId, useState } from "react";
import { HeartPulse, MessageCircle, PanelRightOpen, PhoneOff } from "lucide-react";
import { ErrorState, InfoHint } from "@/components/app";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientHealthCard, HEALTH_LOAD_ERROR, useClientHealth } from "@/components/clients/health";
import { whatsappHref } from "@/lib/followups/rules";
import { HEALTH_LEVEL_META, HEALTH_MAX_SCORE, type ClientHealth } from "@/lib/health";
import { cn } from "@/lib/utils";
import { useFichaAccount } from "./agencyQueries";
import { FichaSheet } from "./FichaSheet";
import type { FichaOverview } from "./fichaQueries";
import { SIGNAL_TITLE, suggestedMessage } from "./healthContact";
import { OnboardingLinkPanel } from "./OnboardingLinkPanel";
import { HEALTH_INFO } from "./StatusStrip";

const LEVEL_TEXT = {
  danger: "text-danger-strong",
  warning: "text-warning-strong",
  success: "text-success-strong",
  neutral: "text-muted-foreground",
} as const;
const SEVERITY_TEXT = { risk: "text-danger-strong", warning: "text-warning-strong" } as const;
/** Señales visibles en la tarjeta; el resto, en "Ver todas". */
const SIGNALS_INLINE = 2;
const RING_SIZE = 96;
const RING_STROKE = 9;

function ScoreRing({ score }: { score: number }) {
  const gradientId = useId();
  const r = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = Math.min(1, Math.max(0, score / HEALTH_MAX_SCORE));
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label={`Puntaje ${score} de ${HEALTH_MAX_SCORE}`}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--brand-1)" }} />
            <stop offset="55%" style={{ stopColor: "var(--brand-2)" }} />
            <stop offset="100%" style={{ stopColor: "var(--brand-3)" }} />
          </linearGradient>
        </defs>
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-surface-2"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <div className="relative text-center leading-none" aria-hidden>
        <div className="text-3xl font-semibold tabular-nums tracking-tight">{score}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">/{HEALTH_MAX_SCORE}</div>
      </div>
    </div>
  );
}

/** El motivo sin repetir el título ("Renovación próxima: la permanencia…" → "La permanencia…"). */
function signalDetail(title: string, label: string): string {
  if (!label.toLowerCase().startsWith(`${title.toLowerCase()}:`)) return label;
  const rest = label.slice(title.length).replace(/^[:\s]+/, "");
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : label;
}

function Signals({ health, onShowAll }: { health: ClientHealth; onShowAll: () => void }) {
  if (health.level === "sin_datos") {
    return (
      <p className="text-sm text-muted-foreground">
        Demasiados registros para calcularla con certeza.
      </p>
    );
  }
  if (health.reasons.length === 0) {
    return <p className="text-sm text-muted-foreground">Ninguna señal de riesgo.</p>;
  }
  const visible = health.reasons.slice(0, SIGNALS_INLINE);
  const hidden = health.reasons.length - visible.length;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">Señales que la bajan</h3>
      <ul className="flex flex-col gap-1.5">
        {visible.map((r) => (
          <li key={r.code} className="min-w-0 leading-tight">
            <p className={cn("text-sm font-semibold", SEVERITY_TEXT[r.severity])}>
              {SIGNAL_TITLE[r.code]}
            </p>
            <p className="truncate text-xs text-muted-foreground" title={r.label}>
              {signalDetail(SIGNAL_TITLE[r.code], r.label)}
            </p>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={onShowAll}
          className="self-start text-xs text-primary hover:underline"
        >
          +{hidden} señal{hidden === 1 ? "" : "es"} más
        </button>
      )}
    </div>
  );
}

function WhatsAppCta({
  clientId,
  overview,
  code,
}: {
  clientId: string;
  overview: FichaOverview | undefined;
  code: ClientHealth["reasons"][number]["code"] | null;
}) {
  const account = useFichaAccount(clientId);
  const [linkOpen, setLinkOpen] = useState(false);
  if (account.isLoading) return <Skeleton className="h-14 w-full rounded-app-md" />;

  const message = suggestedMessage(code, account.data?.contactName ?? null);
  const href = account.data?.phone ? whatsappHref(account.data.phone, message) : null;
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 items-center gap-3 rounded-app-md bg-accent px-4 py-2.5 text-accent-foreground shadow-app-xs transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCircle aria-hidden className="h-5 w-5 shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Contactar por WhatsApp</span>
          <span className="block truncate text-xs opacity-85" title={message}>
            Mensaje sugerido: {message}
          </span>
        </span>
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setLinkOpen(true)}
        disabled={!overview}
        className="flex min-w-0 items-center gap-3 rounded-app-md border border-dashed border-border px-4 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <PhoneOff aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Falta el teléfono de contacto</span>
          <span className="block truncate text-xs text-muted-foreground">
            Pídelo con el link de onboarding
          </span>
        </span>
      </button>
      {overview && (
        <FichaSheet open={linkOpen} onOpenChange={setLinkOpen} title="Link de onboarding">
          <OnboardingLinkPanel clientId={clientId} overview={overview} />
        </FichaSheet>
      )}
    </>
  );
}

/** "Salud del cliente" destacada: puntaje, nivel, señales y contacto directo por WhatsApp. */
export function HealthHero({
  clientId,
  overview,
}: {
  clientId: string;
  overview: FichaOverview | undefined;
}) {
  const query = useClientHealth(clientId);
  const [detailOpen, setDetailOpen] = useState(false);
  const { health } = query;

  if (query.isError) {
    return (
      <section aria-label="Salud del cliente" className={CARD_CLS}>
        <ErrorState
          title="No pudimos calcular la salud del cliente"
          message={HEALTH_LOAD_ERROR}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </section>
    );
  }

  const meta = health ? HEALTH_LEVEL_META[health.level] : null;
  const mainCode = health?.reasons[0]?.code ?? null;

  return (
    <section
      aria-label="Salud del cliente"
      className={cn(
        CARD_CLS,
        "grid h-full gap-4 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center",
      )}
    >
      {query.isPending ? (
        <Skeleton className="h-24 w-24 rounded-full" />
      ) : health ? (
        <ScoreRing score={health.score} />
      ) : (
        <div className="grid h-24 w-24 place-items-center rounded-full bg-surface-2">
          <HeartPulse aria-hidden className="h-7 w-7 text-muted-foreground" />
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold">Salud del cliente</h2>
          <InfoHint label="Información sobre Salud del cliente">{HEALTH_INFO}</InfoHint>
        </div>
        {query.isPending ? (
          <Skeleton className="h-5 w-40" />
        ) : meta && health ? (
          <>
            <p className={cn("text-lg font-semibold leading-tight", LEVEL_TEXT[meta.tone])}>
              {meta.label}
            </p>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {health.nextAction ?? "Todo en orden: sigue así."}
            </p>
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="inline-flex items-center gap-1 self-start text-xs text-primary hover:underline"
            >
              <PanelRightOpen aria-hidden className="h-3.5 w-3.5" /> Ver detalle
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No se calcula para prospectos ni clientes terminados.
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:col-span-2 lg:col-span-1">
        {query.isPending ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          health && <Signals health={health} onShowAll={() => setDetailOpen(true)} />
        )}
        <WhatsAppCta clientId={clientId} overview={overview} code={mainCode} />
      </div>

      <FichaSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Salud del cliente"
        info={HEALTH_INFO}
      >
        <ClientHealthCard clientId={clientId} />
      </FichaSheet>
    </section>
  );
}

const CARD_CLS =
  "min-w-0 rounded-app-lg border border-border-subtle bg-surface px-4 py-3.5 shadow-app-xs md:px-5";
