/**
 * Modelo de la página Conexiones (lógica pura, sin I/O): cuatro conexiones
 * independientes (Instagram, WhatsApp, Meta Ads, Google Ads), cada una con sus
 * pasos. Un paso solo se bloquea por pasos de SU conexión.
 *
 * El inicio de sesión con Meta es técnicamente compartido por Instagram y Meta
 * Ads (la API de Instagram se usa vía Meta): aparece como paso en ambas y, si
 * se hizo desde una, en la otra ya figura como hecho.
 */
import type { ClientCapabilities } from "@/hooks/use-client-capabilities";
import type { SetupAccount, SetupStatus } from "@/lib/meta/setup.functions";
import type { GoogleAdsOverview } from "@/lib/google-ads/connection.functions";
import type { AdsBillingState } from "@/lib/ads-billing/combined";
import { formatCustomerId } from "@/lib/google-ads/gaql";

export const CONNECTION_KEYS = ["instagram", "whatsapp", "meta-ads", "google-ads"] as const;
export type ConnectionKey = (typeof CONNECTION_KEYS)[number];

export function parseConnectionKey(value: unknown): ConnectionKey | undefined {
  return CONNECTION_KEYS.find((k) => k === value);
}

export const CONNECTION_LABEL: Readonly<Record<ConnectionKey, string>> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  "meta-ads": "Meta Ads",
  "google-ads": "Google Ads",
};

export type StepKey =
  | "meta-login"
  | "ig-link"
  | "ig-sync"
  | "ad-account"
  | "ingest"
  | "meta-billing"
  | "wa-start"
  | "wa-number"
  | "wa-outcomes"
  | "gads-link"
  | "gads-sync"
  | "gads-billing";

export type StepState = "done" | "available" | "blocked";
export type ConnectionStatus = "connected" | "pending" | "error";

export interface StepInfo {
  key: StepKey;
  title: string;
  state: StepState;
  /** Qué paso de esta misma conexión falta (solo si está bloqueado). */
  blockedBy?: StepKey;
}

export interface ConnectionInfo {
  key: ConnectionKey;
  label: string;
  status: ConnectionStatus;
  /** Cuenta vinculada (nombre, @usuario o id), si existe. */
  account: string | null;
  steps: StepInfo[];
  /** Aviso corto (p. ej. "Opcional · servicio Chatbot"). */
  note?: string;
}

export interface ConnectionsInput {
  caps: ClientCapabilities;
  account: SetupAccount | null;
  instagram: SetupStatus["instagram"];
  /** El plan del cliente incluye Meta Ads (o no se conoce el plan). */
  adsIncluded: boolean;
  whatsapp: {
    exists: boolean;
    connected: boolean;
    displayPhone: string | null;
    phoneNumberId: string | null;
  } | null;
  whatsappFailed: boolean;
  /** Paso "Marcar conversaciones" visible (Analítica no está oculta). */
  showOutcomes: boolean;
  google: GoogleAdsOverview | null;
  googleFailed: boolean;
  googleBillingVerdict: string | null;
  metaBillingState: AdsBillingState | null;
}

/** Encadena pasos: cada uno queda bloqueado si falta uno anterior de la misma conexión. */
function chain(steps: readonly { key: StepKey; title: string; done: boolean }[]): StepInfo[] {
  let pending: StepKey | undefined;
  return steps.map((s) => {
    const state: StepState = s.done ? "done" : pending ? "blocked" : "available";
    const info: StepInfo = { key: s.key, title: s.title, state };
    if (state === "blocked") info.blockedBy = pending;
    if (!s.done && !pending) pending = s.key;
    return info;
  });
}

const META_LOGIN_TITLE = "Iniciar sesión con Meta";

