import metaLogo from "@/assets/meta-logo.png.asset.json";

/** Official Meta mark, used where the Meta umbrella (ads on FB + IG) is meant. */
export function MetaIcon({ className }: { className?: string }) {
  return <img src={metaLogo.url} alt="" aria-hidden="true" className={className} />;
}
