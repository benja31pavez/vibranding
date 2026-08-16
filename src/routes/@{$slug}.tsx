import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";

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
  message: z.string().trim().min(1, "Escribe un mensaje").max(2000),
});

function PublicLanding() {
  const { lp } = Route.useLoaderData();
  const color = lp.theme_color || "#6366f1";

  useEffect(() => { supabase.rpc("increment_landing_view", { _id: lp.id }); }, [lp.id]);

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
  const [form, setForm] = useState({ name: "", email: "", message: "" });
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
      message: parsed.data.message,
    });
    setSending(false);
    if (error) { toast.error("No se pudo enviar"); return; }
    setSent(true);
    setForm({ name: "", email: "", message: "" });
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
      <Textarea placeholder="Tu mensaje" rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} maxLength={2000} required />
      <Button type="submit" disabled={sending} className="w-full text-white" style={{ background: color }}>
        {sending ? "Enviando…" : "Enviar mensaje"}
      </Button>
    </form>
  );
}
