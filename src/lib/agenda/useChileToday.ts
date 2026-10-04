import { useEffect, useState } from "react";
import { todayInChile } from "./dates";

const REFRESH_MS = 60_000;

/** "Hoy" en Chile, estable entre renders y actualizado al pasar la medianoche. */
export function useChileToday(): string {
  const [today, setToday] = useState(todayInChile);
  useEffect(() => {
    const sync = () => setToday(todayInChile());
    sync();
    const id = window.setInterval(sync, REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);
  return today;
}
