import { Link } from "@tanstack/react-router";
import { CalendarClock, Instagram, Megaphone, Radio } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/app";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { FichaCard } from "./FichaCard";

const nf = new Intl.NumberFormat("es-CL");

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Próxima publicación": la pieza programada más cercana del calendario de Instagram. */
export function NextPublicationPanel({ clientId }: { clientId: string }) {
  const { ig } = useActiveClient();
  const now = Date.now();
  const upcoming = ig.posts
    .filter(
      (p) =>
        !(p as { archived_at?: string | null }).archived_at &&
        p.scheduled_at &&
        !p.published_at &&
        new Date(p.scheduled_at).getTime() >= now,
    )
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  const next = upcoming[0];
  const month = new Date().toLocaleDateString("es-CL", { month: "long" });

  return (
    <FichaCard title="Próxima publicación" icon={CalendarClock} fill>
      {next ? (
        <div className="flex h-full flex-col gap-3">
          <div className="flex gap-3">
            {next.image_url ? (
              <img
                src={next.image_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-app-md object-cover"
              />
            ) : (
              <div className="h-16 w-16 shrink-0 rounded-app-md bg-brand-soft" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold">{fmtWhen(next.scheduled_at!)}</p>
              <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">
                {next.caption?.trim() || "Sin texto todavía"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {upcoming.length === 1
              ? "Es la única programada."
              : `${upcoming.length} publicaciones programadas.`}{" "}
            <Link
              to="/clients/$clientId/calendario"
              params={{ clientId }}
              className="font-medium text-[color:var(--brand-1)] hover:underline"
            >
              Ver calendario
            </Link>
          </p>
        </div>
      ) : (
        <EmptyState
          size="compact"
          icon={CalendarClock}
          title={`Nada programado para ${month}`}
          action={
            <Link
              to="/clients/$clientId/plan"
              params={{ clientId }}
              className="text-sm font-medium text-[color:var(--brand-1)] hover:underline"
            >
              Planificar el mes
            </Link>
          }
        />
      )}
    </FichaCard>
  );
}

/** "Redes y campañas": seguidores de Instagram y estado de las conexiones de pauta. */
export function SocialAndAdsPanel({ clientId }: { clientId: string }) {
  const { ig } = useActiveClient();
  const { caps, loading } = useClientCapabilities(clientId);
  const followers = ig.profile?.current_followers ?? null;
  const handle = ig.profile?.current_username;

  return (
    <FichaCard title="Redes y campañas" icon={Radio} fill>
      <div className="flex flex-col gap-2.5">
        <div className="rounded-app-md bg-[#FCE7F3] px-3.5 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9D174D]">
            <Instagram aria-hidden className="h-3.5 w-3.5" /> Instagram
            {handle ? ` · @${handle}` : ""}
          </p>
          <p className="text-2xl font-extrabold tracking-tight text-[#BE185D]">
            {followers !== null ? nf.format(followers) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {followers !== null ? "seguidores" : "sin datos de seguidores todavía"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Tile
            label="Meta Ads"
            bg="#E0ECFF"
            fg="#1E40AF"
            loading={loading}
            ok={caps.meta_connected && caps.has_ad_account}
            okLabel="Conectado"
            koLabel="Sin cuenta"
            to="/clients/$clientId/meta-ads"
            clientId={clientId}
          />
          <Tile
            label="WhatsApp"
            bg="#DCFCE7"
            fg="#166534"
            loading={loading}
            ok={caps.has_whatsapp}
            okLabel="Conectado"
            koLabel="Sin conectar"
            to="/clients/$clientId/bandeja"
            clientId={clientId}
          />
        </div>
      </div>
    </FichaCard>
  );
}

function Tile({
  label,
  bg,
  fg,
  loading,
  ok,
  okLabel,
  koLabel,
  to,
  clientId,
}: {
  label: string;
  bg: string;
  fg: string;
  loading: boolean;
  ok: boolean;
  okLabel: string;
  koLabel: string;
  to: string;
  clientId: string;
}) {
  return (
    <Link
      to={to}
      params={{ clientId }}
      className="rounded-app-md px-3 py-2.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ backgroundColor: bg }}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: fg }}>
        <Megaphone aria-hidden className="h-3.5 w-3.5" /> {label}
      </p>
      <div className="mt-1">
        {loading ? (
          <span className="text-xs text-muted-foreground">Revisando…</span>
        ) : (
          <StatusBadge
            status={ok ? "ok" : "ko"}
            label={ok ? okLabel : koLabel}
            tone={ok ? "success" : "neutral"}
          />
        )}
      </div>
    </Link>
  );
}
