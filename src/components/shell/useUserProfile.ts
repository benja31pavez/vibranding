import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

const EMPTY_PROFILE: UserProfile = { full_name: null, phone: null, avatar_url: null };

/** Perfil del usuario del header; se recarga con el evento global "profile-updated". */
export function useUserProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!userId) return;
    const loadProfile = () => {
      supabase
        .from("user_profiles")
        .select("full_name,phone,avatar_url")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error("[shell] No se pudo cargar el perfil", error);
          setProfile(data ?? EMPTY_PROFILE);
        });
    };
    loadProfile();
    window.addEventListener("profile-updated", loadProfile);
    return () => window.removeEventListener("profile-updated", loadProfile);
  }, [userId]);

  return profile;
}
