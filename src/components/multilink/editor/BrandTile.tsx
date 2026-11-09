import { LinkIcon, linkKindColor } from "@/components/multilink/LinkIcon";
import { withAlpha } from "@/lib/multilinkTheme";
import { LINK_KIND_LABEL, type LinkKind } from "@/lib/site/linkKind";

/** Ficha del ícono con el color de la marca de destino (WhatsApp verde, YouTube rojo…). */
export function BrandTile({ kind, size = "md" }: { kind: LinkKind; size?: "sm" | "md" }) {
  const color = linkKindColor(kind);
  // TikTok y X son negros: en modo oscuro se pierden, así que van con el color del texto.
  const mono = !color || color === "#000000";
  const box = size === "sm" ? "h-5 w-5 rounded-md" : "h-9 w-9 rounded-lg";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  return (
    <span
      className={`grid shrink-0 place-items-center ${box} ${mono ? "bg-secondary text-foreground" : ""}`}
      style={mono ? undefined : { background: withAlpha(color, 0.13), color }}
      title={LINK_KIND_LABEL[kind]}
    >
      <LinkIcon kind={kind} className={icon} />
    </span>
  );
}
