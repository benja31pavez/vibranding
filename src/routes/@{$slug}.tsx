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

  return (
    <div className="min-h-screen">
      <PublicLandingView
        lp={lp as any}
        onCtaClick={() => trackEvent("contact_click", { type: "landing", id: lp.id })}
        onWhatsappClick={() => trackEvent("whatsapp_click", { type: "landing", id: lp.id })}
        contactForm={<ContactForm landingId={lp.id} clientId={lp.client_id} color={color} />}
      />
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
