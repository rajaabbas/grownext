export default function MfaPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Multi-factor Authentication</h1>
        <p className="text-sm text-slate-400">
          MFA enrollment is delegated to Supabase Auth while the identity service tracks verification
          status for audit trails.
        </p>
      </header>
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <ol className="space-y-3 text-sm text-slate-300">
          <li>1. Scan the QR code with your authenticator app.</li>
          <li>2. Enter the 6-digit TOTP code to confirm enrollment.</li>
          <li>3. Download recovery codes from the identity service profile API.</li>
        </ol>
        <button className="w-full rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-emerald-500 hover:text-emerald-200">
          Generate recovery codes
        </button>
      </div>
    </div>
  );
}
