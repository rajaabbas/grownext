"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { withRequestedWithHeader } from "@/lib/request-headers";

interface InvitationSummary {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface InvitationsTableProps {
  organizationId: string;
  invitations: InvitationSummary[];
  canManage: boolean;
}

export function InvitationsTable({ organizationId, invitations, canManage }: InvitationsTableProps) {
  const router = useRouter();
  const [items, setItems] = useState(invitations);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  const handleRevoke = async (invitationId: string) => {
    setError(null);
    setStatus(null);
    setPendingId(invitationId);

    try {
      const response = await fetch(
        `/api/members/invitations/${invitationId}`,
        withRequestedWithHeader({
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ organizationId })
        })
      );

      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? json?.message ?? "Failed to revoke invitation");
      }

      setItems((prev) => prev.filter((invitation) => invitation.id !== invitationId));
      setStatus("Invitation revoked.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingId(null);
    }
  };

    const sorted = useMemo(
      () =>
        items.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      [items]
    );

  return (
    <div className="space-y-4">
      {status ? <p className="text-sm text-emerald-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {!canManage ? (
        <p className="text-xs text-slate-500">Only organization owners or admins can revoke invitations.</p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Expires</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-300">
            {sorted.map((invitation) => {
              const isPending = invitation.status === "PENDING";
              return (
                <tr key={invitation.id}>
                  <td className="px-4 py-3 text-white">{invitation.email}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                    {invitation.role}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide">
                    <span
                      className={
                        invitation.status === "PENDING"
                          ? "text-emerald-300"
                          : invitation.status === "EXPIRED"
                          ? "text-amber-300"
                          : invitation.status === "REVOKED"
                          ? "text-red-300"
                          : "text-slate-400"
                      }
                    >
                      {invitation.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(invitation.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <button
                      type="button"
                      onClick={() => handleRevoke(invitation.id)}
                      disabled={!canManage || !isPending || pendingId === invitation.id}
                      className={`rounded-md border px-3 py-1 transition ${
                        canManage && isPending
                          ? "border-red-500/40 bg-red-500/10 text-red-200 hover:border-red-500 hover:text-red-100"
                          : "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500"
                      } ${pendingId === invitation.id ? "opacity-70" : ""}`}
                    >
                      {pendingId === invitation.id ? "Revoking..." : "Revoke"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  No pending invitations.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
