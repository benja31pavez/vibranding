import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "./SiteFooter";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-brand text-3xl tracking-tight">Vibranding</span>
        </Link>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 md:px-10 py-12 md:py-20 w-full">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-3">Última actualización: {updated}</p>
        <article className="prose prose-neutral dark:prose-invert mt-10 max-w-none [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-base [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_li]:text-muted-foreground">
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
