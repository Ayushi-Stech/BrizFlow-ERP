import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

const PAGE_SIZE = 10;

function InventoryPage() {
  const { canManageProducts } = useAuth();
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [reason, setReason] = useState("");
  const [filterProduct, setFilterProduct] = useState("ALL");
  const [page, setPage] = useState(0);

  const products = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const res = await api.get<{
        rows: Array<{ id: string; name: string; sku: string; current_stock: number; minimum_stock: number }>;
      }>("/products?options=true");
      return res.rows;
    },
  });

  type MovementRow = {
    id: string;
    quantity: number;
    movement_type: "IN" | "OUT";
    reason: string;
    created_at: string;
    created_by: string | null;
    created_by_name: string | null;
    product_name: string;
    product_sku: string;
  };

  const movements = useQuery({
    queryKey: ["movements", filterProduct, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterProduct !== "ALL") params.set("productId", filterProduct);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      return api.get<{ rows: MovementRow[]; count: number }>(`/stock-movements?${params.toString()}`);
    },
  });

  const adjust = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity);
      if (!productId) throw new Error("Select a product");
      if (!Number.isInteger(qty) || qty <= 0)
        throw new Error("Quantity must be a whole number above zero");
      await api.post("/stock-movements", {
        product_id: productId,
        quantity: qty,
        movement_type: movementType,
        reason: reason.trim().slice(0, 200) || (movementType === "IN" ? "Purchase" : "Manual issue"),
      });
    },
    onSuccess: () => {
      toast.success("Stock movement recorded");
      setQuantity("1");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not record movement")),
  });

  const totalPages = Math.max(1, Math.ceil((movements.data?.count ?? 0) / PAGE_SIZE));
  const lowStock = (products.data ?? []).filter((p) => p.current_stock <= p.minimum_stock);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Record stock in and out, and audit every movement with reason and creator."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel className="p-5">
          <h2 className="font-bold">Stock adjustment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManageProducts
              ? "Warehouse and Admin roles can move stock. Stock can never go negative."
              : "Your role has read-only access to inventory."}
          </p>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="i-product">Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="i-product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.current_stock} in stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="i-type">Type</Label>
                <Select
                  value={movementType}
                  onValueChange={(v) => setMovementType(v as "IN" | "OUT")}
                >
                  <SelectTrigger id="i-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Stock IN</SelectItem>
                    <SelectItem value="OUT">Stock OUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-qty">Quantity</Label>
                <Input
                  id="i-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="i-reason">Reason</Label>
              <Input
                id="i-reason"
                value={reason}
                maxLength={200}
                placeholder={movementType === "IN" ? "Purchase" : "Damage / manual issue"}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={!canManageProducts || adjust.isPending}
              onClick={() => adjust.mutate()}
            >
              {adjust.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : movementType === "IN" ? (
                <ArrowDownToLine className="size-4" />
              ) : (
                <ArrowUpFromLine className="size-4" />
              )}
              Record movement
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-bold">Low stock ({lowStock.length})</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {lowStock.length === 0 && (
                <li className="text-muted-foreground">All products above minimum level.</li>
              )}
              {lowStock.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular shrink-0 font-semibold text-warning-foreground">
                    {p.current_stock} / min {p.minimum_stock}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="font-bold">Stock movement log</h2>
            <Select
              value={filterProduct}
              onValueChange={(v) => {
                setFilterProduct(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All products</SelectItem>
                {(products.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {movements.isLoading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (movements.data?.rows.length ?? 0) === 0 ? (
            <EmptyState title="No stock movements yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Product</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 text-right font-semibold">Qty</th>
                    <th className="px-5 py-3 font-semibold">Reason</th>
                    <th className="px-5 py-3 font-semibold">By</th>
                    <th className="px-5 py-3 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(movements.data?.rows ?? []).map((m) => (
                    <tr key={m.id} className="hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <p className="font-semibold">{m.product_name}</p>
                        <p className="tabular text-xs text-muted-foreground">{m.product_sku}</p>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge value={m.movement_type} />
                      </td>
                      <td className="tabular px-5 py-3 text-right font-semibold">
                        {m.movement_type === "IN" ? "+" : "−"}
                        {m.quantity}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{m.reason}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {m.created_by_name ?? "System"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatDateTime(m.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              {movements.data?.count ?? 0} movements · page {page + 1} of {totalPages}
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
      </div>
    </>
  );
}
