import { createFileRoute, redirect } from "@tanstack/react-router";

/** Alias en español: redirección permanente a /privacy. */
export const Route = createFileRoute("/privacidad")({
  beforeLoad: () => {
    throw redirect({ to: "/privacy", statusCode: 301 });
  },
});
