import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { api, ApiError, getToken, setToken, setUnauthorizedHandler } from "@/lib/api";

export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SALES: "Sales",
  WAREHOUSE: "Warehouse",
  ACCOUNTS: "Accounts",
};

type AuthUser = { id: string; name: string; email: string; role: Role };

type AuthState = {
  user: AuthUser | null;
  name: string;
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  canManageCustomers: boolean;
  canManageProducts: boolean;
  canManageChallans: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, role: Role) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<{ user: AuthUser }>("/auth/me");
        if (active) setUser(res.user);
      } catch {
        setToken(null);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void bootstrap();

    setUnauthorizedHandler(() => {
      setUser(null);
      queryClient.clear();
      void router.navigate({ to: "/auth" });
    });

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, [queryClient, router]);

  const value = useMemo<AuthState>(() => {
    const roles: Role[] = user ? [user.role] : [];
    const has = (role: Role) => roles.includes(role);
    return {
      user,
      name: user?.name ?? "",
      roles,
      loading,
      isAdmin: has("ADMIN"),
      canManageCustomers: has("ADMIN") || has("SALES"),
      canManageProducts: has("ADMIN") || has("WAREHOUSE"),
      canManageChallans: has("ADMIN") || has("SALES"),
      signIn: async (email, password) => {
        const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
          email,
          password,
        });
        setToken(res.token);
        setUser(res.user);
        router.invalidate();
        queryClient.clear();
      },
      signUp: async (name, email, password, role) => {
        const res = await api.post<{ token: string; user: AuthUser }>("/auth/register", {
          name,
          email,
          password,
          role,
        });
        setToken(res.token);
        setUser(res.user);
        router.invalidate();
        queryClient.clear();
      },
      signOut: () => {
        setToken(null);
        setUser(null);
        queryClient.clear();
        void router.navigate({ to: "/auth" });
      },
    };
  }, [user, loading, queryClient, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export { ApiError };
