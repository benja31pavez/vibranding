import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withoutBots } from "@/lib/analytics/bots";
import type { LandingEventRow } from "@/components/landing/analytics/aggregate";
import {
  LandingAnalyticsView,
  type AnalyticsRange,
} from "@/components/landing/analytics/LandingAnalyticsView";

const DAY_MS = 86_400_000;

/**
 * Analítica de la landing calculada desde landing_events: visitas, clics al
 * botón y a WhatsApp, formularios, embudo, fuentes de tráfico y campañas UTM.
 */
export function LandingAnalytics({ clientId, landingId }: { clientId: string; landingId: string }) {
  const [rows, setRows] = useState<LandingEventRow[]>([]);
  const [days, setDays] = useState<AnalyticsRange>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const from = new Date(Date.now() - (days - 1) * DAY_MS);
    from.setHours(0, 0, 0, 0);
    supabase
      .from("landing_events")
      .select("event_name,referrer,utm_source,utm_medium,utm_campaign,created_at,user_agent")
      .eq("client_id", clientId)
      .eq("source_type", "landing")
      .eq("source_id", landingId)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          console.error("landing analytics", err);
          setError("Revisa tu conexión e inténtalo de nuevo.");
          setRows([]);
        } else {
          setRows(withoutBots((data ?? []) as LandingEventRow[]));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, landingId, days, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <LandingAnalyticsView
      rows={rows}
      days={days}
      onDaysChange={setDays}
      loading={loading}
      error={error}
      onRetry={retry}
    />
  );
}
