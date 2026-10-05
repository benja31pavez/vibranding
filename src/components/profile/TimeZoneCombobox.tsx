import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  groupTimeZones,
  listTimeZones,
  timeZoneLabel,
  timeZoneSearchScore,
  timeZoneSearchValue,
} from "@/lib/prefs/timezones";

interface TimeZoneComboboxProps {
  id: string;
  value: string;
  onChange: (timeZone: string) => void;
  disabled?: boolean;
  describedBy?: string;
}

/** Selector con búsqueda de todas las zonas IANA, agrupadas por región y con su desfase actual. */
export function TimeZoneCombobox({
  id,
  value,
  onChange,
  disabled,
  describedBy,
}: TimeZoneComboboxProps) {
  const [open, setOpen] = useState(false);
  // Se calcula al abrir para que los desfases reflejen el horario de verano vigente.
  const groups = useMemo(() => (open ? groupTimeZones(listTimeZones()) : []), [open]);
  // Abre con la zona actual resaltada.
  const current = useMemo(() => {
    for (const group of groups) {
      const zone = group.zones.find((z) => z.id === value);
      if (zone) return timeZoneSearchValue(zone, group.region);
    }
    return undefined;
  }, [groups, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-describedby={describedBy}
          disabled={disabled}
          className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="min-w-0 flex-1 truncate">{timeZoneLabel(value)}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[min(18rem,calc(100vw-2rem))] p-0"
      >
        <Command key={current ?? "none"} defaultValue={current} filter={timeZoneSearchScore}>
          <CommandInput placeholder="Buscar ciudad o región…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.region} heading={group.region}>
                {group.zones.map((zone) => (
                  <CommandItem
                    key={zone.id}
                    value={timeZoneSearchValue(zone, group.region)}
                    onSelect={() => {
                      onChange(zone.id);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{zone.label}</span>
                    {zone.id === value && <Check className="h-4 w-4" aria-label="Seleccionada" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
