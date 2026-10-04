import type { ReactNode } from "react";
import { CalendarCheck, ExternalLink, Globe, Instagram, Megaphone, MessageCircle, PackageCheck } from "lucide-react";
import { StatCard, type StatDelta } from "@/components/app";
import { periodLabel } from "@/lib/billing/dates";
import { fmtInt, fmtMoney, fmtSignedPct, relativeChange } from "@/lib/reports/format";
import type { AdsBlock, Metric, MonthlyReportData } from "@/lib/reports/types";
import { DailyVisitsChart, LeadsBySourceChart } from "./ReportCharts";

const DELIVERABLE_LABEL: Record<string, string> = {
  post: "Publicaciones",
  reel: "Reels",
  story: "Historias",
  design: "Diseños",
  meeting: "Reuniones",
  report: "Informes",
  other: "Otros",
};

const MEDIA_LABEL: Record<string, string> = {
  IMAGE: "Foto",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Carrusel",
  REELS: "Reel",
};

/** Variación vs mes anterior para StatCard (undefined si no hay base). */
function deltaOf(m: Metric | null | undefined, invert = false): StatDelta | undefined {
  if (!m) return undefined;
  const r = relativeChange(m.value, m.previous);
  if (r == null) return undefined;
  const direction = Math.abs(r) < 0.005 ? "flat" : r > 0 ? "up" : "down";
  return { label: `${fmtSignedPct(r)} vs mes anterior`, direction, invert };
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Globe; children: ReactNode }) {
  return (
    <section className="space-y-3 break-inside-avoid">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Icon aria-hidden className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{children}</div>
);

interface AdsSectionProps {
  title: string;
  ads: AdsBlock;
  conversionLabel: string;
  costLabel: string;
}

function AdsSection({ title, ads, conversionLabel, costLabel }: AdsSectionProps) {
  const money = (n: number) => fmtMoney(n, ads.currency);
  return (
    <Section title={title} icon={Megaphone}>
      <Grid>
        <StatCard label="Inversión" value={money(ads.spend.value)} delta={deltaOf(ads.spend)} />
        <StatCard label={conversionLabel} value={fmtInt(ads.conversions.value)} delta={deltaOf(ads.conversions)} />
        {ads.cpa && (
          <StatCard
            label={costLabel}
            value={money(ads.cpa.value)}
            delta={deltaOf(ads.cpa, true)}
          />
        )}
        {ads.leads != null && <StatCard label="Contactos desde anuncios" value={fmtInt(ads.leads)} />}
        {ads.cpl != null && <StatCard label="Costo por contacto" value={money(ads.cpl)} />}
        <StatCard label="Veces que se mostraron" value={fmtInt(ads.impressions)} hint={`${fmtInt(ads.clicks)} clicks`} />
      </Grid>
    </Section>
  );
}

export interface ReportViewProps {
  clientName: string;
  period: string;
  data: MonthlyReportData;
  summary: string | null;
}

/** Reporte mensual para el dueño del negocio (página pública y vista previa). */
export function ReportView({ clientName, period, data, summary }: ReportViewProps) {
  const lines = (summary ?? data.auto_summary)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const ig = data.instagram;
  const hasAnyBlock = Boolean(
    ig || data.landing || data.leads || data.bookings || data.meta_ads || data.google_ads || data.deliverables,
  );

  return (
    <article className="space-y-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Reporte mensual · {periodLabel(period)}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{clientName}</h1>
      </header>

      {lines.length > 0 && (
        <section className="rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs break-inside-avoid">
          <h2 className="mb-3 text-base font-semibold">Lo más importante del mes</h2>
          <ul className="space-y-2 text-sm leading-relaxed text-foreground/90">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{l.replace(/^[•\-–]\s*/, "")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.landing && (
        <Section title="Tu sitio web" icon={Globe}>
          <Grid>
            <StatCard label="Visitas" value={fmtInt(data.landing.visits.value)} delta={deltaOf(data.landing.visits)} />
            <StatCard
              label="Clicks para contactarte"
              value={fmtInt(data.landing.contacts.value)}
              delta={deltaOf(data.landing.contacts)}
              hint={`${fmtInt(data.landing.whatsapp_clicks)} a WhatsApp`}
            />
            {data.landing.form_submits > 0 && (
              <StatCard label="Formularios enviados" value={fmtInt(data.landing.form_submits)} />
            )}
          </Grid>
          {data.landing.visits.value > 0 && <DailyVisitsChart data={data.landing.daily_visits} />}
        </Section>
      )}

      {data.leads && (
        <Section title="Personas interesadas" icon={MessageCircle}>
          <Grid>
            <StatCard label="Contactos nuevos" value={fmtInt(data.leads.total.value)} delta={deltaOf(data.leads.total)} />
            {data.bookings && (
              <StatCard label="Reservas" value={fmtInt(data.bookings.total.value)} delta={deltaOf(data.bookings.total)} />
            )}
          </Grid>
          {data.leads.by_source.length > 0 && <LeadsBySourceChart data={data.leads.by_source} />}
        </Section>
      )}

      {!data.leads && data.bookings && (
        <Section title="Reservas" icon={CalendarCheck}>
          <Grid>
            <StatCard label="Reservas" value={fmtInt(data.bookings.total.value)} delta={deltaOf(data.bookings.total)} />
          </Grid>
        </Section>
      )}

      {ig && (
        <Section title="Instagram" icon={Instagram}>
          <Grid>
            {ig.followers && (
              <StatCard
                label="Seguidores"
                value={fmtInt(ig.followers.value)}
                hint={
                  ig.followers.net_change != null
                    ? `${ig.followers.net_change >= 0 ? "+" : "−"}${fmtInt(Math.abs(ig.followers.net_change))} este mes`
                    : undefined
                }
              />
            )}
            {ig.post_views && (
              <StatCard label="Visualizaciones" value={fmtInt(ig.post_views.value)} delta={deltaOf(ig.post_views)} />
            )}
            {ig.interactions && (
              <StatCard label="Interacciones" value={fmtInt(ig.interactions.value)} delta={deltaOf(ig.interactions)} />
            )}
          </Grid>
          {ig.top_posts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Tus publicaciones que mejor funcionaron</h3>
              <ol className="divide-y divide-border-subtle rounded-app-lg border border-border-subtle bg-surface">
                {ig.top_posts.map((p, i) => (
                  <li key={p.post_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="font-semibold tabular-nums text-primary">{i + 1}</span>
                      <span className="truncate">{MEDIA_LABEL[p.media_type ?? ""] ?? "Publicación"}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
                      <span>{fmtInt(p.views)} vistas</span>
                      <span>{fmtInt(p.interactions)} interacciones</span>
                      {p.permalink && (
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary print:hidden"
                          aria-label={`Ver publicación ${i + 1} en Instagram`}
                        >
                          <ExternalLink aria-hidden className="h-4 w-4" />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Section>
      )}

      {data.meta_ads && (
        <AdsSection title="Anuncios en Facebook e Instagram" ads={data.meta_ads} conversionLabel="Conversaciones" costLabel="Costo por conversación" />
      )}
      {data.google_ads && (
        <AdsSection title="Anuncios en Google" ads={data.google_ads} conversionLabel="Conversiones" costLabel="Costo por conversión" />
      )}

      {data.deliverables && (
        <Section title="Trabajo realizado" icon={PackageCheck}>
          <p className="text-sm text-muted-foreground">
            Este mes completamos {fmtInt(data.deliverables.completed)}{" "}
            {data.deliverables.completed === 1 ? "entregable" : "entregables"} para tu marca.
          </p>
          <ul className="flex flex-wrap gap-2">
            {data.deliverables.by_type.map((d) => (
              <li key={d.type} className="rounded-app-md border border-border-subtle bg-surface px-3 py-1.5 text-sm tabular-nums">
                {DELIVERABLE_LABEL[d.type] ?? "Otros"}: {fmtInt(d.count)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!hasAnyBlock && (
        <p className="text-sm text-muted-foreground">Este mes todavía no hay datos medidos para mostrar.</p>
      )}
    </article>
  );
}
