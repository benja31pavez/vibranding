// Server-side helpers to dispatch bot rule "actions" through the WhatsApp Cloud API.
const META = "https://graph.facebook.com/v21.0";

export type BotAction =
  | { kind: "text"; body: string }
  | { kind: "link"; url: string; caption?: string }
  | { kind: "document"; url: string; filename?: string; caption?: string }
  | { kind: "image"; url: string; caption?: string }
  | { kind: "poll"; question: string; options: string[] }
  | {
      kind: "catalog";
      title?: string;
      items: Array<{ name: string; price?: string; url?: string; image_url?: string }>;
    };

export type SendOutcome = {
  ok: boolean;
  wa_id?: string;
  error?: string;
  preview: string; // short text saved into whatsapp_messages.body
  type: string; // saved into whatsapp_messages.type
};

async function postMessage(
  phoneNumberId: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; wa_id?: string; error?: string }> {
  try {
    const res = await fetch(`${META}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, wa_id: data?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "fetch failed" };
  }
}

function clip(s: string, n = 140) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function sendOne(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  action: BotAction,
): Promise<SendOutcome> {
  switch (action.kind) {
    case "text": {
      const body = (action.body ?? "").slice(0, 3500);
      const r = await postMessage(phoneNumberId, accessToken, {
        to,
        type: "text",
        text: { body, preview_url: true },
      });
      return { ...r, preview: clip(body), type: "text" };
    }
    case "link": {
      const txt = [action.caption?.trim(), action.url].filter(Boolean).join("\n").slice(0, 3500);
      const r = await postMessage(phoneNumberId, accessToken, {
        to,
        type: "text",
        text: { body: txt, preview_url: true },
      });
      return { ...r, preview: clip(txt), type: "text" };
    }
    case "image": {
      const r = await postMessage(phoneNumberId, accessToken, {
        to,
        type: "image",
        image: { link: action.url, caption: action.caption?.slice(0, 1024) },
      });
      return { ...r, preview: clip(action.caption || "📷 Imagen"), type: "image" };
    }
    case "document": {
      const r = await postMessage(phoneNumberId, accessToken, {
        to,
        type: "document",
        document: {
          link: action.url,
          filename: action.filename || undefined,
          caption: action.caption?.slice(0, 1024),
        },
      });
      return {
        ...r,
        preview: clip(`📎 ${action.filename || action.caption || action.url}`),
        type: "document",
      };
    }
    case "poll": {
      const opts = (action.options ?? []).filter((o) => o && o.trim()).slice(0, 10);
      if (opts.length === 0) {
        return { ok: false, error: "poll sin opciones", preview: action.question, type: "text" };
      }
      const question = (action.question ?? "").slice(0, 1024);
      if (opts.length <= 3) {
        const r = await postMessage(phoneNumberId, accessToken, {
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: question },
            action: {
              buttons: opts.map((title, i) => ({
                type: "reply",
                reply: { id: `opt_${i}`, title: title.slice(0, 20) },
              })),
            },
          },
        });
        return { ...r, preview: clip(`📊 ${question}`), type: "interactive" };
      }
      const r = await postMessage(phoneNumberId, accessToken, {
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: question },
          action: {
            button: "Ver opciones",
            sections: [
              {
                title: "Opciones",
                rows: opts.map((title, i) => ({
                  id: `opt_${i}`,
                  title: title.slice(0, 24),
                })),
              },
            ],
          },
        },
      });
      return { ...r, preview: clip(`📊 ${question}`), type: "interactive" };
    }
    case "catalog": {
      const items = (action.items ?? []).slice(0, 10);
      if (items.length === 0) {
        return { ok: false, error: "catálogo vacío", preview: "Catálogo", type: "text" };
      }
      // Header text if title
      let lastRes: { ok: boolean; wa_id?: string; error?: string } = { ok: true };
      if (action.title?.trim()) {
        lastRes = await postMessage(phoneNumberId, accessToken, {
          to,
          type: "text",
          text: { body: action.title.slice(0, 1000), preview_url: false },
        });
      }
      // Each item: image (if present) with caption containing name+price+url
      for (const it of items) {
        const captionLines = [
          `*${it.name}*`,
          it.price ? `💰 ${it.price}` : null,
          it.url || null,
        ].filter(Boolean) as string[];
        const caption = captionLines.join("\n").slice(0, 1024);

        if (it.image_url) {
          lastRes = await postMessage(phoneNumberId, accessToken, {
            to,
            type: "image",
            image: { link: it.image_url, caption },
          });
        } else {
          lastRes = await postMessage(phoneNumberId, accessToken, {
            to,
            type: "text",
            text: { body: caption, preview_url: true },
          });
        }
      }
      return {
        ...lastRes,
        preview: clip(`🛍 Catálogo (${items.length} ${items.length === 1 ? "producto" : "productos"})`),
        type: "catalog",
      };
    }
  }
}

export async function sendBotActions(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  actions: BotAction[],
): Promise<SendOutcome[]> {
  const out: SendOutcome[] = [];
  for (const a of actions) {
    const r = await sendOne(phoneNumberId, accessToken, to, a);
    out.push(r);
    if (!r.ok) break;
  }
  return out;
}

/** Normalize a rule row into a list of actions. Backwards-compatible with response_text. */
export function ruleToActions(rule: {
  actions?: unknown;
  response_text?: string | null;
}): BotAction[] {
  const arr = Array.isArray(rule.actions) ? (rule.actions as BotAction[]) : [];
  if (arr.length > 0) return arr;
  const t = (rule.response_text ?? "").trim();
  if (!t) return [];
  return [{ kind: "text", body: t }];
}
