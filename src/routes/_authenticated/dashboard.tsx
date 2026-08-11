import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, ScrollText, TrendingUp, Users } from "lucide-react";

import { EmptyState, PageHeader, Panel } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type DashboardData = {
  customerCount: number;
  productCount: number;
  confirmedCount: number;
  confirmedValue: number;
  lowStock: Array<{ id: string; name: string; sku: string; current_stock: number; minimum_stock: number }>;
  recent: Array<{
    id: string;
    challan_number: string;
    status: string;
    total_quantity: number;
    total_amount: number;
    created_at: string;
    customer_name: string;
    customer_business_name: string | null;
  }>;
};

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/dashboard"),
  });

  const stats = [
    { label: "Customers", value: data?.customerCount ?? 0, icon: Users },
    { label: "Products", value: data?.productCount ?? 0, icon: Boxes },
    { label: "Low stock", value: data?.lowStock.length ?? 0, icon: AlertTriangle },
    { label: "Confirmed challans", value: data?.confirmedCount ?? 0, icon: ScrollText },
  ];

  return (
    <>
      <PageHeader
        title="ERP Operations"
        description="Live snapshot of customers, inventory health and sales challans."
        actions={
          <Button asChild>
            <Link to="/challans/new">New sales challan</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Panel key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <s.icon className="size-4 text-primary" />
            </div>
            <p className="tabular mt-2 text-3xl font-extrabold">{isLoading ? "—" : s.value}</p>
          </Panel>
        ))}
      </div>

      <Panel className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Confirmed challan value</p>
          <TrendingUp className="size-4 text-success" />
        </div>
        <p className="tabular mt-2 text-3xl font-extrabold">
          {isLoading ? "—" : formatCurrency(data?.confirmedValue ?? 0)}
        </p>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-bold">Recent challans</h2>
            <Link to="/challans" className="text-sm font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          {!isLoading && (data?.recent.length ?? 0) === 0 ? (
            <EmptyState title="No challans yet" hint="Create your first sales challan." />
          ) : (
            <ul className="divide-y divide-border">
              {(data?.recent ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <Link
                      to="/challans"
                      search={{ challan: c.challan_number }}
                      className="tabular font-semibold hover:text-primary"
                    >
                      {c.challan_number}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.customer_business_name || c.customer_name} · {formatDate(c.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular text-sm font-semibold">
                      {formatCurrency(c.total_amount)}
                    </span>
                    <StatusBadge value={c.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-bold">Low stock alerts</h2>
            <Link to="/inventory" className="text-sm font-semibold text-primary hover:underline">
              Inventory
            </Link>
          </div>
          {!isLoading && (data?.lowStock.length ?? 0) === 0 ? (
            <EmptyState title="Stock levels are healthy" />
          ) : (
            <ul className="divide-y divide-border">
              {(data?.lowStock ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="tabular text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  <span className="tabular shrink-0 rounded-full border border-warning/35 bg-warning/15 px-2.5 py-0.5 text-xs font-bold text-warning-foreground">
                    {p.current_stock} left · min {p.minimum_stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
