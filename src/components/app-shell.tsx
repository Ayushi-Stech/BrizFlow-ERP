import { Link, useRouter } from "@tanstack/react-router";
import {
  BadgeIndianRupee,
  Boxes,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ROLE_LABELS, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/products", label: "Products", icon: Boxes },
  { to: "/inventory", label: "Inventory", icon: PackageSearch },
  { to: "/challans", label: "Sales Challans", icon: ScrollText },
  { to: "/team", label: "Team & Roles", icon: ShieldCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { name, roles, user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    await router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <BadgeIndianRupee className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-extrabold tracking-tight text-sidebar-accent-foreground">
              BizFlow ERP
            </p>
            <p className="text-[11px] text-sidebar-foreground/70">Distribution operations</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-4">
          <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
            {name || user?.email}
          </p>
          <p className="text-xs text-sidebar-foreground/70">
            {roles.length ? roles.map((r) => ROLE_LABELS[r]).join(" · ") : "No role assigned"}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-sidebar-foreground/80 transition-colors hover:text-sidebar-primary"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="outline" size="icon" onClick={() => setOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <span className="font-bold">BizFlow ERP</span>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
      <ChevronRight className="size-5 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
