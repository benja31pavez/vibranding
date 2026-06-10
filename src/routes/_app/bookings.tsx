import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/bookings")({
  beforeLoad: () => {
    throw redirect({ to: "/calendar" });
  },
});
