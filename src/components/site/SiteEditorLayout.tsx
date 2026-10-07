import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SaveStatus, type SaveState } from "@/components/site/SaveStatus";

/**
 * Piezas de layout compartidas por los editores de Multienlace y Landing:
 * una sola barra de pestañas, editor con scroll interno + vista previa fija
 * (desde `md` todo cabe en una pantalla) y barra de guardado al pie del editor.
 */

/** Barra única: cambio de página (Multienlace / Landing) + vistas del editor activo. */
export function SiteNav({
  pageSwitcher,
  children,
}: {
  pageSwitcher?: React.ReactNode;
  /** `SiteViewTab`s del editor activo (se omiten en solo lectura). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
      {pageSwitcher}
      {pageSwitcher && children && (
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
      )}
      {children && (
        <TabsList aria-label="Vistas del editor" className="h-auto flex-wrap bg-transparent p-0">
          {children}
        </TabsList>
      )}
    </div>
  );
}

/** Pestaña de vista: más liviana que la de página para que se lean dos niveles. */
export function SiteViewTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="gap-1.5 px-2.5 text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:underline data-[state=active]:decoration-2 data-[state=active]:underline-offset-[6px]"
    >
      {children}
    </TabsTrigger>
  );
}

/** Contenido de pestaña que llena el alto restante (desde `md`). */
export function SitePane({
  value,
  forceMount,
  className,
  children,
}: {
  value: string;
  forceMount?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsContent
      value={value}
      forceMount={forceMount ? true : undefined}
      className={cn("mt-0 data-[state=inactive]:hidden md:min-h-0 md:flex-1", className)}
    >
      {children}
    </TabsContent>
  );
}

/** Columna con scroll interno (pestañas sin vista previa: ajustes, mensajes, métricas). */
export function ScrollColumn({
  children,
  footer,
  className,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col md:h-full md:min-h-0", className)}>
      <div className="space-y-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-2">{children}</div>
      {footer && <div className="sticky bottom-3 z-20 md:static md:pr-2">{footer}</div>}
    </div>
  );
}

/**
 * Editor a la izquierda (scroll interno + barra de guardado al pie) y vista
 * previa fija a la derecha a todo el alto. En escritorio la vista previa en
 * modo "Escritorio" ocupa más ancho.
 */
export function EditorSplit({
  editor,
  footer,
  preview,
  widePreview,
}: {
  editor: React.ReactNode;
  footer: React.ReactNode;
  preview: React.ReactNode;
  widePreview?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-6 md:h-full md:min-h-0",
        widePreview
          ? "md:grid-cols-[minmax(440px,1fr)_minmax(0,1.2fr)]"
          : "md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]",
      )}
    >
      <ScrollColumn footer={footer}>{editor}</ScrollColumn>
      <div className="min-w-0 md:h-full md:min-h-0">{preview}</div>
    </div>
  );
}

/** Solo lectura: vista previa grande, centrada, sin controles de edición. */
export function ReadOnlyPreview({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl md:h-full md:min-h-0">{children}</div>;
}

/**
 * Barra de guardado al pie de la columna del editor: no tapa contenido ni la
 * vista previa. En móvil queda pegada abajo mientras se hace scroll.
 */
export function SaveBar({
  state,
  detail,
  dirty,
  saving,
  onDiscard,
  onSave,
}: {
  state: SaveState;
  detail: string | null;
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className={cn(
        "mt-3 flex shrink-0 flex-wrap items-center gap-3 rounded-app-lg border px-4 py-2.5 shadow-app-xs backdrop-blur",
        dirty ? "border-warning/40 bg-warning-subtle/60" : "border-border-subtle bg-surface/95",
      )}
    >
      <SaveStatus state={state} detail={detail} />
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={!dirty || saving}>
          Descartar
        </Button>
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          <Save className="mr-1 h-4 w-4" aria-hidden="true" /> Guardar
          <kbd className="ml-2 hidden rounded border border-primary-foreground/30 px-1 text-xs sm:inline">
            ⌘S
          </kbd>
        </Button>
      </div>
    </div>
  );
}
