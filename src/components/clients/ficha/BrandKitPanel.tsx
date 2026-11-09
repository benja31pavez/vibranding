import { Link } from "@tanstack/react-router";
import { FolderOpen, Instagram, Palette, Type } from "lucide-react";
import { EmptyState } from "@/components/app";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useClientSiteData } from "@/components/site/useClientSiteData";
import { FichaCard } from "./FichaCard";

/**
 * "Kit de marca": lo que ya sabemos de la identidad del cliente (logo, colores que dejó en
 * el onboarding, perfil de Instagram y descripción) y el acceso a la carpeta de archivos.
 * No es un editor: los colores se editan en el onboarding y el logo en Sitio.
 */
export function BrandKitPanel({ clientId }: { clientId: string }) {
  const { client, ig } = useActiveClient();
  const site = useClientSiteData(clientId);
  const colors = site.brandColors;
  const avatar = ig.profile?.current_avatar_url ?? null;
  const hasAnything = Boolean(site.logoUrl || colors.length || avatar || site.description);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-3">
      <FichaCard title="Logotipo" icon={Palette}>
        {site.logoUrl ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid aspect-[4/3] place-items-center rounded-app-md border bg-white p-3">
              <img
                src={site.logoUrl}
                alt={`Logo de ${client?.name ?? "cliente"}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="grid aspect-[4/3] place-items-center rounded-app-md bg-[#141632] p-3">
              <img
                src={site.logoUrl}
                alt=""
                aria-hidden
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        ) : (
          <EmptyState
            size="compact"
            icon={Palette}
            title="Sin logo cargado"
            description="Se sube desde Sitio › Editor de la landing o lo envía el cliente por el link de onboarding."
          />
        )}
      </FichaCard>

      <FichaCard title="Paleta" icon={Palette}>
        {colors.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {colors.map((c) => (
              <li key={c} className="flex flex-col gap-1">
                <span
                  className="h-14 rounded-app-md border"
                  style={{ backgroundColor: c }}
                  aria-hidden
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {c.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            size="compact"
            icon={Palette}
            title="Sin colores definidos"
            description="El cliente los indica en el onboarding; también puedes agregarlos ahí."
          />
        )}
      </FichaCard>

      <FichaCard title="Perfil y voz" icon={Type}>
        <div className="flex items-start gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft">
              <Instagram aria-hidden className="h-5 w-5 text-[color:var(--brand-1)]" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {ig.profile?.current_display_name ?? client?.name ?? "Cliente"}
            </p>
            {ig.profile?.current_username && (
              <p className="text-xs text-muted-foreground">@{ig.profile.current_username}</p>
            )}
            <p className="mt-2 line-clamp-5 text-sm text-muted-foreground">
              {site.description ??
                "Sin descripción del negocio. Se completa en Configuración › Sobre la empresa."}
            </p>
          </div>
        </div>
      </FichaCard>

      <div className="md:col-span-3">
        <FichaCard title="Archivos del kit" icon={FolderOpen}>
          <p className="text-sm text-muted-foreground">
            Logos en vectores, manual de marca y plantillas se guardan en la carpeta{" "}
            <strong>Kit de marca</strong> de Archivos.
            {!hasAnything && " Todavía no hay nada cargado para este cliente."}
          </p>
          <Link
            to="/clients/$clientId/archivos"
            params={{ clientId }}
            className="mt-3 inline-flex text-sm font-medium text-[color:var(--brand-1)] hover:underline"
          >
            Abrir Archivos
          </Link>
        </FichaCard>
      </div>
    </div>
  );
}
