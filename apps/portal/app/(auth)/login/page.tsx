export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in to GrowNext</h1>
        <p className="text-sm text-slate-400">
          Authentication flows delegate to the identity service. The portal exchanges credentials for
          authorization codes using PKCE.
        </p>
      </header>
      <form className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <label className="block text-sm">
          <span className="text-slate-400">Email address</span>
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="demo@tenant.io"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="••••••••"
          />
        </label>
        <button
          type="button"
          className="w-full rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
        >
          Continue
        </button>
        <p className="text-xs text-slate-500">
          On submit the portal calls the identity service `/oauth/authorize` endpoint and redirects to
          continue the PKCE flow.
        </p>
      </form>
    </div>
  );
}
