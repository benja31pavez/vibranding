import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";
import { trackEvent } from "@/lib/track";
import { landingWhatsappUrl } from "@/lib/landingWhatsapp";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/@{$slug}")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("landing_pages").select("*").eq("slug", params.slug).eq("published", true).maybeSingle();
    if (!data) throw notFound();
    return { lp: data };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: loaderData.lp.hero_title },
      { name: "description", content: loaderData.lp.hero_subtitle ?? loaderData.lp.hero_title },
      { property: "og:title", content: loaderData.lp.hero_title },
      { property: "og:description", content: loaderData.lp.hero_subtitle ?? "" },
      ...(loaderData.lp.hero_image_url ? [{ property: "og:image", content: loaderData.lp.hero_image_url }] : []),
    ] : [],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <h1 className="text-3xl font-semibold">Página no encontrada</h1>
        <p className="text-muted-foreground mt-2">Esta landing no existe o no está publicada.</p>
      </div>
    </div>
  ),
  component: PublicLanding,
});

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Ingresa tu nombre").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Escribe un mensaje").max(2000),
});

function PublicLanding() {
  const { lp } = Route.useLoaderData();
  const color = lp.theme_color || "#6366f1";

  useEffect(() => {
    trackEvent("page_view", { type: "landing", id: lp.id });
  }, [lp.id]);

  const waUrl = landingWhatsappUrl(lp as any);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight" style={{ color }}>
              {lp.hero_title}
            </h1>
            {lp.hero_subtitle && (
              <p className="mt-5 text-lg text-gray-600 whitespace-pre-line">{lp.hero_subtitle}</p>
            )}
            {lp.cta_text && (
              <a
                href={lp.cta_url || "#contacto"}
                className="inline-flex items-center mt-8 rounded-full px-7 py-3 font-medium text-white transition hover:opacity-90"
                style={{ background: color }}
                onClick={() => trackEvent("contact_click", { type: "landing", id: lp.id })}
                {...(lp.cta_url ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {lp.cta_text}
              </a>
            )}
          </div>
          {lp.hero_image_url && (
            <img src={lp.hero_image_url} alt="" className="w-full rounded-3xl shadow-2xl object-cover aspect-square" />
          )}
        </div>
      </section>

      {/* Services */}
      {Array.isArray(lp.services) && lp.services.length > 0 && (
        <section className="bg-gray-50 py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Servicios</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {(lp.services as any[]).map((s: any, i: number) => (
                <div key={i} className="rounded-2xl bg-white p-6 shadow-sm border">
                  <div className="w-10 h-10 rounded-lg mb-4" style={{ background: `${color}22` }} />
                  <h3 className="font-semibold text-lg" style={{ color }}>{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Gallery */}
      {Array.isArray(lp.gallery) && lp.gallery.length > 0 && (
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Galería</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(lp.gallery as any[]).map((g: any, i: number) => (
                <img key={i} src={g.url} alt="" className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WhatsApp CTA */}
      {waUrl && (
        <section className="py-16">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold">{(lp as any).whatsapp_cta_text || "Escríbenos por WhatsApp"}</h2>
            <p className="mt-3 text-gray-600">
              Te respondemos por WhatsApp con el mensaje ya listo para enviar.
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent("whatsapp_click", { type: "landing", id: lp.id })}
              className="inline-flex items-center gap-2 mt-7 rounded-full px-7 py-3 font-medium text-white transition hover:opacity-90"
              style={{ background: "#25D366" }}
            >
              <MessageCircle className="w-5 h-5" />
              {(lp as any).whatsapp_cta_text || "Escríbenos por WhatsApp"}
            </a>
          </div>
        </section>
      )}

      {/* Contact */}
      {lp.contact_enabled && (
        <section id="contacto" className="bg-gray-50 py-20">
          <div className="max-w-xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-2">Contáctanos</h2>
            <p className="text-center text-gray-600 mb-8">Te responderemos lo antes posible.</p>
            <ContactForm landingId={lp.id} clientId={lp.client_id} color={color} />
          </div>
        </section>
      )}

      <footer className="py-8 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {lp.hero_title}
      </footer>
    </div>
  );
}

function ContactForm({ landingId, clientId, color }: { landingId: string; clientId: string; color: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ContactSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSending(true);
    const { error } = await supabase.from("landing_contact_submissions").insert({
      landing_id: landingId,
      client_id: clientId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      message: parsed.data.message,
    });
    setSending(false);
    if (error) { toast.error("No se pudo enviar"); return; }
    trackEvent("contact_submit", { type: "landing", id: landingId });
    setSent(true);
    setForm({ name: "", email: "", phone: "", message: "" });
  };

  if (sent) {
    return (
      <div className="rounded-2xl bg-white p-8 border text-center">
        <h3 className="font-semibold text-lg" style={{ color }}>¡Mensaje enviado!</h3>
        <p className="text-sm text-gray-600 mt-2">Gracias por contactarnos.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-6 border space-y-3">
      <Input placeholder="Tu nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={100} required />
      <Input type="email" placeholder="Tu email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} maxLength={255} required />
      <Input type="tel" placeholder="Tu teléfono (opcional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} maxLength={40} />
      <Textarea placeholder="Tu mensaje" rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} maxLength={2000} required />
      <Button type="submit" disabled={sending} className="w-full text-white" style={{ background: color }}>
        {sending ? "Enviando…" : "Enviar mensaje"}
      </Button>
    </form>
  );
}
