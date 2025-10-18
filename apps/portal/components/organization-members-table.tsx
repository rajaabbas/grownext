"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withRequestedWithHeader } from "@/lib/request-headers";

interface OrganizationMemberRow {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    email: string;
    fullName: string | null;
  };
}

interface OrganizationMembersTableProps {
  organizationId: string;
  members: OrganizationMemberRow[];
  canManage: boolean;
  currentUserId: string;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

export function OrganizationMembersTable({
  organizationId,
  members,
  canManage,
  currentUserId
}: OrganizationMembersTableProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRemove = (member: OrganizationMemberRow) => {
    if (!canManage) return;
    const subject = member.user.fullName ?? member.user.email;
    const confirmation = window.confirm(`Remove ${subject} from the organization? This revokes their access to all tenants and apps.`);
    if (!confirmation) return;

    setError(null);
    setPendingId(member.id);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/organization/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(member.id)}`,
          withRequestedWithHeader({ method: "DELETE" })
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? payload?.error ?? `Request failed (${response.status})`);
        }

        router.refresh();
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Member</th>
            <th className="px-4 py-3 text-left font-medium">Email</th>
            <th className="px-4 py-3 text-left font-medium">Role</th>
            <th className="px-4 py-3 text-left font-medium">Joined</th>
            <th className="px-4 py-3 text-left font-medium" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-300">
          {members.map((member) => {
            const isSelfOwner =
              member.userId === currentUserId && member.role.toUpperCase() === "OWNER";
            const disableRemove = !canManage || isPending || pendingId === member.id || isSelfOwner;
            return (
              <tr key={member.id}>
                <td className="px-4 py-3 text-white">{member.user.fullName ?? "—"}</td>
                <td className="px-4 py-3">{member.user.email}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">{member.role}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDate(member.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {canManage ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-red-400 transition hover:text-red-200 disabled:opacity-50"
                      onClick={() => handleRemove(member)}
                      disabled={disableRemove}
                    >
                      {pendingId === member.id ? "Removing…" : "Remove"}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {members.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                No members yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {error ? (
        <div className="border-t border-slate-800 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
