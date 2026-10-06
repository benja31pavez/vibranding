/**
 * Datos de "Archivos": solo fuentes que ya guardan una URL de archivo
 * (entregables, publicaciones, anuncios y reportes enviados), los archivos
 * subidos en la plataforma (client_files, con autoría) y los que el cliente
 * subió en el onboarding (bucket privado, URL firmada a pedido).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  CLIENT_FILES_BUCKET,
  clientFileMime,
  clientFileProblem,
} from "@/lib/clientFiles/clientFiles";
import {
  confirmClientFileUpload,
  createClientFileUpload,
  deleteClientFile,
  listClientFiles,
} from "@/lib/clientFiles/clientFiles.functions";
import { useClientReports } from "@/components/reports/reportQueries";
import { chileToday } from "@/lib/dates/chile";
import { fichaKeys, useUserKey } from "../ficha/fichaQueries";
import { useClientIntake } from "../ficha/OnboardingIntakePanel";
import {
  byDateDesc,
  clientUploads,
  fromAd,
  fromDeliverable,
  fromOnboardingPath,
  fromPost,
  fromReport,
  splitStored,
  type ClientFile,
  type ClientUpload,
} from "./archivosModel";

/** Topes por consulta: de sobra para el historial de un cliente. */
const DELIVERABLES_LIMIT = 500;
const POSTS_LIMIT = 500;
const ADS_LIMIT = 200;
/** Las URLs firmadas duran 1 hora: se renuevan antes. */
const STORED_STALE_MS = 30 * 60 * 1000;

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

function storedKey(userKey: string, clientId: string) {
  return [...fichaKeys.all(userKey, clientId), "stored-files"] as const;
}

/**
 * Archivos subidos en "Archivos" (client_files), con URL firmada, permisos del
 * usuario (subir / eliminar) y espacio usado. El servidor decide todo.
 */
export function useStoredFiles(clientId: string) {
  const userKey = useUserKey();
  const list = useServerFn(listClientFiles);
  return useQuery({
    queryKey: storedKey(userKey, clientId),
    queryFn: () => list({ data: { clientId } }),
    staleTime: STORED_STALE_MS,
    refetchInterval: STORED_STALE_MS,
  });
}

/** Archivos generados por Vibranding (piezas gráficas y documentos), del más nuevo al más antiguo. */
export function useGeneratedFiles(clientId: string) {
  const userKey = useUserKey();
  const base = useQuery({
    queryKey: [...fichaKeys.all(userKey, clientId), "files"] as const,
    queryFn: () => fetchGenerated(clientId),
  });
  const stored = useStoredFiles(clientId);
  const reports = useClientReports(userKey, clientId);
  const today = chileToday();
  const reportFiles = (reports.data ?? []).flatMap((r) => fromReport(r, today) ?? []);
  // Lo que subió la agencia va junto a lo generado por Vibranding.
  const agencyFiles = splitStored(stored.data?.files ?? []).agency;
  const files = base.data
    ? [...base.data.files, ...agencyFiles, ...reportFiles].sort(byDateDesc)
    : undefined;
  return {
    files,
    isLoading: base.isLoading || reports.isLoading || stored.isLoading,
    error: base.error ?? reports.error ?? stored.error,
    refetch: () => {
      void base.refetch();
      void reports.refetch();
      void stored.refetch();
    },
  };
}

/**
 * Lo que subió el cliente: en la plataforma (client_files) y en el onboarding.
 * El onboarding es solo para editores: el RLS de `client_intake` y la firma en
 * el servidor exigen poder editar al cliente.
 */
export function useUploadedFiles(clientId: string, canEdit: boolean) {
  const intake = useClientIntake(clientId, canEdit);
  const stored = useStoredFiles(clientId);
  const onboarding = (intake.data?.archivos ?? []).map((path) =>
    fromOnboardingPath(path, intake.data?.submitted_at ?? null),
  );
  const files: ClientUpload[] = clientUploads(
    splitStored(stored.data?.files ?? []).client,
    onboarding,
  );
  return {
    files,
    isLoading: (canEdit && intake.isLoading) || stored.isLoading,
    error: intake.error ?? stored.error,
    refetch: () => {
      void intake.refetch();
      void stored.refetch();
    },
  };
}

export interface UploadOutcome {
  uploaded: number;
  errors: { name: string; message: string }[];
}

/**
 * Sube archivos uno a uno: el servidor firma la subida (permiso, tipo, tamaño
 * y cuota), el navegador sube directo a Storage y el servidor la registra
 * (vuelve a validar tamaño real, tipo y cuota con el objeto ya subido).
 */
export function useUploadClientFiles(clientId: string) {
  const userKey = useUserKey();
  const qc = useQueryClient();
  const createSlot = useServerFn(createClientFileUpload);
  const confirm = useServerFn(confirmClientFileUpload);

  const uploadOne = async (file: File): Promise<void> => {
    const mime = clientFileMime(file.name, file.type);
    const problem = clientFileProblem(mime, file.size);
    if (problem || !mime) throw new Error(problem ?? "Formato no permitido");
    const slot = await createSlot({ data: { clientId, mime, size: file.size } });
    const { error } = await supabase.storage
      .from(CLIENT_FILES_BUCKET)
      .uploadToSignedUrl(slot.path, slot.token, file, { contentType: mime });
    if (error) {
      console.error("[archivos] subida falló", error.message);
      throw new Error("No se pudo subir. Revisa tu conexión e intenta de nuevo.");
    }
    await confirm({ data: { clientId, path: slot.path, name: file.name } });
  };

  return useMutation({
    mutationFn: async (files: readonly File[]): Promise<UploadOutcome> => {
      let uploaded = 0;
      const errors: UploadOutcome["errors"] = [];
      for (const file of files) {
        try {
          await uploadOne(file);
          uploaded += 1;
        } catch (e) {
          errors.push({ name: file.name, message: (e as Error).message || "No se pudo subir" });
        }
      }
      return { uploaded, errors };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: storedKey(userKey, clientId) }),
  });
}

/** Elimina un archivo propio (el servidor y la BD verifican quién lo subió). */
export function useDeleteClientFile(clientId: string) {
  const userKey = useUserKey();
  const qc = useQueryClient();
  const remove = useServerFn(deleteClientFile);
  return useMutation({
    mutationFn: (fileId: string) => remove({ data: { clientId, fileId } }),
    onSettled: () => qc.invalidateQueries({ queryKey: storedKey(userKey, clientId) }),
  });
}
