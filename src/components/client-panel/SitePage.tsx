import { useState, type ComponentType, type ReactNode } from "react";
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  Globe,
  Link2,
  Mail,
  MessageCircle,
  MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, FitPage, PageHeader, Panel } from "@/components/app";
import { PublicLandingView } from "@/components/landing/PublicLandingView";
import { PublicMultilinkView } from "@/components/multilink/PublicMultilinkView";
import { DevicePreview, type PreviewMode } from "@/components/site/DevicePreview";
import { copyPublicLink } from "@/components/site/copyLink";
import { downloadQrPng } from "@/components/site/qr";
import { cn } from "@/lib/utils";
import { OneLineState } from "./OneLineState";
import { displayUrl, qrFileBase, type SiteMetrics, type PublishedSitePage } from "./siteModel";
import { useClientSite, usePublicLanding, usePublicMultilink } from "./useClientSite";

type SiteKind = "multilink" | "landing";

const KINDS: readonly {
  key: SiteKind;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { key: "multilink", label: "Multienlace", icon: Link2 },
  { key: "landing", label: "Landing page", icon: Globe },
];

const NOT_PUBLISHED: Record<SiteKind, string> = {
  multilink: "Tu multienlace aún no está publicado.",
  landing: "Tu landing page aún no está publicada.",
};

/**
 * Sitio del cliente: solo ver (D5). Vista previa grande del multienlace y la
 * landing tal como se publican, link público, QR y visitas/clics agregados.
 */
export function SitePage() {
  const site = useClientSite();
  const [picked, setPicked] = useState<SiteKind | null>(null);
  const [mode, setMode] = useState<PreviewMode>("mobile");

  const summary = site.data;
  const fallback: SiteKind =
    summary?.multilink?.published || !summary?.landing?.published ? "multilink" : "landing";
  const kind = picked ?? fallback;
  const page = kind === "multilink" ? summary?.multilink : summary?.landing;
  const metrics = kind === "multilink" ? summary?.multilinkMetrics : summary?.landingMetrics;

  const switcher = (
    <div
      role="group"
      aria-label="Página del sitio"
      className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
    >
      {KINDS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-pressed={kind === key}
          onClick={() => setPicked(key)}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            kind === key
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );

  let body: ReactNode;
  if (site.isError) {
    body = (
      <ErrorState
        title="No pudimos cargar tu sitio."
        onRetry={() => void site.refetch()}
        retrying={site.isFetching}
      />
    );
  } else if (site.isPending) {
    body = <Skeleton className="h-[60vh] w-full rounded-app-lg md:h-full" />;
  } else if (!page?.published) {
    body = <OneLineState icon={kind === "multilink" ? Link2 : Globe} text={NOT_PUBLISHED[kind]} />;
  } else {
    body = (
      <div className="grid gap-6 md:h-full md:min-h-0 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 md:h-full md:min-h-0">
          <Preview kind={kind} page={page} mode={mode} onModeChange={setMode} />
        </div>
        <aside className="flex flex-col gap-4 md:min-h-0 md:overflow-y-auto">
          <LinkPanel kind={kind} page={page} />
          {metrics && <MetricsPanel kind={kind} metrics={metrics} days={summary?.days ?? 30} />}
        </aside>
      </div>
    );
  }

  return (
    <FitPage header={<PageHeader size="compact" title="Sitio" actions={switcher} />}>
      <div className="md:h-full md:min-h-0">{body}</div>
    </FitPage>
  );
}

function Preview({
  kind,
  page,
  mode,
  onModeChange,
}: {
  kind: SiteKind;
  page: PublishedSitePage;
  mode: PreviewMode;
  onModeChange: (m: PreviewMode) => void;
}) {
  const multilink = usePublicMultilink(kind === "multilink" ? page.slug : null);
  const landing = usePublicLanding(kind === "landing" ? page.slug : null);
  const query = kind === "multilink" ? multilink : landing;

  if (query.isError) {
    return (
      <ErrorState
        title="No pudimos cargar la vista previa."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (query.isPending) return <Skeleton className="h-[60vh] w-full rounded-app-lg md:h-full" />;

  let content: ReactNode = null;
  if (kind === "multilink" && multilink.data) {
    content = <PublicMultilinkView ml={multilink.data.ml} items={multilink.data.items} preview />;
  } else if (kind === "landing" && landing.data) {
    content = <PublicLandingView lp={landing.data.lp} preview />;
  }
  if (!content) return <OneLineState icon={Globe} text={NOT_PUBLISHED[kind]} />;

  return (
    <DevicePreview
      mode={mode}
      onModeChange={onModeChange}
      label={kind === "multilink" ? "Vista previa del multienlace" : "Vista previa de la landing"}
    >
      {content}
    </DevicePreview>
  );
}

function LinkPanel({ kind, page }: { kind: SiteKind; page: PublishedSitePage }) {
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      await downloadQrPng(page.url, qrFileBase(page.slug, kind));
    } catch (e) {
      console.error("[client-panel] QR", e);
      toast.error("No se pudo generar el QR. Inténtalo de nuevo.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Panel title="Link público" icon={Link2}>
      <a
        href={page.url}
        target="_blank"
        rel="noopener noreferrer"
        title={page.url}
        className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {displayUrl(page.url)}
      </a>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => void copyPublicLink(page.url)}>
          <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" /> Copiar
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={page.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden="true" /> Abrir
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="col-span-2"
          onClick={() => void download()}
          disabled={downloading}
        >
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {downloading ? "Generando QR…" : "Descargar QR"}
        </Button>
      </div>
    </Panel>
  );
}

function MetricsPanel({
  kind,
  metrics,
  days,
}: {
  kind: SiteKind;
  metrics: SiteMetrics;
  days: number;
}) {
  const rows = [
    { key: "views", label: "Visitas", value: metrics.views, icon: Eye },
    { key: "clicks", label: "Clics", value: metrics.clicks, icon: MousePointerClick },
    kind === "multilink"
      ? { key: "extra", label: "Clics a WhatsApp", value: metrics.extra, icon: MessageCircle }
      : { key: "extra", label: "Mensajes de contacto", value: metrics.extra, icon: Mail },
  ];
  return (
    <Panel title={`Últimos ${days} días`} icon={Eye}>
      <dl className="divide-y divide-border-subtle">
        {rows.map(({ key, label, value, icon: Icon }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {new Intl.NumberFormat("es-CL").format(value)}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
