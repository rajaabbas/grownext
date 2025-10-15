import { redirect } from "next/navigation";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher, fetchPortalStatus } from "@/lib/identity";
import { hasPortalPermission, resolvePortalPermissions } from "@/lib/portal-permissions";

export default async function StatusPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const launcher = await fetchPortalLauncher(session.access_token).catch(() => null);
  const permissions = resolvePortalPermissions(launcher?.user.organizationRole);

  if (!launcher || !hasPortalPermission(permissions, "permissions:view")) {
    redirect("/");
  }

  const status = await fetchPortalStatus(session.access_token).catch(() => ({
    identity: { status: "unknown", latency: null },
    tasks: { status: "unknown", latency: null }
  }));

  const cards = [
    {
      title: "Identity API",
      status: status.identity.status,
      latencyMs: status.identity.latency
    },
    {
      title: "Tasks API",
      status: status.tasks.status,
      latencyMs: status.tasks.latency
    }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-white">Platform Status</h1>
        <p className="text-sm text-slate-400">
          Monitor core API health for the GrowNext platform.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.title}
            className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-slate-300"
          >
            <h2 className="text-base font-semibold text-white">{card.title}</h2>
            <p className="text-sm">
              Status: <span className="font-medium text-white">{card.status}</span>
            </p>
            <p className="text-xs text-slate-500">
              Latency: {card.latencyMs != null ? `${card.latencyMs} ms` : "n/a"}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
