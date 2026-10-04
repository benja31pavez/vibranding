import { createFileRoute, redirect } from "@tanstack/react-router";

/** Calendario se unificó en la Agenda. */
export const Route = createFileRoute("/_app/calendar")({
  beforeLoad: () => {
    throw redirect({ to: "/agenda", replace: true });
  },
});
