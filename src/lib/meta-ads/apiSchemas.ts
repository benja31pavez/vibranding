import { z } from "zod";
import { MAX_META_AMOUNT } from "@/lib/meta/currency";

/**
 * Request bodies of the Meta Ads API routes that move money. Amounts are in
 * base units of the ad account currency (e.g. 10000 CLP, 12.5 USD); the
 * per-currency conversion and integer checks happen in toMetaAmount.
 */
const money = z.number().finite().nonnegative().max(MAX_META_AMOUNT);

export const confirmedAmountsSchema = z
  .object({
    daily: money.optional(),
    lifetime: money.optional(),
    spendCap: money.optional(),
    bid: money.optional(),
  })
  .strict();

export const budgetTypeSchema = z.enum(["daily", "lifetime", "inherit"]);

export const createCampaignBodySchema = z.object({
  campaignId: z.string().min(1),
  confirmedAmounts: confirmedAmountsSchema.optional(),
});

export const MONEY_PATCH_FIELDS = ["daily_budget", "lifetime_budget", "spend_cap", "bid_amount"] as const;
export type MoneyPatchField = (typeof MONEY_PATCH_FIELDS)[number];

export const updateBodySchema = z.object({
  entity: z.enum(["campaign", "adset", "ad"]),
  id: z.string().min(1),
  patch: z
    .object({
      daily_budget: money.nullable().optional(),
      lifetime_budget: money.nullable().optional(),
      spend_cap: money.nullable().optional(),
      bid_amount: money.nullable().optional(),
    })
    .passthrough(),
  confirmedAmounts: confirmedAmountsSchema.optional(),
  /** Money fields for which 0 is intentional (otherwise 0 is rejected). */
  allowZero: z.array(z.enum(MONEY_PATCH_FIELDS)).optional(),
});

const optionalDate = z.string().nullable().optional();

export const publishFullBodySchema = z.object({
  clientId: z.string().min(1),
  confirmedAmounts: confirmedAmountsSchema.optional(),
  campaign: z
    .object({
      name: z.string().trim().min(1).max(120),
      objective: z.string().min(1),
      status: z.enum(["ACTIVE", "PAUSED"]),
      bidStrategy: z.string().min(1),
      cboEnabled: z.boolean(),
      budgetType: budgetTypeSchema,
      budgetAmount: money.nullable().optional(),
      spendCap: money.nullable().optional(),
      startTime: optionalDate,
      endTime: optionalDate,
    })
    .passthrough(),
  adset: z
    .object({
      name: z.string().trim().min(1).max(120),
      status: z.enum(["ACTIVE", "PAUSED"]),
      budgetType: budgetTypeSchema,
      budgetAmount: money.nullable().optional(),
      bidAmount: money.nullable().optional(),
      optimizationGoal: z.string().min(1),
      billingEvent: z.string().min(1),
      countries: z.array(z.string()).min(1),
      ageMin: z.number().int(),
      ageMax: z.number().int(),
      gender: z.enum(["all", "male", "female"]),
      interests: z.array(z.string()).default([]),
      placementMode: z.enum(["automatic", "manual"]),
      placements: z.array(z.string()).default([]),
      devicePlatforms: z.array(z.string()).default([]),
      userOs: z.array(z.string()).default([]),
      startTime: optionalDate,
      endTime: optionalDate,
    })
    .passthrough(),
  ad: z.object({ name: z.string().min(1) }).passthrough(),
});

/** First zod issue as a short user-facing message. */
export function zodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `Datos inválidos (${issue.path.join(".") || "body"}): ${issue.message}` : "Datos inválidos";
}
