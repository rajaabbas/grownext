import type { SessionSummary } from "@/lib/mock-data";

interface SessionListProps {
  sessions: SessionSummary[];
}

export function SessionList({ sessions }: SessionListProps) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-white">Active Sessions</h2>
        <p className="text-sm text-slate-400">
          View and revoke active refresh tokens issued by the identity service.
        </p>
      </header>
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
          >
            <div>
              <div className="text-sm text-slate-200">{session.userAgent}</div>
              <div className="text-xs text-slate-500">
                {session.ipAddress} · {new Date(session.createdAt).toLocaleString()}
              </div>
            </div>
            <button className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200">
              Revoke
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
