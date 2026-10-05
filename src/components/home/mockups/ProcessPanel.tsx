import { Check } from "lucide-react";
import { Bar } from "./parts";
import { PhotoSlot } from "./PhotoSlot";
import { PROCESS_PHOTO } from "./photo-slots";
import { SWATCHES, vars } from "./tokens";

const CALENDAR_DAYS = 14;
/** Days with a planned post and the swatch used for its chip. */
const PLANNED: Record<number, number> = { 1: 0, 3: 1, 5: 2, 8: 3, 10: 4, 12: 5 };
const BAR_HEIGHTS = ["40%", "55%", "48%", "70%", "62%", "85%"];

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-background/70 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Client-panel illustration for "Cómo es trabajar con nosotros" (generic labels only). */
export function ProcessPanel() {
  return (
    <div className="relative mx-auto mt-10 max-w-5xl">
      <PhotoSlot
        images={[PROCESS_PHOTO]}
        sizes="(min-width: 1024px) 1024px, 100vw"
        className="aspect-[16/9] rounded-3xl md:aspect-[21/9]"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent"
        />
      </PhotoSlot>
      <div
        aria-hidden
        className="relative mx-3 -mt-16 max-w-4xl rounded-3xl border bg-card/95 p-3 shadow-xl shadow-[color:var(--brand-1)]/10 backdrop-blur md:mx-auto md:-mt-32 md:p-4"
      >
        <div className="flex items-center gap-1.5 px-1 pb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-2)]/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-3)]/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-1)]/60" />
          <span className="ml-3 text-xs font-medium text-muted-foreground">Tu panel</span>
        </div>
        <div data-reveal-stagger className="grid gap-3 md:grid-cols-3">
          <PanelCard title="Calendario de contenido">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: CALENDAR_DAYS }, (_, day) => {
                const swatch = PLANNED[day];
                return (
                  <span
                    key={day}
                    className="grid aspect-square place-items-center rounded-md bg-secondary"
                  >
                    {swatch !== undefined && (
                      <span
                        className="mk-loop h-2/3 w-2/3 rounded-sm"
                        style={{
                          ...vars({ "--i": swatch, "--gap": "0.4s" }),
                          background: SWATCHES[swatch],
                        }}
                      />
                    )}
                  </span>
                );
              })}
            </div>
          </PanelCard>
          <PanelCard title="Aprobación">
            <div className="flex gap-3">
              <span className="h-16 w-16 shrink-0 rounded-xl" style={{ background: SWATCHES[0] }} />
              <div className="flex flex-1 flex-col justify-between">
                <div className="space-y-1.5">
                  <Bar w="90%" />
                  <Bar w="60%" />
                </div>
                <div className="grid text-xs font-semibold">
                  <span className="mk-swap-a [grid-area:1/1] justify-self-start rounded-full border px-3 py-1">
                    Aprobar
                  </span>
                  <span className="mk-swap-b [grid-area:1/1] inline-flex items-center gap-1 justify-self-start rounded-full bg-[color:var(--brand-1)]/12 px-3 py-1 text-[color:var(--brand-1)]">
                    <Check className="h-3.5 w-3.5" /> Aprobado
                  </span>
                </div>
              </div>
            </div>
          </PanelCard>
          <PanelCard title="Reporte mensual">
            <div className="flex h-16 items-end gap-2 border-b border-foreground/10 pb-px">
              {BAR_HEIGHTS.map((h, i) => (
                <span
                  key={h}
                  className="mk-bar flex-1 rounded-t-md bg-gradient-brand"
                  style={{ ...vars({ "--i": i }), height: h }}
                />
              ))}
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
