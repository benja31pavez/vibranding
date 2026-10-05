import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { chileToday } from "@/lib/dates/chile";
import {
  REVIEW_ASKED_EVENT,
  parseReviewAsked,
  reviewAskedStorageKey,
  withReviewAsked,
  type ReviewAskedMap,
} from "@/lib/reviews/requestReview";

/**
 * Cuándo se pidió reseña a cada cliente: preferencia de este navegador y usuario
 * (localStorage). Si el almacenamiento no está disponible, no se recuerda nada y
 * la sugerencia puede volver a aparecer.
 */
function readReviewAsked(userId: string, today: string): ReviewAskedMap {
  try {
    return parseReviewAsked(window.localStorage.getItem(reviewAskedStorageKey(userId)), today);
  } catch (e) {
    console.warn("[reseñas] localStorage no disponible; no se recordarán pedidos", e);
    return {};
  }
}

function writeReviewAsked(map: ReviewAskedMap, userId: string): boolean {
  try {
    window.localStorage.setItem(reviewAskedStorageKey(userId), JSON.stringify(map));
    return true;
  } catch (e) {
    console.warn("[reseñas] no se pudo guardar en localStorage", e);
    return false;
  }
}

/** Mapa clientId → fecha del último pedido, sincronizado entre ficha e "Inicio". */
export function useReviewAsked() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const today = chileToday();
  const [asked, setAsked] = useState<ReviewAskedMap>({});

  useEffect(() => {
    if (!userId) {
      setAsked({});
      return;
    }
    const sync = () => setAsked(readReviewAsked(userId, today));
    sync();
    window.addEventListener(REVIEW_ASKED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REVIEW_ASKED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [userId, today]);

  /** Registra que hoy se pidió reseña; false si el navegador no permite guardarlo. */
  const markAsked = useCallback(
    (clientId: string): boolean => {
      // Se relee lo guardado para no pisar lo marcado desde otra pestaña.
      const base = userId ? { ...asked, ...readReviewAsked(userId, today) } : asked;
      const next = withReviewAsked(base, clientId, today);
      setAsked(next);
      if (!userId) return false;
      const saved = writeReviewAsked(next, userId);
      window.dispatchEvent(new Event(REVIEW_ASKED_EVENT));
      return saved;
    },
    [asked, today, userId],
  );

  return { asked, today, markAsked };
}
