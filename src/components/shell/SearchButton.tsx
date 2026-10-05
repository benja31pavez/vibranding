import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isApplePlatform } from "./platform";

/** El atajo (⌘K / Ctrl+K) sigue activo pero no se muestra; solo se anuncia a lectores. */
function useShortcutKeys() {
  const [keys, setKeys] = useState("Meta+K");
  useEffect(() => {
    if (!isApplePlatform()) setKeys("Control+K");
  }, []);
  return keys;
}

export function SearchButton({ onClick }: { onClick: () => void }) {
  const keys = useShortcutKeys();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-label="Buscar clientes"
      aria-keyshortcuts={keys}
      className="h-9 w-9 gap-2 px-0 text-muted-foreground sm:w-auto sm:px-3"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Buscar</span>
    </Button>
  );
}
