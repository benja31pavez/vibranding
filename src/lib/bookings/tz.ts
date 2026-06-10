// Helpers to convert between IANA timezone wall-clock and UTC.

function partsInTZ(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  return {
    year: +m.year,
    month: +m.month,
    day: +m.day,
    hour: +m.hour,
    minute: +m.minute,
    second: +m.second,
    weekday: m.weekday, // Mon..Sun
  };
}

function tzOffsetMs(timeZone: string, atUTCms: number) {
  const p = partsInTZ(new Date(atUTCms), timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - atUTCms;
}

// Build a UTC Date that represents the wall-clock {y,mo,d,h,mi} in the given tz.
export function zonedToUTC(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  let guess = Date.UTC(y, mo, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const off = tzOffsetMs(timeZone, guess);
    guess = Date.UTC(y, mo, d, h, mi) - off;
  }
  return new Date(guess);
}

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

// Returns { dayIdx (0=Mon..6=Sun), minutes (since midnight), y, mo, d } in the given tz.
export function zonedParts(iso: string, timeZone: string) {
  const p = partsInTZ(new Date(iso), timeZone);
  return {
    dayIdx: WEEKDAY_MAP[p.weekday] ?? 0,
    minutes: p.hour * 60 + p.minute,
    year: p.year,
    month: p.month,
    day: p.day,
  };
}
