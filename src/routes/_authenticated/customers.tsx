import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState, PageHeader, Panel } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

const PAGE_SIZE = 8;

type CustomerType = "RETAIL" | "WHOLESALE" | "DISTRIBUTOR";
type CustomerStatus = "LEAD" | "ACTIVE" | "INACTIVE";

type CustomerRow = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  business_name: string | null;
  gst_number: string | null;
  customer_type: CustomerType;
  address: string | null;
  status: CustomerStatus;
  follow_up_date: string | null;
  notes: string | null;
};

const customerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().email("Enter a valid email").max(255).or(z.literal("")),
  business_name: z.string().trim().max(120),
  gst_number: z.string().trim().max(20),
  customer_type: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().trim().max(300),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]),
  follow_up_date: z.string().max(20),
  notes: z.string().trim().max(1000),
});

const emptyForm = {
  name: "",
  mobile: "",
  email: "",
  business_name: "",
  gst_number: "",
  customer_type: "RETAIL" as CustomerType,
  address: "",
  status: "LEAD" as CustomerStatus,
  follow_up_date: "",
  notes: "",
};

function CustomersPage() {
  const { canManageCustomers } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CustomerStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | CustomerType>("ALL");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [detail, setDetail] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [followupNote, setFollowupNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, statusFilter, typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await api.get<{ rows: CustomerRow[]; count: number }>(
        `/customers?${params.toString()}`,
      );
      return res;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = customerSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      const payload = {
        name: parsed.data.name,
        mobile: parsed.data.mobile,
        email: parsed.data.email || null,
        business_name: parsed.data.business_name || null,
        gst_number: parsed.data.gst_number || null,
        customer_type: parsed.data.customer_type,
        address: parsed.data.address || null,
        status: parsed.data.status,
        follow_up_date: parsed.data.follow_up_date || null,
        notes: parsed.data.notes || null,
      };
      if (editing) {
        await api.put(`/customers/${editing.id}`, payload);
      } else {
        await api.post("/customers", payload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Customer updated" : "Customer added");
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save")),
  });

  type Followup = { id: string; note: string; created_at: string; created_by_name: string | null };

  const followups = useQuery({
    queryKey: ["followups", detail?.id],
    enabled: !!detail,
    queryFn: async () => {
      const res = await api.get<{ rows: Followup[] }>(`/customers/${detail!.id}/followups`);
      return res.rows;
    },
  });

  const addFollowup = useMutation({
    mutationFn: async () => {
      if (!followupNote.trim()) throw new Error("Write a note first");
      await api.post(`/customers/${detail!.id}/followups`, { note: followupNote.trim() });
    },
    onSuccess: () => {
      setFollowupNote("");
      void queryClient.invalidateQueries({ queryKey: ["followups", detail?.id] });
      toast.success("Follow-up note added");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not add note")),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(row: CustomerRow) {
    setEditing(row);
    setForm({
      name: row.name,
      mobile: row.mobile,
      email: row.email ?? "",
      business_name: row.business_name ?? "",
      gst_number: row.gst_number ?? "",
      customer_type: row.customer_type,
      address: row.address ?? "",
      status: row.status,
      follow_up_date: row.follow_up_date ?? "",
      notes: row.notes ?? "",
    });
    setFormOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Customers"
        description="Customer CRM with leads, active accounts and follow-ups."
        actions={
          canManageCustomers ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add customer
            </Button>
          ) : null
        }
      />

      <Panel className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search name, business, mobile or email"
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as typeof statusFilter);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="LEAD">Lead</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v as typeof typeFilter);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="RETAIL">Retail</SelectItem>
              <SelectItem value="WHOLESALE">Wholesale</SelectItem>
              <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.rows.length === 0 ? (
          <EmptyState title="No customers found" hint="Adjust your search or add a customer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Business</th>
                  <th className="px-5 py-3 font-semibold">Mobile</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Follow-up</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.rows ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3 font-semibold">{row.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.business_name ?? "—"}</td>
                    <td className="tabular px-5 py-3">{row.mobile}</td>
                    <td className="px-5 py-3">
                      <StatusBadge value={row.customer_type} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDate(row.follow_up_date)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDetail(row)}>
                          View
                        </Button>
                        {canManageCustomers && (
                          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                            Edit
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
            {data?.count ?? 0} customers · page {page + 1} of {totalPages}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle>
            <DialogDescription>
              All fields are validated before being saved to the database.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
              />
            </Field>
            <Field label="Mobile number">
              <Input
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                maxLength={15}
              />
            </Field>
            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
              />
            </Field>
            <Field label="Business name">
              <Input
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                maxLength={120}
              />
            </Field>
            <Field label="GST number">
              <Input
                value={form.gst_number}
                onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })}
                maxLength={20}
              />
            </Field>
            <Field label="Follow-up date">
              <Input
                type="date"
                value={form.follow_up_date}
                onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
              />
            </Field>
            <Field label="Customer type">
              <Select
                value={form.customer_type}
                onValueChange={(v) => setForm({ ...form, customer_type: v as CustomerType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETAIL">Retail</SelectItem>
                  <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                  <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as CustomerStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <Textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  maxLength={300}
                  rows={2}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  maxLength={1000}
                  rows={3}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>{detail?.business_name ?? "No business name"}</DialogDescription>
          </DialogHeader>
          {detail && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Mobile" value={detail.mobile} />
              <Detail label="Email" value={detail.email ?? "—"} />
              <Detail label="GST" value={detail.gst_number ?? "—"} />
              <Detail label="Type" value={detail.customer_type} />
              <Detail label="Status" value={detail.status} />
              <Detail label="Follow-up" value={formatDate(detail.follow_up_date)} />
              <div className="sm:col-span-2">
                <Detail label="Address" value={detail.address ?? "—"} />
              </div>
              <div className="sm:col-span-2">
                <Detail label="Notes" value={detail.notes ?? "—"} />
              </div>
            </dl>
          )}
          {detail && (
            <div className="mt-2 border-t border-border pt-4">
              <h3 className="text-sm font-bold">Follow-up notes</h3>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                {followups.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (followups.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No follow-ups logged yet.</p>
                ) : (
                  followups.data!.map((f) => (
                    <div key={f.id} className="rounded-md bg-muted/50 p-2 text-sm">
                      <p>{f.note}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {f.created_by_name ?? "Unknown"} · {formatDateTime(f.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
              {canManageCustomers && (
                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={followupNote}
                    onChange={(e) => setFollowupNote(e.target.value)}
                    placeholder="Log a call, visit, or update…"
                    rows={2}
                    maxLength={1000}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    className="self-end"
                    disabled={addFollowup.isPending}
                    onClick={() => addFollowup.mutate()}
                  >
                    {addFollowup.isPending && <Loader2 className="size-4 animate-spin" />}
                    Add
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
