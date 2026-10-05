import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronRight, PanelRightOpen } from "lucide-react";
import { BarePanelProvider, InfoHint } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SECTION_ID_ATTR } from "./useFichaAutoFit";

type Tone = "default" | "warning";

const TONE_CLS: Readonly<Record<Tone, string>> = {
  default: "border-border-subtle bg-surface",
  warning: "border-warning/40 bg-warning-subtle",
};

interface SectionHeadProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  info?: ReactNode;
  summary?: ReactNode;
}

function HeadLabel({
  title,
  icon: Icon,
  summary,
  lead,
}: Omit<SectionHeadProps, "info"> & { lead: ReactNode }) {
  return (
    <>
      {lead}
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 shrink-[0.01] truncate text-sm font-semibold text-foreground">
        {title}
      </span>
      {summary !== undefined && summary !== null && summary !== false && (
        <span className="min-w-0 shrink-[100] truncate text-xs font-normal text-muted-foreground">
          <span aria-hidden>· </span>
          {summary}
        </span>
      )}
    </>
  );
}

const ACTIONS_CLS =
  "flex shrink-0 items-center gap-1.5 [&_a]:text-xs [&_button]:h-7 [&_button]:px-2 [&_button]:text-xs";

const HEAD_BUTTON_CLS =
  "flex w-full min-w-0 items-center gap-2 rounded-app-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Panel lateral con el detalle o el formulario completo de una sección. */
export interface FichaSectionSheet {
  /** Texto del botón del encabezado ("Editar", "Ver todo"…). */
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Solo el ícono (el texto queda como etiqueta accesible y tooltip). */
  iconOnly?: boolean;
  description?: ReactNode;
  wide?: boolean;
  content: ReactNode;
}

export interface FichaSectionProps extends SectionHeadProps {
  /** Id para recordar si está abierta y plegarla sola si no cabe. */
  sectionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Abierta, ocupa el alto libre de la columna (listas con `FitList`). */
  grow?: boolean;
  tone?: Tone;
  sheet?: FichaSectionSheet;
  children: ReactNode;
}

/**
 * Sección plegable de la ficha: encabezado de una línea (título, "i", acciones
 * y, plegada, un resumen) y cuerpo con su contenido clave; un `Panel` adentro
 * va en modo compacto y sus acciones se dibujan en el encabezado. Con `sheet`,
 * el detalle o el formulario completo se abre en un panel lateral. Las listas
 * (`grow`) llenan el alto libre; lo demás ocupa su alto natural y, si la
 * columna no cabe, la ficha pliega secciones por prioridad (`useFichaAutoFit`).
 */
export function FichaSection({
  sectionId,
  title,
  icon,
  info,
  summary,
  open,
  onOpenChange,
  grow = false,
  tone = "default",
  sheet,
  children,
}: FichaSectionProps) {
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const SheetIcon = sheet?.icon;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <section
        aria-label={title}
        {...(sectionId ? { [SECTION_ID_ATTR]: sectionId } : {})}
        className={cn(
          "flex min-w-0 flex-col rounded-app-lg border shadow-app-xs",
          TONE_CLS[tone],
          open && grow ? "md:min-h-36 md:flex-1 md:basis-0" : "shrink-0",
        )}
      >
        <div className="flex min-h-9 shrink-0 items-center gap-1.5 px-3 py-1">
          <h2 className="min-w-0 flex-1">
            <CollapsibleTrigger asChild>
              <button type="button" className={HEAD_BUTTON_CLS}>
                <HeadLabel
                  title={title}
                  icon={icon}
                  summary={open ? undefined : summary}
                  lead={
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-90",
                      )}
                    />
                  }
                />
              </button>
            </CollapsibleTrigger>
          </h2>
          {info && <InfoHint label={`Información sobre ${title}`}>{info}</InfoHint>}
          <div
            ref={setActionsSlot}
            className={cn(ACTIONS_CLS, "empty:hidden", !open && "hidden")}
          />
          {sheet && (
            <div className={ACTIONS_CLS}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-haspopup="dialog"
                aria-label={sheet.iconOnly ? sheet.label : undefined}
                title={sheet.iconOnly ? sheet.label : undefined}
                onClick={() => setSheetOpen(true)}
              >
                {SheetIcon && (
                  <SheetIcon aria-hidden className={cn("h-3.5 w-3.5", !sheet.iconOnly && "mr-1")} />
                )}
                {!sheet.iconOnly && sheet.label}
              </Button>
            </div>
          )}
        </div>
        <CollapsibleContent
          className={cn("min-w-0 px-3 pb-2.5", grow && "md:flex md:min-h-0 md:flex-1 md:flex-col")}
        >
          <BarePanelProvider actionsSlot={actionsSlot} fill={grow}>
            {children}
          </BarePanelProvider>
        </CollapsibleContent>
        {sheet && (
          <FichaSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title={title}
            info={info}
            description={sheet.description}
            wide={sheet.wide}
          >
            {sheet.content}
          </FichaSheet>
        )}
      </section>
    </Collapsible>
  );
}

export interface FichaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  info?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

/** Panel lateral con el contenido completo de una sección (Panel en modo compacto). */
export function FichaSheet({
  open,
  onOpenChange,
  title,
  info,
  description,
  children,
  wide,
}: FichaSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full flex-col gap-0 p-0", wide ? "sm:max-w-xl" : "sm:max-w-md")}
      >
        <SheetHeader className="border-b px-6 pb-3 pt-6 text-left">
          <SheetTitle className="flex items-center gap-1.5 pr-6">
            {title}
            {info && (
              <InfoHint label={`Información sobre ${title}`} side="bottom">
                {info}
              </InfoHint>
            )}
          </SheetTitle>
          <SheetDescription className={cn(!description && "sr-only")}>
            {description ?? title}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <BarePanelProvider>{children}</BarePanelProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export interface FichaSheetSectionProps extends SectionHeadProps {
  tone?: Tone;
  wide?: boolean;
  sheetDescription?: ReactNode;
  children: ReactNode;
}

/**
 * Sección cuyo contenido no cabe en la columna (formularios, datos largos):
 * se ve como una fila plegada con su resumen y abre el contenido en un panel lateral.
 */
export function FichaSheetSection({
  title,
  icon,
  info,
  summary,
  tone = "default",
  wide,
  sheetDescription,
  children,
}: FichaSheetSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <section
      aria-label={title}
      className={cn("shrink-0 rounded-app-lg border shadow-app-xs", TONE_CLS[tone])}
    >
      <div className="flex min-h-9 items-center gap-1.5 px-3 py-1">
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            className={HEAD_BUTTON_CLS}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            <HeadLabel
              title={title}
              icon={icon}
              summary={summary}
              lead={
                <PanelRightOpen aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              }
            />
          </button>
        </h2>
        {info && <InfoHint label={`Información sobre ${title}`}>{info}</InfoHint>}
      </div>
      <FichaSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        info={info}
        description={sheetDescription}
        wide={wide}
      >
        {children}
      </FichaSheet>
    </section>
  );
}
