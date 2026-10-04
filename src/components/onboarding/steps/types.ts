import type { FieldErrors, FormState } from "../formState";

export interface StepProps {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
  errors: FieldErrors;
}
