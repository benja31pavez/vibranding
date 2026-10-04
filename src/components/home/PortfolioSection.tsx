import { ExternalLink } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { usePublicPortfolio, type PortfolioClientWithWorks, type PortfolioWork } from "@/lib/portfolio";
import { isPlaceholderName } from "@/lib/site";
import { SectionHeading } from "./shared";

/** Logos that need a bit more height to read at the same visual weight. */
const TALL_LOGOS = new Set(["Essence Emporium"]);

export function PortfolioSection() {
  const { t } = useLang();
  const copy = t.home.portfolio;
  const { data, loading } = usePublicPortfolio();
  const clients = data.filter((c) => !isPlaceholderName(c.name));

  // Nothing to show once loaded: hide the section rather than show an empty state.
  if (!loading && clients.length === 0) return null;

  return (
    <section id="clientes" aria-labelledby="clientes-title" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24">
      <SectionHeading id="clientes-title" title={copy.title} accent={copy.titleAccent} subtitle={copy.subtitle} />
      {loading ? (
        <div aria-hidden className="h-16 animate-pulse rounded-2xl bg-secondary" />
      ) : (
        <>
          <LogoMarquee clients={clients} />
          <div className="space-y-14">
            {clients
              .filter((c) => c.works.length > 0)
              .map((c) => (
                <ClientWorks key={c.id} client={c} />
              ))}
          </div>
        </>
      )}
    </section>
  );
}

function LogoMarquee({ clients }: { clients: PortfolioClientWithWorks[] }) {
  return (
    <div className="relative mb-14 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <ul className="flex w-max items-center animate-marquee hover:[animation-play-state:paused]">
        {[...clients, ...clients].map((c, i) => (
          <li key={`${c.id}-${i}`} className="flex items-center" aria-hidden={i >= clients.length ? true : undefined}>
            <span className="flex items-center px-8 md:px-10 opacity-75" title={c.name}>
              {c.logo_url ? (
                <img
                  src={c.logo_url}
                  alt={c.name}
                  className={`${TALL_LOGOS.has(c.name) ? "h-12 md:h-14" : "h-8 md:h-10"} w-auto object-contain`}
                  style={{ filter: "brightness(0)" }}
                  loading="lazy"
                />
              ) : (
                <span className="text-base font-semibold tracking-tight md:text-lg">{c.name}</span>
              )}
            </span>
            <span aria-hidden className="h-8 w-px bg-border/70" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClientWorks({ client: c }: { client: PortfolioClientWithWorks }) {
  return (
    <div id={`client-${c.id}`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {c.logo_url && (
            <img src={c.logo_url} alt="" className="h-9 w-9 rounded-xl bg-muted object-cover" loading="lazy" />
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
            {c.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink aria-hidden className="h-3 w-3" />
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
          {w.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{w.description}</p>}
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
