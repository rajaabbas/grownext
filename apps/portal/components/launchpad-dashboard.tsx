import type {
  PortalAdminAction,
  PortalNotification,
  PortalSupportLink
} from "@ma/contracts";

interface Stat {
  label: string;
  value: number;
  description: string;
}

interface LaunchpadDashboardProps {
  stats: Stat[];
  adminActions: PortalAdminAction[];
  notifications: PortalNotification[];
  supportLinks: PortalSupportLink[];
}

const formatActor = (action: PortalAdminAction): string => {
  if (!action.actor) {
    return "An administrator";
  }

  if (action.actor.name && action.actor.email) {
    return `${action.actor.name} (${action.actor.email})`;
  }

  if (action.actor.name) {
    return action.actor.name;
  }

  if (action.actor.email) {
    return action.actor.email;
  }

  return "An administrator";
};

const formatRelativeTime = (isoDate: string): string => {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return "just now";
  }
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes <= 0) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(timestamp).toLocaleDateString();
};

const NotificationIcon = ({ type }: { type: PortalNotification["type"] }) => {
  switch (type) {
    case "bulk-job":
      return (
        <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full bg-fuchsia-500/20 text-fuchsia-200">
          ⇩
        </span>
      );
    default:
      return (
        <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full bg-slate-500/30 text-slate-200">
          •
        </span>
      );
  }
};

export function LaunchpadDashboard({
  stats,
  adminActions,
  notifications,
  supportLinks
}: LaunchpadDashboardProps) {
  return (
    <div className="space-y-8" data-testid="launchpad-dashboard">
      <section aria-label="Organization statistics" className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">Organization snapshot</h2>
          <p className="text-sm text-slate-400">
            Monitor tenant reach, session activity, and member growth.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-200 transition hover:border-fuchsia-500/40 focus-within:border-fuchsia-500/40"
            >
              <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">{stat.label}</h3>
              <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-500">{stat.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Recent admin actions" className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">Recent admin actions</h2>
          <p className="text-sm text-slate-400">
            Track impersonation stops, entitlement changes, and suspension activity initiated by the admin console.
          </p>
        </header>
        {adminActions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
            No recent privileged actions have been recorded for your organization.
          </p>
        ) : (
          <ul className="space-y-3">
            {adminActions.map((action) => (
              <li
                key={action.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">
                      {formatActor(action)} &mdash; {action.eventType.replace(/_/g, " ").toLowerCase()}
                    </p>
                    {action.description ? (
                      <p className="mt-1 text-slate-400">{action.description}</p>
                    ) : null}
                    {action.tenant?.name ? (
                      <p className="mt-1 text-xs text-slate-500">Tenant: {action.tenant.name}</p>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-500">{formatRelativeTime(action.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Notifications" className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">Notifications</h2>
          <p className="text-sm text-slate-400">
            Identity broadcasts bulk job results and export availability impacting your account.
          </p>
        </header>
        {notifications.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
            You&rsquo;re all caught up. We&rsquo;ll surface bulk job exports and impersonation alerts here.
          </p>
        ) : (
          <ul className="space-y-3">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
              >
                <NotificationIcon type={notification.type} />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{notification.title}</p>
                      {notification.description ? (
                        <p className="mt-1 text-slate-400">{notification.description}</p>
                      ) : null}
                    </div>
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                  {notification.actionUrl ? (
                    <div>
                      <a
                        href={notification.actionUrl}
                        className="inline-flex items-center gap-2 rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-200 transition hover:border-fuchsia-400 hover:bg-fuchsia-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
                      >
                        Download export
                        <span aria-hidden>↗</span>
                      </a>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Quick links" className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">Quick links</h2>
          <p className="text-sm text-slate-400">
            Documentation and operational controls to keep your rollout steady.
          </p>
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          {supportLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
              className="group rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200 transition hover:border-fuchsia-500/40 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
            >
              <span className="flex items-center justify-between">
                <span className="font-medium text-white">{link.label}</span>
                <span aria-hidden className="text-xs text-slate-400 transition group-hover:text-fuchsia-200">
                  {link.external ? "↗" : "→"}
                </span>
              </span>
              {link.description ? (
                <p className="mt-2 text-xs text-slate-400">{link.description}</p>
              ) : null}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
