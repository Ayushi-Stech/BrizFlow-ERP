import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { getToken } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Cheap client-side gate: a missing token means "definitely signed out".
    // An expired/invalid token still gets caught by AuthProvider's /auth/me
    // check and any 401 response, which redirects to /auth as well.
    if (!getToken()) throw redirect({ to: "/auth" });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
