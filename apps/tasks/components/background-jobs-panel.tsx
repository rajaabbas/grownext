import type { TasksNotification } from "@ma/contracts";

interface BackgroundJobsPanelProps {
  notifications: TasksNotification[];
}

export const BackgroundJobsPanel = ({ notifications }: BackgroundJobsPanelProps) => {
  if (!notifications.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Recent admin jobs</h2>
          <p className="text-xs text-slate-400">
            Monitor background jobs triggered from the Super Admin console.
          </p>
        </div>
        <a
          href="/docs/operations/runbooks/worker"
          className="text-xs font-medium text-fuchsia-200 hover:text-fuchsia-100"
        >
          Worker runbook ↗
        </a>
      </header>
      <ul className="space-y-3">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-white">{notification.title}</p>
                {notification.description ? (
                  <p className="mt-1 text-slate-400">{notification.description}</p>
                ) : null}
              </div>
              <span className="whitespace-nowrap text-xs text-slate-500">
                {new Date(notification.createdAt).toLocaleString()}
              </span>
            </div>
            {notification.actionUrl ? (
              <div className="mt-2">
                <a
                  href={notification.actionUrl}
                  className="inline-flex items-center gap-2 text-xs font-medium text-fuchsia-200 hover:text-fuchsia-100"
                >
                  View export ↗
                </a>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};
