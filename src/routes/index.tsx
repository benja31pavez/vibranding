import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Instagram, Megaphone, BarChart3, ArrowRight, Check, Mail,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Viralitycs — Crece en Instagram y Meta Ads con propuestas claras" },
      { name: "description", content: "Viralitycs te ayuda a planear, presentar y ejecutar estrategias de Instagram y campañas de Meta Ads para tus clientes, todo en un mismo lugar." },
      { property: "og:title", content: "Viralitycs — Plataforma para crecer en Instagram y Meta Ads" },
      { property: "og:description", content: "Propuestas visuales de Instagram, gestión de campañas Meta Ads y reportes para tus clientes." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen" />;
  if (session) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-primary text-primary-foreground grid place-items-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Viralitycs</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <a href="#servicios" className="text-muted-foreground hover:text-foreground">Servicios</a>
          <a href="#como" className="text-muted-foreground hover:text-foreground">Cómo funciona</a>
          <a href="#contacto" className="text-muted-foreground hover:text-foreground">Contacto</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:inline">Iniciar sesión</Link>
          <Button asChild size="sm" className="rounded-full">
            <a href="#contacto">Contactar <ArrowRight className="w-4 h-4 ml-1" /></a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 pt-12 md:pt-24 pb-20 md:pb-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Especialistas en Instagram y Meta Ads
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-4xl mx-auto">
          Hacemos que tu marca <span className="text-primary">se vuelva viral</span>.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          En Viralitycs combinamos diseño, estrategia y publicidad pagada para
          convertir tu Instagram en una máquina de captar clientes.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-8 h-12 text-base">
            <a href="#contacto">Hablemos de tu marca <ArrowRight className="w-4 h-4 ml-1" /></a>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-8 h-12 text-base">
            <a href="#servicios">Ver servicios</a>
          </Button>
        </div>
      </section>

      {/* Services */}
      <section id="servicios" className="max-w-7xl mx-auto px-6 md:px-10 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Lo que hacemos</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Una propuesta completa para crecer con intención y datos.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Instagram, title: "Estrategia de Instagram", desc: "Auditoría de perfil, rediseño visual, calendario de contenido y propuestas con vista previa estilo iPhone." },
            { icon: Megaphone, title: "Meta Ads", desc: "Campañas de Facebook e Instagram Ads: creatividades, segmentación, presupuesto y optimización." },
            { icon: BarChart3, title: "Reportes claros", desc: "Métricas, objetivos y entregables visibles para tu cliente. PDFs listos para presentar." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-3xl border bg-card p-7 hover:shadow-lg transition-shadow">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como" className="bg-secondary/40 py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Cómo trabajamos</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: "01", t: "Diagnóstico", d: "Analizamos tu marca, tu público y tu competencia." },
              { n: "02", t: "Propuesta", d: "Te entregamos una visión clara con objetivos, contenido y campañas." },
              { n: "03", t: "Ejecución", d: "Producimos, publicamos, anunciamos y medimos resultados." },
            ].map((s) => (
              <div key={s.n} className="rounded-3xl bg-card border p-7">
                <div className="text-sm text-primary font-semibold tracking-widest">{s.n}</div>
                <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA contact */}
      <section id="contacto" className="max-w-4xl mx-auto px-6 md:px-10 py-24 text-center">
        <h2 className="text-4xl md:text-6xl font-semibold tracking-tight">
          ¿Listo para volverte viral?
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Cuéntanos sobre tu marca y te respondemos con una propuesta personalizada.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-8 h-12 text-base">
            <a href="mailto:hola@viralitycs.com?subject=Quiero%20crecer%20con%20Viralitycs">
              <Mail className="w-4 h-4 mr-2" /> hola@viralitycs.com
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-8 h-12 text-base">
            <a href="https://wa.me/" target="_blank" rel="noreferrer">Escríbenos por WhatsApp</a>
          </Button>
        </div>
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> Respuesta en 24h</li>
          <li className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> Sin compromiso</li>
          <li className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> Plan a tu medida</li>
        </ul>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Viralitycs. Todos los derechos reservados.
      </footer>
    </div>
  );
}
