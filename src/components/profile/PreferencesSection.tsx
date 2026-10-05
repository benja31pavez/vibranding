import { ProfileField } from "./ProfileField";

const APP_TIME_ZONE = "America/Santiago";

/** Preferencias fijas de la plataforma (solo lectura). */
export function PreferencesSection() {
  return (
    <div className="flex h-full flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Vibranding trabaja con estos valores para todos los clientes; no se pueden cambiar.
      </p>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <ProfileField
          id="pref-timezone"
          label="Zona horaria"
          value={`${APP_TIME_ZONE} (hora de Chile)`}
          readOnly
          hint="Agenda, recordatorios y reportes usan esta hora."
        />
        <ProfileField
          id="pref-currency"
          label="Moneda"
          value="CLP · Peso chileno"
          readOnly
          hint="Precios, cobros y contratos en pesos, sin decimales."
        />
        <ProfileField id="pref-language" label="Idioma" value="Español (Chile)" readOnly />
        <ProfileField id="pref-date" label="Formato de fecha" value="dd-mm-aaaa" readOnly />
      </div>
    </div>
  );
}
