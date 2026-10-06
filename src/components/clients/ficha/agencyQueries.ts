import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { whatsappDigits } from "@/lib/followups/rules";
import { buildTimeline, type TimelineEvent } from "./timeline";
import { fichaKeys, useUserKey } from "./fichaQueries";

/** Filas por fuente: la línea de tiempo muestra la actividad reciente, no el historial completo. */
const PER_SOURCE = 30;

function check<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Actividad del cliente armada con las tablas que ya existen (más nuevo primero). */
export function useClientTimeline(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: fichaKeys.timeline(userKey, clientId),
    queryFn: async (): Promise<TimelineEvent[]> => {
      const [payments, comments, posts, proposals, contracts, reports, intake, subs, files] =
        await Promise.all([
          supabase
            .from("payments")
            .select("id,amount,currency,description,period,paid_at")
            .eq("client_id", clientId)
            .eq("status", "paid")
            .not("paid_at", "is", null)
            .order("paid_at", { ascending: false })
            .limit(PER_SOURCE),
          supabase
            .from("deliverable_comments")
            .select("id,kind,body,author_name,created_at,deliverables(title)")
            .eq("client_id", clientId)
            .eq("author_role", "client")
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          supabase
            .from("instagram_posts")
            .select("id,caption,approved_at")
            .eq("client_id", clientId)
            .not("approved_at", "is", null)
            .order("approved_at", { ascending: false })
            .limit(PER_SOURCE),
          supabase
            .from("proposals")
            .select("id,title,amount_clp,sent_at,accepted_at,accepted_name")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          supabase
            .from("client_contracts")
            .select("id,title,signed_at")
            .eq("client_id", clientId)
            .not("signed_at", "is", null)
            .order("signed_at", { ascending: false })
            .limit(PER_SOURCE),
          supabase
            .from("monthly_reports")
            .select("id,period,sent_at")
            .eq("client_id", clientId)
            .not("sent_at", "is", null)
            .order("sent_at", { ascending: false })
            .limit(PER_SOURCE),
          supabase
            .from("client_intake")
            .select("submitted_at,contacto_nombre,archivos")
            .eq("client_id", clientId)
            .maybeSingle(),
          supabase
            .from("subscriptions")
            .select("id,plan_key,started_at,cancelled_at")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          supabase
            .from("deliverables")
            .select("id,title,file_name,created_at")
            .eq("client_id", clientId)
            .not("file_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
        ]);
      return buildTimeline({
        payments: check(payments) ?? [],
        comments: check(comments) ?? [],
        approvedPosts: check(posts) ?? [],
        proposals: check(proposals) ?? [],
        contracts: check(contracts) ?? [],
        reports: check(reports) ?? [],
        intake: check(intake),
        subscriptions: check(subs) ?? [],
        files: check(files) ?? [],
      });
    },
  });
}

export interface FichaAccount {
  /** Suscripción activa más reciente (próximo cobro y permanencia). */
  subscription: {
    next_charge_date: string | null;
    min_months: number;
    started_at: string | null;
  } | null;
  /** Teléfono de contacto válido para WhatsApp (onboarding o prospecto de origen). */
  phone: string | null;
  contactName: string | null;
}

/** Datos de cuenta y contacto que la ficha no tenía: suscripción activa y teléfono. */
export function useFichaAccount(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: fichaKeys.account(userKey, clientId),
    queryFn: async (): Promise<FichaAccount> => {
      const [subRes, intakeRes, prospectRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("next_charge_date,min_months,started_at")
          .eq("client_id", clientId)
          .eq("status", "activa")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("client_intake")
          .select("contacto_nombre,contacto_telefono")
          .eq("client_id", clientId)
          .maybeSingle(),
        supabase
          .from("prospects")
          .select("telefono_publico,estado")
          .eq("client_id", clientId)
          .limit(1)
          .maybeSingle(),
      ]);
      const sub = check(subRes);
      // Sin permiso para leer onboarding o prospectos, la ficha sigue sin teléfono.
      const intake = intakeRes.error ? null : intakeRes.data;
      const prospect = prospectRes.error ? null : prospectRes.data;
      const candidates = [
        intake?.contacto_telefono,
        prospect && prospect.estado !== "baja" ? prospect.telefono_publico : null,
      ];
      const phone = candidates.find((p) => p?.trim() && whatsappDigits(p)) ?? null;
      return {
        subscription: sub ? { ...sub, min_months: Number(sub.min_months) } : null,
        phone,
        contactName: intake?.contacto_nombre?.trim() || null,
      };
    },
  });
}
