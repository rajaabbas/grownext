export default function SignupPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create your platform account</h1>
        <p className="text-sm text-slate-400">
          Sign-ups call Supabase GoTrue, then the identity service provisions organization and tenant
          records via workers.
        </p>
      </header>
      <form className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <label className="block text-sm">
          <span className="text-slate-400">Full name</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="Ada Lovelace"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Work email</span>
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="ada@grownext.com"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Create account
        </button>
        <p className="text-xs text-slate-500">
          Upon completion we issue an invitation audit event and pre-provision core entitlements.
        </p>
      </form>
    </div>
  );
}
