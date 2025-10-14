export default function DocsPage() {
  return (
    <div className="space-y-4 text-slate-200">
      <h1 className="text-2xl font-semibold">Platform Documentation</h1>
      <p className="text-slate-400">
        Read the architecture and onboarding guides in <code className="rounded bg-slate-900 px-2 py-1">/docs</code>
        to connect new product applications to the identity service.
      </p>
      <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300">
        <li>OIDC flows powered by the Fastify identity service</li>
        <li>Prisma-backed tenant and entitlement models</li>
        <li>Identity client package for verifying access tokens</li>
        <li>Supabase integration for user lifecycle and MFA</li>
      </ul>
    </div>
  );
}
