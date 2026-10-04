import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isApplePlatform } from "./platform";

/** "⌘K" en Mac y "Ctrl K" en el resto; se resuelve tras montar para no romper el SSR. */
function useShortcutLabel() {
  const [label, setLabel] = useState("⌘K");
  useEffect(() => {
    if (!isApplePlatform()) setLabel("Ctrl K");
  }, []);
  return label;
}

export function SearchButton({ onClick }: { onClick: () => void }) {
  const shortcut = useShortcutLabel();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-label={`Buscar clientes o secciones (${shortcut})`}
      aria-keyshortcuts={shortcut === "⌘K" ? "Meta+K" : "Control+K"}
      className="h-9 w-9 gap-2 px-0 text-muted-foreground sm:w-auto sm:px-3"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Buscar</span>
      <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-xs lg:inline">
        {shortcut}
      </kbd>
    </Button>
  );
}
