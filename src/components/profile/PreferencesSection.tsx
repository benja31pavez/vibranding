import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveUserPrefs, userPrefsKey } from "@/hooks/use-user-prefs";
import { useLang } from "@/i18n/LanguageContext";
import { formatTimeInZone } from "@/lib/prefs/formatInZone";
import { DEFAULT_TIME_ZONE } from "@/lib/prefs/timezones";
import {
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  isPrefLanguage,
  prefsError,
  type LoadedPrefs,
  type UserPrefs,
} from "@/lib/prefs/userPrefs";
import { InfoHint } from "./InfoHint";
import { SectionFooter } from "./ProfileField";
import { PENDING_MIGRATION_HINT } from "./profileUtils";
import { TimeZoneCombobox } from "./TimeZoneCombobox";

const TIME_ZONE_INFO =
  "Las fechas de cobro, entregas y reportes siguen la hora de Chile (tus clientes están en Chile). Esta zona solo cambia cómo ves las horas en tu panel.";
const TIME_ZONE_SCOPE =
  "Se aplica a las horas de la Agenda y de «Próximos días» en Inicio (publicaciones programadas y alertas). Los días del calendario siguen siendo los de Chile.";
const LANGUAGE_INFO =
  "El panel de Vibranding está solo en español por ahora. El idioma elegido se aplica al sitio público (inicio, pie de página y páginas legales) en tu navegador.";

interface PreferencesSectionProps {
  userId: string;
  loaded: LoadedPrefs;
}

/** Preferencias personales: zona horaria e idioma editables; moneda y formato de fecha fijos. */
export function PreferencesSection({ userId, loaded }: PreferencesSectionProps) {
  const queryClient = useQueryClient();
  const { setLang } = useLang();
  const [draft, setDraft] = useState<UserPrefs>(loaded.prefs);
  const [saving, setSaving] = useState(false);
  const pending = !loaded.hasPrefs;
  const dirty =
    draft.timeZone !== loaded.prefs.timeZone || draft.language !== loaded.prefs.language;

  const save = async () => {
    const error = prefsError(draft);
    if (error) return toast.error(error);
    setSaving(true);
    try {
      await saveUserPrefs(userId, draft);
      setLang(draft.language);
      await queryClient.invalidateQueries({ queryKey: userPrefsKey(userId) });
      toast.success("Preferencias guardadas");
    } catch (err) {
      console.error("[prefs] error al guardar", err);
      toast.error("No se pudieron guardar las preferencias", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Ajustes personales de tu cuenta. No cambian lo que ven tus clientes.
      </p>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <PrefField
          id="pref-timezone"
          label="Zona horaria"
          info={
            <>
              <p>{TIME_ZONE_INFO}</p>
              <p className="mt-2 text-muted-foreground">{TIME_ZONE_SCOPE}</p>
            </>
          }
          hint={pending ? PENDING_MIGRATION_HINT : <NowHint timeZone={draft.timeZone} />}
        >
          <TimeZoneCombobox
            id="pref-timezone"
            value={draft.timeZone}
            onChange={(timeZone) => setDraft((d) => ({ ...d, timeZone }))}
            disabled={pending || saving}
            describedBy="pref-timezone-hint"
          />
        </PrefField>

        <PrefField
          id="pref-language"
          label="Idioma"
          info={<p>{LANGUAGE_INFO}</p>}
          hint={pending ? PENDING_MIGRATION_HINT : "El panel sigue en español."}
        >
          <Select
            value={draft.language}
            onValueChange={(v) => {
              if (isPrefLanguage(v)) setDraft((d) => ({ ...d, language: v }));
            }}
            disabled={pending || saving}
          >
            <SelectTrigger id="pref-language" aria-describedby="pref-language-hint">
              {/* Texto explícito: SelectValue queda vacío hasta montar el contenido (SSR). */}
              <SelectValue>
                {LANGUAGE_OPTIONS.find((o) => o.value === draft.language)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PrefField>

        <FixedSelect
          id="pref-currency"
          label="Moneda"
          options={CURRENCY_OPTIONS}
          hint="Precios, cobros y contratos en pesos, sin decimales."
        />
        <FixedSelect
          id="pref-date"
          label="Formato de fecha"
          options={DATE_FORMAT_OPTIONS}
          hint="Formato chileno, el mismo de contratos y reportes."
        />
      </div>
      <div className="mt-auto">
        <SectionFooter note={pending ? PENDING_MIGRATION_HINT : undefined}>
          <Button type="button" onClick={() => void save()} disabled={pending || saving || !dirty}>
            {saving && <Loader2 className="animate-spin" />}
            Guardar preferencias
          </Button>
        </SectionFooter>
      </div>
    </div>
  );
}

function PrefField({
  id,
  label,
  info,
  hint,
  children,
}: {
  id: string;
  label: string;
  info?: ReactNode;
  hint: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        {info && <InfoHint label={`Más información sobre ${label.toLowerCase()}`}>{info}</InfoHint>}
      </div>
      {children}
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

/** Desplegable con una sola opción: mismo aspecto que el resto, pero sin alternativas. */
function FixedSelect({
  id,
  label,
  options,
  hint,
}: {
  id: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  hint: string;
}) {
  return (
    <PrefField id={id} label={label} hint={hint}>
      <Select value={options[0].value}>
        <SelectTrigger id={id} aria-describedby={`${id}-hint`}>
          <SelectValue>{options[0].label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PrefField>
  );
}

function NowHint({ timeZone }: { timeZone: string }) {
  const now = new Date().toISOString();
  const local = formatTimeInZone(now, timeZone);
  if (timeZone === DEFAULT_TIME_ZONE) return <>Ahora son las {local} (hora de Chile).</>;
  return (
    <>
      Ahora son las {local} en esta zona · {formatTimeInZone(now, DEFAULT_TIME_ZONE)} en Chile.
    </>
  );
}
