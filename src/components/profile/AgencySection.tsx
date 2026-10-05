import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AGENCY_DEFAULTS } from "@/lib/pricing/plans";
import { SITE_URL } from "@/lib/site";
import { ProfileField, SectionFooter } from "./ProfileField";
import {
  PENDING_MIGRATION_HINT,
  normalizeAgency,
  validateAgency,
  type AgencyErrors,
} from "./profileUtils";
import {
  profileKeys,
  saveAgencyProfile,
  type AgencyField,
  type AgencyProfile,
  type AgencyValues,
} from "./profileData";

interface AgencySectionProps {
  userId: string;
  agency: AgencyProfile;
}

/** Datos de la agencia (los mismos que usan los contratos). */
export function AgencySection({ userId, agency }: AgencySectionProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<AgencyValues>(agency.values);
  const [errors, setErrors] = useState<AgencyErrors>({});
  const [saving, setSaving] = useState(false);
  const ext = agency.hasExtended;

  const field = (f: AgencyField) => ({
    value: values[f],
    error: errors[f] ?? null,
    onChange: (value: string) => {
      setValues((prev) => ({ ...prev, [f]: value }));
      if (errors[f]) setErrors((prev) => ({ ...prev, [f]: undefined }));
    },
  });
  const extField = (f: AgencyField, hint?: string) => ({
    ...field(f),
    disabled: !ext,
    hint: ext ? hint : PENDING_MIGRATION_HINT,
  });

  const save = async () => {
    const found = validateAgency(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const normalized = normalizeAgency(values);
    setSaving(true);
    try {
      await saveAgencyProfile(agency.id, normalized, ext);
      setValues(normalized);
      await queryClient.invalidateQueries({ queryKey: profileKeys.agency(userId) });
      toast.success("Datos de la agencia actualizados", {
        description: "Los contratos nuevos usarán estos datos.",
      });
    } catch (err) {
      console.error("[profile] error al guardar la agencia", err);
      toast.error("No se pudieron guardar los datos de la agencia", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <ProfileField
          id="agency-legal-name"
          label="Razón social"
          placeholder={AGENCY_DEFAULTS.legal_name}
          maxLength={160}
          {...field("agency_legal_name")}
        />
        <ProfileField
          id="agency-tax-id"
          label="RUT"
          placeholder={AGENCY_DEFAULTS.tax_id}
          maxLength={14}
          {...field("agency_tax_id")}
        />
        <ProfileField
          id="agency-activity"
          label="Giro"
          placeholder="Publicidad y marketing digital"
          maxLength={200}
          {...extField("agency_business_activity")}
        />
        <ProfileField
          id="agency-address"
          label="Dirección comercial"
          placeholder={AGENCY_DEFAULTS.address}
          autoComplete="street-address"
          maxLength={200}
          {...field("agency_address")}
        />
        <ProfileField
          id="agency-email"
          label="Email comercial"
          type="email"
          placeholder="hola@vibranding.pro"
          autoComplete="email"
          maxLength={160}
          {...field("agency_email")}
        />
        <ProfileField
          id="agency-website"
          label="Sitio web"
          placeholder={SITE_URL.replace(/^https?:\/\//, "")}
          autoComplete="url"
          maxLength={200}
          {...extField("agency_website")}
        />
        <ProfileField
          id="agency-instagram"
          label="Instagram"
          placeholder="@vibranding"
          maxLength={31}
          {...extField("agency_instagram")}
        />
        <ProfileField
          id="agency-hours"
          label="Horario de atención"
          placeholder="Lun a vie, 9:00 a 18:00"
          maxLength={200}
          {...extField("agency_business_hours")}
        />
      </div>

      <div className="mt-auto">
        <SectionFooter note="Razón social, RUT, dirección y email aparecen en los contratos nuevos.">
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "Guardando…" : "Guardar datos de la agencia"}
          </Button>
        </SectionFooter>
      </div>
    </div>
  );
}
