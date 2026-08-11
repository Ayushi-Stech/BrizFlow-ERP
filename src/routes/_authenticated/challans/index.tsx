import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/challans/")({
  component: ChallansPage,
});

const PAGE_SIZE = 10;

type ChallanRow = {
  id: string;
  challan_number: string;
  status: string;
  total_quantity: number;
  total_amount: number;
  created_at: string;
  confirmed_at: string | null;
  customer_name: string;
  customer_business_name: string | null;
};

function ChallansPage() {
  const { canManageChallans } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["challans", search, status, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status !== "ALL") params.set("status", status);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      return api.get<{ rows: ChallanRow[]; count: number }>(`/challans?${params.toString()}`);
    },
  });

  type ChallanDetail = ChallanRow & {
    notes: string | null;
    customer_mobile: string;
    customer_gst_number: string | null;
    items: Array<{ id: string; product_name: string; sku: string; unit_price: number; quantity: number }>;
  };

  const detail = useQuery({
    queryKey: ["challan", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await api.get<{ challan: ChallanDetail }>(`/challans/${detailId}`);
      return res.challan;
    },
  });

  const confirm = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/challans/${id}/confirm`);
    },
    onSuccess: () => {
      toast.success("Challan confirmed — stock reduced");
      void queryClient.invalidateQueries({ queryKey: ["challans"] });
      void queryClient.invalidateQueries({ queryKey: ["challan"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not confirm challan"),
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Sales challans"
        description="Draft challans hold no stock. Confirming validates and reduces stock atomically."
        actions={
          canManageChallans ? (
            <Button asChild>
              <Link to="/challans/new">
                <Plus className="size-4" /> New challan
              </Link>
            </Button>
          ) : null
        }
      />

      <Panel className="flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search challan number"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </Panel>

      <Panel className="mt-4 overflow-hidden">
        {list.isLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (list.data?.rows.length ?? 0) === 0 ? (
          <EmptyState title="No challans yet" hint="Create a challan to start selling." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Challan</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 text-right font-semibold">Qty</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(list.data?.rows ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="tabular px-5 py-3 font-bold">{row.challan_number}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold">{row.customer_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.customer_business_name ?? ""}
                      </p>
                    </td>
                    <td className="tabular px-5 py-3 text-right">{row.total_quantity}</td>
                    <td className="tabular px-5 py-3 text-right">
                      {formatCurrency(row.total_amount)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(row.id)}>
                          View
                        </Button>
                        {canManageChallans && row.status === "DRAFT" && (
                          <Button
                            size="sm"
                            disabled={confirm.isPending}
                            onClick={() => confirm.mutate(row.id)}
                          >
                            <CheckCircle2 className="size-4" /> Confirm
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
          <span className="text-muted-foreground">
            {list.data?.count ?? 0} challans · page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Panel>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="tabular">
              {detail.data?.challan_number ?? "Challan"}
            </DialogTitle>
            <DialogDescription>
              Line items are stored as snapshots, so historical pricing never changes.
            </DialogDescription>
          </DialogHeader>

          {detail.isLoading || !detail.data ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                  <p className="font-semibold">{detail.data.customer_name}</p>
                  <p className="text-muted-foreground">
                    {detail.data.customer_business_name ?? ""}
                  </p>
                  <p className="tabular text-muted-foreground">
                    {detail.data.customer_mobile ?? ""}
                  </p>
                </div>
                <div className="sm:text-right">
                  <StatusBadge value={detail.data.status} />
                  <p className="mt-2 text-muted-foreground">
                    Created {formatDateTime(detail.data.created_at)}
                  </p>
                  {detail.data.confirmed_at && (
                    <p className="text-muted-foreground">
                      Confirmed {formatDateTime(detail.data.confirmed_at)}
                    </p>
                  )}
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 font-semibold">Product</th>
                    <th className="py-2 text-right font-semibold">Price</th>
                    <th className="py-2 text-right font-semibold">Qty</th>
                    <th className="py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(detail.data.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="py-2">
                        <p className="font-semibold">{item.product_name}</p>
                        <p className="tabular text-xs text-muted-foreground">{item.sku}</p>
                      </td>
                      <td className="tabular py-2 text-right">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="tabular py-2 text-right">{item.quantity}</td>
                      <td className="tabular py-2 text-right font-semibold">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">
                  Total quantity {detail.data.total_quantity}
                </span>
                <span className="tabular text-lg font-bold">
                  {formatCurrency(detail.data.total_amount)}
                </span>
              </div>

              {canManageChallans && detail.data.status === "DRAFT" && (
                <Button
                  className="w-full"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(detail.data!.id)}
                >
                  {confirm.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Confirm challan and reduce stock
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}