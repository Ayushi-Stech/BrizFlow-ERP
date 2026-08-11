import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState, PageHeader, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
});

const PAGE_SIZE = 8;

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unit_price: number;
  current_stock: number;
  minimum_stock: number;
  warehouse_location: string | null;
};

const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(120),
  sku: z.string().trim().min(2, "SKU is required").max(40),
  category: z.string().trim().max(60),
  unit_price: z.coerce.number().min(0, "Price cannot be negative").max(100000000),
  current_stock: z.coerce.number().int("Stock must be a whole number").min(0),
  minimum_stock: z.coerce.number().int("Minimum stock must be a whole number").min(0),
  warehouse_location: z.string().trim().max(80),
});

const emptyForm = {
  name: "",
  sku: "",
  category: "",
  unit_price: "0",
  current_stock: "0",
  minimum_stock: "0",
  warehouse_location: "",
};

function ProductsPage() {
  const { canManageProducts } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      return api.get<{ rows: ProductRow[]; count: number }>(`/products?${params.toString()}`);
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = productSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      const payload = {
        name: parsed.data.name,
        sku: parsed.data.sku.toUpperCase(),
        category: parsed.data.category || null,
        unit_price: parsed.data.unit_price,
        minimum_stock: parsed.data.minimum_stock,
        warehouse_location: parsed.data.warehouse_location || null,
      };
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        return;
      }
      await api.post("/products", { ...payload, current_stock: parsed.data.current_stock });
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product added");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save")),
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Products"
        description="Catalogue with SKUs, pricing, warehouse location and stock thresholds."
        actions={
          canManageProducts ? (
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Add product
            </Button>
          ) : null
        }
      />

      <Panel className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by product, SKU or category"
            className="pl-9"
          />
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.rows.length === 0 ? (
          <EmptyState title="No products found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">SKU</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 text-right font-semibold">Price</th>
                  <th className="px-5 py-3 text-right font-semibold">Stock</th>
                  <th className="px-5 py-3 text-right font-semibold">Min</th>
                  <th className="px-5 py-3 font-semibold">Warehouse</th>
                  {canManageProducts && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.rows ?? []).map((row) => {
                  const low = row.current_stock <= row.minimum_stock;
                  return (
                    <tr key={row.id} className="hover:bg-muted/40">
                      <td className="px-5 py-3 font-semibold">{row.name}</td>
                      <td className="tabular px-5 py-3 text-muted-foreground">{row.sku}</td>
                      <td className="px-5 py-3 text-muted-foreground">{row.category ?? "—"}</td>
                      <td className="tabular px-5 py-3 text-right">
                        {formatCurrency(row.unit_price)}
                      </td>
                      <td className="tabular px-5 py-3 text-right">
                        <span
                          className={
                            low
                              ? "rounded-full border border-warning/35 bg-warning/15 px-2 py-0.5 font-bold text-warning-foreground"
                              : "font-semibold"
                          }
                        >
                          {row.current_stock}
                        </span>
                      </td>
                      <td className="tabular px-5 py-3 text-right text-muted-foreground">
                        {row.minimum_stock}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {row.warehouse_location ?? "—"}
                      </td>
                      {canManageProducts && (
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(row);
                              setForm({
                                name: row.name,
                                sku: row.sku,
                                category: row.category ?? "",
                                unit_price: String(row.unit_price),
                                current_stock: String(row.current_stock),
                                minimum_stock: String(row.minimum_stock),
                                warehouse_location: row.warehouse_location ?? "",
                              });
                              setOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
          <span className="text-muted-foreground">
            {data?.count ?? 0} products · page {page + 1} of {totalPages}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Stock is only changed through inventory movements, never edited directly."
                : "Opening stock is recorded as an IN stock movement."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Product name</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">SKU / code</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-category">Category</Label>
              <Input
                id="p-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Unit price (₹)</Label>
              <Input
                id="p-price"
                type="number"
                min={0}
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="p-opening">Opening stock</Label>
                <Input
                  id="p-opening"
                  type="number"
                  min={0}
                  value={form.current_stock}
                  onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p-min">Minimum stock alert</Label>
              <Input
                id="p-min"
                type="number"
                min={0}
                value={form.minimum_stock}
                onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-warehouse">Warehouse / location</Label>
              <Input
                id="p-warehouse"
                value={form.warehouse_location}
                onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })}
                maxLength={80}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
