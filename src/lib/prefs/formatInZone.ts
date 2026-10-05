/**
 * Formateadores de instantes (timestamps) en la zona horaria elegida por el usuario.
 * Úsalos solo para MOSTRAR horas en el panel; los días de negocio siguen en hora de Chile.
 */
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "./timezones";

type Style = "time" | "dateTime";

const OPTIONS: Readonly<Record<Style, Intl.DateTimeFormatOptions>> = {
  time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  dateTime: {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  },
};

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(style: Style, timeZone: string): Intl.DateTimeFormat {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const key = `${style}|${zone}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("es-CL", { ...OPTIONS[style], timeZone: zone });
    cache.set(key, fmt);
  }
  return fmt;
}

function format(style: Style, iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatter(style, timeZone).format(date);
}

/** "14:30" en la zona indicada. */
export function formatTimeInZone(iso: string | null | undefined, timeZone: string): string {
  return format("time", iso, timeZone);
}

/** "4 oct, 14:30" en la zona indicada. */
export function formatDateTimeInZone(iso: string | null | undefined, timeZone: string): string {
  return format("dateTime", iso, timeZone);
}
