"use client";

import { useState } from "react";
import type { PortalSessionSummary } from "@ma/contracts";

interface SessionListProps {
  sessions: PortalSessionSummary[];
  onRevoke?: (sessionId: string) => Promise<void>;
}

export function SessionList({ sessions, onRevoke }: SessionListProps) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revoke = onRevoke ?? (async (sessionId: string) => {
    const response = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });

    if (!response.ok && response.status !== 204) {
      const json = await response.json().catch(() => null);
      throw new Error(json?.message ?? "Failed to revoke session");
    }
  });

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId);
    setError(null);
    try {
      await revoke(sessionId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevoking(null);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-white">Active Sessions</h2>
        <p className="text-sm text-slate-400">
          View and revoke active refresh tokens issued by the identity service.
        </p>
      </header>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
          >
            <div>
              <div className="text-sm text-slate-200">{session.userAgent ?? "Unknown client"}</div>
              <div className="text-xs text-slate-500">
                {(session.ipAddress ?? "Unknown IP")}
                {" "}· {new Date(session.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200 disabled:opacity-50"
              disabled={revoking === session.id}
              onClick={() => handleRevoke(session.id)}
              type="button"
            >
              {revoking === session.id ? "Revoking..." : "Revoke"}
            </button>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
            No active sessions found.
          </div>
        )}
      </div>
    </section>
  );
}
