import type { ComponentType } from "react";
import { ExternalLink, Globe, LayoutTemplate, Palette } from "lucide-react";
import { ErrorState, ListSkeleton } from "@/components/app";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { safeExternalHref } from "@/lib/onboarding/links";
import { FichaCard } from "../FichaCard";
import { useClientIntake } from "../OnboardingIntakePanel";
import { useClientLanding } from "./clientFichaQueries";
import { paintableColor } from "./clientView";

interface BrandLink {
  key: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

function webLink(links: unknown): string | null {
  if (!links || typeof links !== "object" || Array.isArray(links)) return null;
  const web = (links as Record<string, unknown>).web;
  return typeof web === "string" ? safeExternalHref("web", web) : null;
}

function Label({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

/** "Tu marca": logo, paleta y links públicos (landing y sitio web). */
export function BrandPanel({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const { client, ig } = useActiveClient();
  const intake = useClientIntake(clientId, canEdit);
  const landing = useClientLanding(clientId);
  const logo = ig.profile?.current_avatar_url ?? null;
  const name = client?.name ?? "";

  const colors = [
    ...new Set([
      ...(intake.data?.colores ?? []),
      ...(landing.data?.themeColor ? [landing.data.themeColor] : []),
    ]),
  ];
  const style = intake.data?.estilo?.trim() || null;
  const site = webLink(intake.data?.links_redes);
  const links: BrandLink[] = [
    ...(landing.data?.published
      ? [
          {
            key: "landing",
            icon: LayoutTemplate,
            label: "Landing",
            href: `/@${encodeURIComponent(landing.data.slug)}`,
          },
        ]
      : []),
    ...(site ? [{ key: "web", icon: Globe, label: "Sitio web", href: site }] : []),
  ];
  const loading = intake.isLoading || landing.isLoading;
  const error = intake.error ?? landing.error;

  return (
    <FichaCard title="Tu marca" icon={Palette} fill>
      {loading ? (
        <ListSkeleton rows={3} label="Cargando marca" />
      ) : error ? (
        <ErrorState
          message={error.message}
          onRetry={() => {
            void intake.refetch();
            void landing.refetch();
          }}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-3 md:min-h-0 md:overflow-hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-app-md border border-border-subtle bg-surface-2 text-xl font-semibold">
              {logo ? (
                <img src={logo} alt={`Logo de ${name}`} className="h-full w-full object-cover" />
              ) : (
                name[0]?.toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground" title={style ?? undefined}>
                {style ?? (logo ? "Logo desde Instagram" : "Sin logo cargado")}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Paleta</Label>
            {colors.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {colors.map((c) => {
                  const paint = paintableColor(c);
                  return (
                    <li
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-2 py-0.5 text-xs"
                      title={c}
                    >
                      {paint && (
                        <span
                          aria-hidden
                          className="h-3.5 w-3.5 rounded-full border border-border-subtle"
                          style={{ background: paint }}
                        />
                      )}
                      <span className="max-w-24 truncate">{c}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin colores definidos</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>En línea</Label>
            {links.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {links.map((l) => (
                  <li key={l.key}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <l.icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{l.label}</span>
                      <ExternalLink aria-hidden className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aún sin links publicados</p>
            )}
          </div>
        </div>
      )}
    </FichaCard>
  );
}
