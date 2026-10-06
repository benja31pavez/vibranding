import type { ReactNode } from "react";
import { BarePanelProvider, InfoHint } from "@/components/app";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
