import { useState, type ComponentType, type ReactNode } from "react";
import { Building2, KeyRound, SlidersHorizontal, UserRound } from "lucide-react";
import { ErrorState, FitPage, ListSkeleton, PageHeader } from "@/components/app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { AGENCY_DEFAULTS } from "@/lib/pricing/plans";
import { AgencySection } from "./AgencySection";
import { PersonalSection } from "./PersonalSection";
import { DEFAULT_JOB_TITLE, initialsOf } from "./profileUtils";
import { PreferencesSection } from "./PreferencesSection";
import { SecuritySection } from "./SecuritySection";
import {
  useAgencyProfile,
  useOwnerProfile,
  type AgencyProfile,
  type OwnerProfile,
} from "./profileData";

type SectionKey = "personal" | "agency" | "security" | "preferences";

const SECTIONS: ReadonlyArray<{
  key: SectionKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    key: "personal",
    label: "Datos personales",
    description: "Tu foto, nombre, cargo y contacto.",
    icon: UserRound,
  },
  {
    key: "agency",
    label: "Agencia",
    description: "Datos legales y comerciales que usan tus contratos.",
    icon: Building2,
  },
  {
    key: "security",
    label: "Seguridad",
    description: "Contraseña de acceso.",
    icon: KeyRound,
  },
  {
    key: "preferences",
    label: "Preferencias",
    description: "Zona horaria y moneda de la plataforma.",
    icon: SlidersHorizontal,
  },
];

/** Ruta /profile: perfil del dueño y de la agencia en una pantalla, por secciones. */
export function ProfilePage() {
  const { user } = useAuth();
  const owner = useOwnerProfile();
  const agency = useAgencyProfile();
  return (
    <ProfileView
      userId={user?.id ?? ""}
      email={user?.email ?? ""}
      owner={{ data: owner.data, error: owner.error, retry: () => void owner.refetch() }}
      agency={{ data: agency.data, error: agency.error, retry: () => void agency.refetch() }}
    />
  );
}

interface Loadable<T> {
  data: T | undefined;
  error: Error | null;
  retry: () => void;
}

interface ProfileViewProps {
  userId: string;
  email: string;
  owner: Loadable<OwnerProfile>;
  agency: Loadable<AgencyProfile>;
  defaultSection?: SectionKey;
}

export function ProfileView({
  userId,
  email,
  owner,
  agency,
  defaultSection = "personal",
}: ProfileViewProps) {
  const [section, setSection] = useState<SectionKey>(defaultSection);
  const current = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];

  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Editar perfil"
          description="Tus datos, los de la agencia, tu contraseña y las preferencias de la plataforma."
        />
      }
    >
      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as SectionKey)}
        orientation="vertical"
        className="grid gap-4 md:h-full md:min-h-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6"
      >
        <aside className="flex min-w-0 flex-col gap-3">
          <IdentityCard email={email} owner={owner.data} agency={agency.data} />
          <TabsList
            aria-label="Secciones del perfil"
            className="grid h-auto w-full grid-cols-2 gap-1 rounded-app-lg border border-border-subtle bg-surface p-1 md:flex md:flex-col md:items-stretch"
          >
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <TabsTrigger
                key={key}
                value={key}
                className="min-w-0 justify-start gap-2 px-3 py-2 data-[state=active]:bg-surface-2 data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        <section
          aria-labelledby="profile-section-title"
          className="flex min-w-0 flex-col rounded-app-lg border border-border-subtle bg-surface shadow-app-xs md:min-h-0"
        >
          <div className="shrink-0 border-b border-border-subtle px-5 py-3">
            <h2 id="profile-section-title" className="text-base font-semibold">
              {current.label}
            </h2>
            <p className="text-xs text-muted-foreground">{current.description}</p>
          </div>
          <div className="min-h-0 flex-1 px-5 py-4 md:overflow-y-auto">
            <TabsContent value="personal" className="mt-0 h-full">
              <Loaded state={owner} label="Cargando tu perfil">
                {(data) => <PersonalSection userId={userId} email={email} profile={data} />}
              </Loaded>
            </TabsContent>
            <TabsContent value="agency" className="mt-0 h-full">
              <Loaded state={agency} label="Cargando los datos de la agencia">
                {(data) => <AgencySection userId={userId} agency={data} />}
              </Loaded>
            </TabsContent>
            <TabsContent value="security" className="mt-0 h-full">
              <SecuritySection email={email} />
            </TabsContent>
            <TabsContent value="preferences" className="mt-0 h-full">
              <PreferencesSection />
            </TabsContent>
          </div>
        </section>
      </Tabs>
    </FitPage>
  );
}

function Loaded<T>({
  state,
  label,
  children,
}: {
  state: Loadable<T>;
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.retry} />;
  if (state.data === undefined) return <ListSkeleton rows={4} label={label} />;
  return <>{children(state.data)}</>;
}

function IdentityCard({
  email,
  owner,
  agency,
}: {
  email: string;
  owner: OwnerProfile | undefined;
  agency: AgencyProfile | undefined;
}) {
  const name = owner?.full_name?.trim() || "Sin nombre";
  const role = owner?.job_title?.trim() || DEFAULT_JOB_TITLE;
  const agencyName = agency?.values.agency_legal_name.trim() || AGENCY_DEFAULTS.legal_name;
  return (
    <div className="flex items-center gap-3 rounded-app-lg border border-border-subtle bg-surface p-3 shadow-app-xs">
      <Avatar className="h-12 w-12 border bg-surface-2">
        {owner?.avatar_url && <AvatarImage src={owner.avatar_url} alt="" />}
        <AvatarFallback>{initialsOf(owner?.full_name ?? "", email || "?")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold leading-tight">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {role} · {agencyName}
        </p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
    </div>
  );
}
