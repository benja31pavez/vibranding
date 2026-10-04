import { ExternalLink } from "lucide-react";
import { translations } from "@/i18n/translations";
import type { PortfolioClientWithWorks, PortfolioWork } from "@/lib/portfolio";
import { isPlaceholderName } from "@/lib/site";
import { SectionHeading } from "./shared";

/** Logos that need a bit more height to read at the same visual weight. */
const TALL_LOGOS = new Set(["Essence Emporium"]);

export function PortfolioSection({ portfolio }: { portfolio: PortfolioClientWithWorks[] }) {
  const copy = translations.es.home.portfolio;
  const clients = portfolio.filter((c) => !isPlaceholderName(c.name));

  // Data comes from the route loader (SSR). Nothing to show: no section at all.
  if (clients.length === 0) return null;

  return (
    <section
      id="clientes"
      aria-labelledby="clientes-title"
      className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24"
    >
      <SectionHeading
        id="clientes-title"
        title={copy.title}
        accent={copy.titleAccent}
        subtitle={copy.subtitle}
      />
      <LogoMarquee clients={clients} />
      <StaticLogoList clients={clients} />
      <div className="space-y-14">
        {clients
          .filter((c) => c.works.length > 0)
          .map((c) => (
            <ClientWorks key={c.id} client={c} />
          ))}
      </div>
    </section>
  );
}

function ClientLogo({ client: c }: { client: PortfolioClientWithWorks }) {
  if (!c.logo_url) {
    return <span className="text-base font-semibold tracking-tight md:text-lg">{c.name}</span>;
  }
  const tall = TALL_LOGOS.has(c.name);
  return (
    <img
      src={c.logo_url}
      alt={c.name}
      width={tall ? 180 : 160}
      height={tall ? 56 : 40}
      className={`${tall ? "h-12 md:h-14" : "h-8 md:h-10"} w-auto object-contain`}
      style={{ filter: "brightness(0)" }}
      loading="lazy"
      decoding="async"
    />
  );
}

/** Animated logo strip (pauses on hover). Hidden when the visitor prefers reduced motion. */
function LogoMarquee({ clients }: { clients: PortfolioClientWithWorks[] }) {
  return (
    <div className="relative mb-14 motion-reduce:hidden">
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <ul className="flex w-max items-center animate-marquee hover:[animation-play-state:paused]">
          {[...clients, ...clients].map((c, i) => (
            <li
              key={`${c.id}-${i}`}
              className="flex items-center"
              aria-hidden={i >= clients.length ? true : undefined}
            >
              <span className="flex items-center px-8 md:px-10 opacity-75" title={c.name}>
                <ClientLogo client={c} />
              </span>
              <span aria-hidden className="h-8 w-px bg-border/70" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Static, wrapped list of logos shown instead of the marquee with prefers-reduced-motion. */
function StaticLogoList({ clients }: { clients: PortfolioClientWithWorks[] }) {
  return (
    <ul className="mb-14 hidden flex-wrap items-center justify-center gap-x-10 gap-y-6 motion-reduce:flex">
      {clients.map((c) => (
        <li key={c.id} className="opacity-80" title={c.name}>
          <ClientLogo client={c} />
        </li>
      ))}
    </ul>
  );
}

function ClientWorks({ client: c }: { client: PortfolioClientWithWorks }) {
  return (
    <div id={`client-${c.id}`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {c.logo_url && (
            <img
              src={c.logo_url}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl bg-muted object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
          <div>
            <h3 className="text-xl font-semibold">{c.name}</h3>
            {(c.industry || c.description) && (
              <p className="text-sm text-muted-foreground">{c.industry || c.description}</p>
            )}
          </div>
        </div>
        {c.website_url && (
          <a
            href={c.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {c.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}{" "}
            <ExternalLink aria-hidden className="h-3 w-3" />
          </a>
        )}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {c.works.map((w) => (
          <li key={w.id}>
            <WorkCard work={w} clientName={c.name} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkCard({ work: w, clientName }: { work: PortfolioWork; clientName: string }) {
  const inner = (
    <div className="group relative overflow-hidden rounded-2xl border bg-card transition-shadow duration-300 hover:shadow-xl">
      {w.image_url ? (
        <div className="aspect-[4/5] overflow-hidden bg-muted">
          <img
            src={w.image_url}
            alt={w.title || clientName}
            width={800}
            height={1000}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="aspect-[4/5] bg-gradient-brand opacity-80" />
      )}
      {(w.title || w.description) && (
        <div className="p-4">
          {w.title && <div className="text-sm font-semibold">{w.title}</div>}
          {w.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{w.description}</p>
          )}
        </div>
      )}
    </div>
  );
  return w.link_url ? (
    <a href={w.link_url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    inner
  );
}