function instagramInfo(i: ConnectionsInput): ConnectionInfo {
  const { caps, account, instagram } = i;
  const linked = caps.has_instagram;
  return {
    key: "instagram",
    label: CONNECTION_LABEL.instagram,
    status:
      linked && account?.token_valid === false
        ? "error"
        : linked && caps.meta_connected
          ? "connected"
          : "pending",
    account: instagram?.username
      ? `@${instagram.username}`
      : account?.ig_account_id
        ? `ID ${account.ig_account_id}`
        : null,
    steps: chain([
      { key: "meta-login", title: META_LOGIN_TITLE, done: caps.meta_connected },
      { key: "ig-link", title: "Vincular cuenta de Instagram", done: linked },
      {
        key: "ig-sync",
        title: "Sincronizar publicaciones",
        done: Boolean(account?.last_ig_sync_at),
      },
    ]),
  };
}

function metaAdsInfo(i: ConnectionsInput): ConnectionInfo {
  const { caps, account } = i;
  const assigned = caps.has_ad_account;
  const broken =
    account?.token_valid === false ||
    Boolean(account?.last_sync_error) ||
    i.metaBillingState === "rechazado";
  return {
    key: "meta-ads",
    label: CONNECTION_LABEL["meta-ads"],
    status:
      assigned && broken ? "error" : assigned && caps.meta_connected ? "connected" : "pending",
    account: account?.ad_account_id
      ? account.business_name
        ? `${account.business_name} · ${account.ad_account_id}`
        : account.ad_account_id
      : null,
    note: i.adsIncluded ? undefined : "El plan actual no incluye Meta Ads",
    steps: chain([
      { key: "meta-login", title: META_LOGIN_TITLE, done: caps.meta_connected },
      { key: "ad-account", title: "Asignar cuenta publicitaria", done: assigned },
      { key: "ingest", title: "Primera ingesta de anuncios", done: caps.ingest_ran },
      {
        key: "meta-billing",
        title: "Medio de pago de la pauta",
        done: i.metaBillingState === "verificado",
      },
    ]),
  };
}

function whatsappInfo(i: ConnectionsInput): ConnectionInfo {
  const wa = i.whatsapp;
  const connected = i.caps.has_whatsapp;
  const steps = [
    { key: "wa-start" as const, title: "Iniciar configuración", done: Boolean(wa?.exists) },
    { key: "wa-number" as const, title: "Webhook, número y token", done: connected },
    ...(i.showOutcomes
      ? [
          {
            key: "wa-outcomes" as const,
            title: "Marcar conversaciones",
            done: i.caps.has_outcomes,
          },
        ]
      : []),
  ];
  return {
    key: "whatsapp",
    label: CONNECTION_LABEL.whatsapp,
    status: i.whatsappFailed ? "error" : connected ? "connected" : "pending",
    account: wa?.displayPhone ?? wa?.phoneNumberId ?? null,
    note: "Opcional · servicio Chatbot",
    steps: chain(steps),
  };
}

function googleAdsInfo(i: ConnectionsInput): ConnectionInfo {
  const conn = i.google?.connection ?? null;
  const linked = conn?.status === "conectada";
  const broken = i.googleFailed || conn?.status === "error" || (conn !== null && !conn.hasToken);
  return {
    key: "google-ads",
    label: CONNECTION_LABEL["google-ads"],
    status: broken ? "error" : linked ? "connected" : "pending",
    account: conn ? formatCustomerId(conn.customerId) : null,
    note:
      i.google && !i.google.configured ? "Falta habilitar Google Ads en el servidor" : undefined,
    steps: chain([
      { key: "gads-link", title: "Vincular la cuenta", done: linked },
      { key: "gads-sync", title: "Primera actualización", done: Boolean(conn?.lastSyncedAt) },
      {
        key: "gads-billing",
        title: "Medio de pago de la pauta",
        done: i.googleBillingVerdict === "verificado",
      },
    ]),
  };
}

/** Las cuatro conexiones, en el orden del menú lateral. */
export function buildConnections(input: ConnectionsInput): Record<ConnectionKey, ConnectionInfo> {
  return {
    instagram: instagramInfo(input),
    whatsapp: whatsappInfo(input),
    "meta-ads": metaAdsInfo(input),
    "google-ads": googleAdsInfo(input),
  };
}

/** Paso que conviene abrir primero: el primero disponible sin hacer, o el primero. */
export function initialStep(info: ConnectionInfo): StepKey {
  return (info.steps.find((s) => s.state === "available") ?? info.steps[0]).key;
}
