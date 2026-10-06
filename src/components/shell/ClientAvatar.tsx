import { ClientLogo } from "@/components/clients/logo";
import { cn } from "@/lib/utils";

/** Logo del cliente (redondo) o, si no tiene, sus iniciales. */
export function ClientAvatar({
  clientId,
  name,
  className,
}: {
  clientId: string;
  name: string;
  className?: string;
}) {
  return (
    <ClientLogo
      clientId={clientId}
      name={name}
      className={cn(
        "h-8 w-8 rounded-md bg-primary/10 text-xs font-semibold text-primary",
        className,
      )}
    />
  );
}
