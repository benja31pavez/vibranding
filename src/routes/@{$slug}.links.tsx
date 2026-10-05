import { createFileRoute } from "@tanstack/react-router";
import { PublicMultilinkView } from "@/components/multilink/PublicMultilinkView";
import { loadPublicMultilink, publicMultilinkHead } from "@/lib/site/publicMultilink";

// Legacy URL. Kept working for links already printed or shared; /l/$slug is canonical.
export const Route = createFileRoute("/@{$slug}/links")({
  loader: ({ params }) => loadPublicMultilink(params.slug),
  head: ({ loaderData }) => publicMultilinkHead(loaderData),
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
        <p className="text-muted-foreground mt-2">Vuelve a intentarlo en unos segundos.</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <h1 className="text-3xl font-semibold">Página no encontrada</h1>
        <p className="text-muted-foreground mt-2">
          Este multienlace no existe o no está publicado.
        </p>
      </div>
    </div>
  ),
  component: LegacyPublicMultilink,
});

function LegacyPublicMultilink() {
  const { ml, items } = Route.useLoaderData();
  return <PublicMultilinkView ml={ml} items={items} />;
}
