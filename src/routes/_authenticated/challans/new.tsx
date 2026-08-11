import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/app-shell";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/challans/new")({
  component: NewChallanPage,
});

type Line = { productId: string; quantity: number };

function NewChallanPage() {
  const { canManageChallans } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1 }]);

  const customers = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => {
      const res = await api.get<{ rows: Array<{ id: string; name: string; business_name: string | null }> }>(
        "/customers?options=true",
      );
      return res.rows;
    },
  });

  const products = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const res = await api.get<{
        rows: Array<{ id: string; name: string; sku: string; unit_price: number; current_stock: number }>;
      }>("/products?options=true");
      return res.rows;
    },
  });

  const productMap = useMemo(
    () => Object.fromEntries((products.data ?? []).map((p) => [p.id, p])),
    [products.data],
  );

  const totals = useMemo(() => {
    let quantity = 0;
    let amount = 0;
    for (const line of lines) {
      const product = productMap[line.productId];
      if (!product) continue;
      quantity += line.quantity;
      amount += line.quantity * Number(product.unit_price);
    }
    return { quantity, amount };
  }, [lines, productMap]);

  const create = useMutation({
    mutationFn: async (confirmAfter: boolean) => {
      if (!customerId) throw new Error("Select a customer");
      const valid = lines.filter((l) => l.productId && l.quantity > 0);
      if (valid.length === 0) throw new Error("Add at least one product line");
      if (new Set(valid.map((l) => l.productId)).size !== valid.length)
        throw new Error("A product is repeated — merge the quantities instead");
      for (const line of valid) {
        if (!Number.isInteger(line.quantity)) throw new Error("Quantity must be a whole number");
      }

      const res = await api.post<{ challan: { challan_number: string; status: string } }>(
        "/challans",
        {
          customer_id: customerId,
          notes: notes.trim().slice(0, 500) || undefined,
          items: valid.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
          confirm: confirmAfter,
        },
      );
      return { number: res.challan.challan_number, confirmed: confirmAfter };
    },
    onSuccess: (result) => {
      toast.success(
        result.confirmed
          ? `${result.number} confirmed — stock reduced`
          : `${result.number} saved as draft`,
      );
      void queryClient.invalidateQueries({ queryKey: ["challans"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void navigate({ to: "/challans" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create challan"),
  });

  if (!canManageChallans) {
    return (
      <>
        <PageHeader title="New challan" description="Restricted" />
        <Panel className="p-6 text-sm text-muted-foreground">
          Your role cannot create sales challans. Sales and Admin users can.
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Create sales challan"
        description="Pick a customer, add products and save as draft or confirm to reduce stock."
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {(customers.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.business_name ? ` · ${c.business_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                maxLength={500}
                rows={2}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivery instructions, transport details…"
              />
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Products</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines([...lines, { productId: "", quantity: 1 }])}
              >
                <Plus className="size-4" /> Add line
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {lines.map((line, index) => {
                const product = productMap[line.productId];
                const exceeds = product ? line.quantity > product.current_stock : false;
                return (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_110px_130px_auto] sm:items-end"
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product</Label>
                      <Select
                        value={line.productId}
                        onValueChange={(v) =>
                          setLines(
                            lines.map((l, i) => (i === index ? { ...l, productId: v } : l)),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
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
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          setLines(
                            lines.map((l, i) =>
                              i === index ? { ...l, quantity: Number(e.target.value) } : l,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Line total</Label>
                      <p className="tabular py-2 font-semibold">
                        {formatCurrency(product ? product.unit_price * line.quantity : 0)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                      onClick={() => setLines(lines.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                    {exceeds && (
                      <p className="text-xs font-semibold text-destructive sm:col-span-4">
                        Only {product?.current_stock} in stock — confirming will be rejected.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <Panel className="h-fit p-5">
          <h2 className="font-bold">Summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total quantity</dt>
              <dd className="tabular font-semibold">{totals.quantity}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <dt className="text-muted-foreground">Total amount</dt>
              <dd className="tabular text-lg font-bold">{formatCurrency(totals.amount)}</dd>
            </div>
          </dl>

          <div className="mt-5 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              disabled={create.isPending}
              onClick={() => create.mutate(false)}
            >
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Save draft
            </Button>
            <Button
              className="w-full"
              disabled={create.isPending}
              onClick={() => create.mutate(true)}
            >
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirm challan
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Drafts never touch stock. Confirming validates availability and writes an OUT stock
            movement per product.
          </p>
        </Panel>
      </div>
    </>
  );
}