import { createFileRoute, redirect } from "@tanstack/react-router";

/** Alias en español: redirección permanente a /terms. */
export const Route = createFileRoute("/terminos")({
  beforeLoad: () => {
    throw redirect({ to: "/terms", statusCode: 301 });
  },
});
