import { cn } from "@/lib/utils";
import { initialsOf } from "./navConfig";

export function ClientAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
