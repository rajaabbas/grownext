import { mockLauncherData } from "@/lib/mock-data";

export default function TenantsPage() {
  const tenants = mockLauncherData.tenants;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Tenant Management</h1>
        <p className="text-slate-400">
          Provision new environments, invite collaborators, and align entitlements across tenants.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {tenants.map((tenant) => (
          <div key={tenant.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{tenant.name}</h2>
                <p className="text-sm text-slate-500">Slug: {tenant.slug}</p>
              </div>
              <button className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-fuchsia-500 hover:text-fuchsia-200">
                View activity
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-400">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Members</dt>
                <dd className="text-base text-slate-200">{tenant.members}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Products</dt>
                <dd className="text-base text-slate-200">{tenant.products}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2 text-sm">
              <button className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 hover:border-fuchsia-500 hover:text-fuchsia-200">
                Invite member
              </button>
              <button className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 hover:border-emerald-500 hover:text-emerald-200">
                Enable product
              </button>
            </div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6">
        <h2 className="text-lg font-semibold text-white">Create a new tenant</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tenant provisioning calls the identity admin APIs and seeds entitlements through the worker
          queue.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col text-sm">
            <span className="text-slate-400">Tenant name</span>
            <input
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
              placeholder="Payments"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-slate-400">Slug</span>
            <input
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
              placeholder="payments"
            />
          </label>
          <label className="md:col-span-2 flex flex-col text-sm">
            <span className="text-slate-400">Description</span>
            <textarea
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
              rows={3}
              placeholder="Backing services and payment orchestration"
            />
          </label>
          <button
            type="button"
            className="md:col-span-2 rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
          >
            Provision tenant
          </button>
        </form>
      </section>
    </div>
  );
}
