import { z } from "zod";

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Requerido").max(120),
  objective: z.enum([
    "OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT",
    "OUTCOME_LEADS", "OUTCOME_APP_PROMOTION", "OUTCOME_SALES",
  ]),
  status: z.enum(["ACTIVE", "PAUSED"]),
  budgetType: z.enum(["daily", "lifetime"]),
  budgetAmount: z.coerce.number().positive("Debe ser > 0"),
  startTime: z.string().min(1, "Requerido"),
  endTime: z.string().optional().nullable(),
  spendCap: z.coerce.number().positive().optional().nullable(),
  cboEnabled: z.boolean(),
  bidStrategy: z.enum([
    "LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP",
    "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS",
  ]),
}).refine(d => !d.endTime || d.endTime > d.startTime, {
  message: "La fecha de fin debe ser posterior al inicio",
  path: ["endTime"],
});
export type CampaignDraft = z.infer<typeof campaignSchema>;

export const adsetSchema = z.object({
  name: z.string().trim().min(1, "Requerido").max(120),
  status: z.enum(["ACTIVE", "PAUSED"]),
  budgetType: z.enum(["daily", "lifetime", "inherit"]),
  budgetAmount: z.coerce.number().positive().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  optimizationGoal: z.enum([
    "LINK_CLICKS", "IMPRESSIONS", "REACH", "LANDING_PAGE_VIEWS",
    "OFFSITE_CONVERSIONS", "LEAD_GENERATION", "THRUPLAY",
  ]),
  billingEvent: z.enum(["IMPRESSIONS", "LINK_CLICKS"]),
  bidAmount: z.coerce.number().positive().optional().nullable(),
  countries: z.array(z.string().length(2)).min(1, "Selecciona al menos un país"),
  cities: z.string().optional(),
  ageMin: z.coerce.number().int().min(13).max(65),
  ageMax: z.coerce.number().int().min(13).max(65),
  gender: z.enum(["all", "male", "female"]),
  languages: z.string().optional(),
  interests: z.array(z.string()).default([]),
  behaviors: z.array(z.string()).default([]),
  demographics: z.array(z.string()).default([]),
  customAudiences: z.array(z.string()).default([]),
  lookalikeAudiences: z.array(z.string()).default([]),
  excludedAudiences: z.array(z.string()).default([]),
  placementMode: z.enum(["automatic", "manual"]),
  placements: z.array(z.string()).default([]),
  devicePlatforms: z.array(z.enum(["mobile", "desktop"])).default([]),
  userOs: z.array(z.enum(["iOS", "Android"])).default([]),
  wifiOnly: z.boolean().default(false),
}).refine(d => d.ageMax >= d.ageMin, { message: "Edad máx ≥ edad mín", path: ["ageMax"] })
  .refine(d => d.budgetType === "inherit" || (d.budgetAmount && d.budgetAmount > 0), {
    message: "Indica un monto", path: ["budgetAmount"],
  })
  .refine(d => d.placementMode === "automatic" || d.placements.length > 0, {
    message: "Selecciona al menos una ubicación", path: ["placements"],
  });
export type AdsetDraft = z.infer<typeof adsetSchema>;

export const carouselCardSchema = z.object({
  image_url: z.string().url().optional().or(z.literal("")),
  video_url: z.string().url().optional().or(z.literal("")),
  headline: z.string().max(40).optional(),
  description: z.string().max(30).optional(),
  link_url: z.string().url("URL inválida"),
  cta: z.string(),
});

export const adSchema = z.object({
  name: z.string().trim().min(1, "Requerido").max(120),
  status: z.enum(["ACTIVE", "PAUSED"]),
  pageId: z.string().min(1, "Selecciona la página de Facebook"),
  instagramActorId: z.string().optional().nullable(),
  format: z.enum(["image", "video", "carousel", "collection"]),
  imageUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  carouselCards: z.array(carouselCardSchema).default([]),
  optimizeCarouselOrder: z.boolean().default(true),
  multiShareEndCard: z.boolean().default(true),
  primaryText: z.string().max(125).optional(),
  headline: z.string().max(40).optional(),
  description: z.string().max(30).optional(),
  linkUrl: z.string().url("URL inválida"),
  displayUrl: z.string().optional(),
  utmParams: z.object({
    source: z.string().optional(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    term: z.string().optional(),
    content: z.string().optional(),
  }).optional(),
  cta: z.string(),
}).superRefine((d, ctx) => {
  if (d.format === "image" && !d.imageUrl) {
    ctx.addIssue({ code: "custom", path: ["imageUrl"], message: "Sube o pega una imagen" });
  }
  if (d.format === "video" && !d.videoUrl) {
    ctx.addIssue({ code: "custom", path: ["videoUrl"], message: "Sube o pega un video" });
  }
  if (d.format === "carousel") {
    if (d.carouselCards.length < 2) {
      ctx.addIssue({ code: "custom", path: ["carouselCards"], message: "Mínimo 2 tarjetas" });
    }
    if (d.carouselCards.length > 10) {
      ctx.addIssue({ code: "custom", path: ["carouselCards"], message: "Máximo 10 tarjetas" });
    }
  }
});
export type AdDraft = z.infer<typeof adSchema>;

export function safeValidate<T>(schema: z.ZodType<T>, data: unknown):
  { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
