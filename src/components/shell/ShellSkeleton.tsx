import { Skeleton } from "@/components/ui/skeleton";

const SIDEBAR_ROWS = 7;

/** Esqueleto del shell mientras se resuelve la sesión (evita la pantalla en blanco). */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando la plataforma…</span>
      <div className="flex h-14 items-center gap-3 border-b bg-sidebar px-4 md:px-6">
        <Skeleton className="h-6 w-28" />
        <div className="hidden flex-1 items-center gap-2 md:flex">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-20" />
          ))}
        </div>
        <Skeleton className="ml-auto h-8 w-8 rounded-full md:ml-0" />
      </div>
      <div className="flex flex-1">
        <div className="hidden w-60 shrink-0 space-y-3 border-r bg-sidebar p-3 md:block">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: SIDEBAR_ROWS }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="flex-1 space-y-4 p-4 md:p-8">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}
