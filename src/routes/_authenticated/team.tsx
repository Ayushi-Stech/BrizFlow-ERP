import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { EmptyState, PageHeader, Panel } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { ROLE_LABELS, useAuth, type Role } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

const PERMISSIONS: Array<{ role: Role; scope: string }> = [
  { role: "ADMIN", scope: "Full access to customers, products, inventory and challans" },
  { role: "SALES", scope: "Customers CRM and sales challans (draft + confirm)" },
  { role: "WAREHOUSE", scope: "Products, stock movements and inventory adjustments" },
  { role: "ACCOUNTS", scope: "Read-only access to customers, challans and sales value" },
];

type Member = { id: string; name: string; email: string; role: Role; created_at: string };

function TeamPage() {
  const { isAdmin, name, roles } = useAuth();

  const team = useQuery({
    queryKey: ["team"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.get<{ rows: Member[] }>("/users");
      return res.rows;
    },
  });

  return (
    <>
      <PageHeader
        title="Team & roles"
        description="Role permissions are enforced by the Express API on every request, not just in the UI."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-bold">Role matrix</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {PERMISSIONS.map((item) => (
              <li key={item.role} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <StatusBadge value={item.role} />
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[item.role]}</span>
                </div>
                <p className="mt-2 text-muted-foreground">{item.scope}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-bold">Employees</h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Every signed-up employee and their assigned roles."
                : "Only Admins can list the full team."}
            </p>
          </div>

          {!isAdmin ? (
            <div className="p-5 text-sm">
              <p className="font-semibold">{name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <StatusBadge key={role} value={role} />
                ))}
              </div>
            </div>
          ) : team.isLoading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (team.data?.length ?? 0) === 0 ? (
            <EmptyState title="No employees yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Roles</th>
                    <th className="px-5 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(team.data ?? []).map((member) => (
                    <tr key={member.id} className="hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge value={member.role} />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatDateTime(member.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
