/**
 * Datos de "Archivos": solo fuentes que ya guardan una URL de archivo
 * (entregables, publicaciones, anuncios y reportes enviados) y los archivos
 * que el cliente subió en el onboarding (bucket privado, URL firmada a pedido).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientReports } from "@/components/reports/reportQueries";
import { chileToday } from "@/lib/dates/chile";
import { fichaKeys, useUserKey } from "../ficha/fichaQueries";
import { useClientIntake } from "../ficha/OnboardingIntakePanel";
import {
  byDateDesc,
  fromAd,
  fromDeliverable,
  fromOnboardingPath,
  fromPost,
  fromReport,
  type ClientFile,
  type UploadedFile,
} from "./archivosModel";

/** Topes por consulta: de sobra para el historial de un cliente. */
const DELIVERABLES_LIMIT = 500;
const POSTS_LIMIT = 500;
const ADS_LIMIT = 200;

interface GeneratedFiles {
  files: ClientFile[];
}

async function fetchGenerated(clientId: string): Promise<GeneratedFiles> {
  const [deliverables, posts, ads] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id,title,type,status,file_url,file_name,mime_type,created_at,instagram_post_id")
      .eq("client_id", clientId)
      .not("file_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(DELIVERABLES_LIMIT),
    supabase
      .from("instagram_posts")
      .select(
        "id,caption,format,type,image_url,cover_url,carousel_urls,published_at,scheduled_at,created_at,approval_status",
      )
      .eq("client_id", clientId)
      .is("archived_at", null)
      // Las versiones guardadas de la grilla son copias: no se repiten aquí.
      .is("version_id", null)
      .order("created_at", { ascending: false })
      .limit(POSTS_LIMIT),
    supabase
      .from("meta_ads_ads")
      .select("id,name,image_url,video_url,carousel_urls,status,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(ADS_LIMIT),
  ]);
  const error = deliverables.error ?? posts.error ?? ads.error;
  if (error) throw new Error(error.message);

  const postFiles = (posts.data ?? []).flatMap((p) => fromPost(p) ?? []);
  const postIds = new Set(postFiles.map((f) => f.id.replace(/^post-/, "")));
  // Un entregable ligado a una publicación ya listada no se repite.
  const deliverableFiles = (deliverables.data ?? [])
    .filter((d) => !d.instagram_post_id || !postIds.has(d.instagram_post_id))
    .flatMap((d) => fromDeliverable(d) ?? []);
  const adFiles = (ads.data ?? []).flatMap((a) => fromAd(a) ?? []);
  return { files: [...postFiles, ...deliverableFiles, ...adFiles] };
}

/** Archivos generados por Vibranding (piezas gráficas y documentos), del más nuevo al más antiguo. */
export function useGeneratedFiles(clientId: string) {
  const userKey = useUserKey();
  const base = useQuery({
    queryKey: [...fichaKeys.all(userKey, clientId), "files"] as const,
    queryFn: () => fetchGenerated(clientId),
  });
  const reports = useClientReports(userKey, clientId);
  const today = chileToday();
  const reportFiles = (reports.data ?? []).flatMap((r) => fromReport(r, today) ?? []);
  const files = base.data ? [...base.data.files, ...reportFiles].sort(byDateDesc) : undefined;
  return {
    files,
    isLoading: base.isLoading || reports.isLoading,
    error: base.error ?? reports.error,
    refetch: () => {
      void base.refetch();
      void reports.refetch();
    },
  };
}

/**
 * Archivos que el cliente subió en el onboarding. Solo editores: el RLS de
 * `client_intake` y la firma en el servidor exigen poder editar al cliente.
 */
export function useUploadedFiles(clientId: string, canEdit: boolean) {
  const intake = useClientIntake(clientId, canEdit);
  const files: UploadedFile[] = (intake.data?.archivos ?? [])
    .map((path) => fromOnboardingPath(path, intake.data?.submitted_at ?? null))
    .sort(byDateDesc);
  return {
    files,
    isLoading: canEdit && intake.isLoading,
    error: intake.error,
    refetch: () => void intake.refetch(),
  };
}
