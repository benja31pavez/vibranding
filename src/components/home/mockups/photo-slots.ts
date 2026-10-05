/**
 * Photo slots for the public pages. Files live in `public/images/home/` as WebP at two widths.
 * The current photos are AI-generated illustrations approved by Vibranding: they never show a
 * real client, their work or a testimonial. An empty slot renders a brand gradient placeholder
 * of the same size, so swapping photos never shifts the layout.
 */
import type { ServiceSlug } from "@/lib/services/content";

export interface PhotoSlotImage {
  readonly src: string;
  readonly srcSet: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

const DIR = "/images/home";

/** 3:4 portrait photo exported at 480 and 960 px wide. */
function portrait(name: string, alt: string): PhotoSlotImage {
  return {
    src: `${DIR}/${name}-960.webp`,
    srcSet: `${DIR}/${name}-480.webp 480w, ${DIR}/${name}-960.webp 960w`,
    alt,
    width: 960,
    height: 1280,
  };
}

/**
 * Home "¿Para quién es Vibranding?" cards, in the order of `home.niches.items`.
 * Slot: 4:3 on mobile, 4:5 from `sm`. A card with two photos cross-fades between them.
 */
export const NICHE_PHOTOS: readonly (readonly PhotoSlotImage[])[] = [
  [portrait("rubro-paisajismo", "Dueño de empresa de paisajismo en un jardín de Santiago")],
  [portrait("rubro-salud", "Recepcionista de clínica respondiendo WhatsApp")],
  [
    portrait("rubro-gimnasio", "Entrenador personal en un gimnasio boutique"),
    portrait("rubro-estetica", "Estudio de estética preparando una sala"),
  ],
];

/** "Cómo es trabajar con nosotros": backdrop behind the client-panel mockup. 16:9 (21:9 on md). */
export const PROCESS_PHOTO: PhotoSlotImage = {
  src: `${DIR}/estudio-1600.webp`,
  srcSet: `${DIR}/estudio-960.webp 960w, ${DIR}/estudio-1600.webp 1600w`,
  alt: "Escritorio de estudio creativo con calendario de contenido",
  width: 1600,
  height: 900,
};

/** Backdrop behind the animated mockup in each service page hero. 4:5. Empty for now. */
export const SERVICE_HERO_PHOTOS: Readonly<Record<ServiceSlug, PhotoSlotImage | undefined>> = {
  "pagina-web-para-pymes": undefined,
  "agencia-marketing-digital-santiago": undefined,
  "publicidad-meta-ads": undefined,
  "google-ads-pymes": undefined,
  "chatbot-whatsapp": undefined,
};
