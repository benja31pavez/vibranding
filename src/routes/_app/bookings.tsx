import { createFileRoute, redirect } from "@tanstack/react-router";

/** Reservas se unificó en la Agenda (pestaña "Mi link de reservas"). */
export const Route = createFileRoute("/_app/bookings")({
  beforeLoad: () => {
    throw redirect({ to: "/agenda", search: { tab: "reservas" }, replace: true });
  },
});
