import { supabase } from "@/integrations/supabase/client";

export async function uploadClientMedia(file: File, clientId: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("No autenticado");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${clientId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("client-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("client-media").getPublicUrl(path);
  return data.publicUrl;
}
