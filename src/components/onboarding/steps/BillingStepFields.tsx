import { TextField } from "../Field";
import type { TextField as TextKey } from "../formState";
import type { StepProps } from "./types";

/** Paso 1: datos para la factura y persona de contacto. */
export function BillingStepFields({ state, update, errors }: StepProps) {
  const bind = (key: TextKey) => ({
    id: `onb-${key}`,
    value: state[key],
    onChange: (value: string) => update({ [key]: value }),
    error: errors[key],
  });
  return (
    <div className="space-y-5">
      <TextField
        {...bind("razon_social")}
        label="Razón social o nombre del negocio"
        maxLength={200}
        autoComplete="organization"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          {...bind("rut")}
          label="RUT de la empresa"
          optional
          maxLength={20}
          placeholder="76.123.456-7"
          hint="Con o sin puntos y guion."
        />
        <TextField
          {...bind("giro")}
          label="Giro"
          optional
          maxLength={200}
          placeholder="Ej. venta de muebles"
        />
      </div>
      <TextField
        {...bind("direccion")}
        label="Dirección comercial"
        optional
        maxLength={300}
        autoComplete="street-address"
      />
      <TextField
        {...bind("email_facturacion")}
        label="Email para facturas"
        optional
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        hint="Aquí te llegarán las facturas y comprobantes."
      />
      <fieldset className="space-y-5 rounded-app-lg border border-border-subtle p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          ¿Con quién hablamos en el día a día?
        </legend>
        <TextField
          {...bind("contacto_nombre")}
          label="Nombre"
          optional
          maxLength={120}
          autoComplete="name"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            {...bind("contacto_telefono")}
            label="Teléfono / WhatsApp"
            optional
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="+56 9 1234 5678"
          />
          <TextField
            {...bind("contacto_email")}
            label="Email"
            optional
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
          />
        </div>
      </fieldset>
    </div>
  );
}
