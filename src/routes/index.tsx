import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeIndianRupee, Boxes, ScrollText, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BizFlow ERP — CRM, Inventory & Sales Challans" },
      {
        name: "description",
        content:
          "BizFlow ERP is a role-based business management system for distributors: customer CRM, product stock, movement logs and sales challans with draft/confirm workflow.",
      },
      { property: "og:title", content: "BizFlow ERP — CRM, Inventory & Sales Challans" },
      {
        property: "og:description",
        content:
          "Customer CRM, inventory control and sales challans with automatic numbering and stock validation.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Users,
    title: "Customer CRM",
    body: "Leads to distributors with GST details, follow-up dates, notes, search and filters.",
  },
  {
    icon: Boxes,
    title: "Products & stock",
    body: "SKUs, pricing, warehouse location and minimum-stock alerts across locations.",
  },
  {
    icon: ScrollText,
    title: "Sales challans",
    body: "Auto numbers like CH-2026-00001, draft vs confirmed, price snapshots per line.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Admin, Sales, Warehouse and Accounts permissions enforced on the server.",
  },
];

function Landing() {
  const { session, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BadgeIndianRupee className="size-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">BizFlow ERP</span>
        </div>
        {loading ? null : session ? (
          <Button asChild>
            <Link to="/dashboard">Open dashboard</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="inline-flex rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              Mini ERP + CRM
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
              Run customers, stock and sales challans in one place.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              A business management system for companies that distribute products. Employees sign in
              with a role, manage the customer pipeline and inventory, then issue sales challans
              that reduce stock only once confirmed — with a full movement log behind it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={session ? "/dashboard" : "/auth"}>
                  {session ? "Go to dashboard" : "Sign in to continue"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Create an employee account
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-panel)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Business flow
            </p>
            <ol className="mt-4 space-y-3 text-sm">
              {[
                "Login with a role (Admin / Sales / Warehouse / Accounts)",
                "Manage customers and product stock",
                "Create a sales challan and add quantities",
                "Save as draft — stock stays untouched",
                "Confirm — stock is validated, reduced and logged",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-panel)]"
            >
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-base font-bold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
