import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { isAdminBillingEnabled } from "@/lib/feature-flags";
import { BillingNav, type BillingNavItem } from "@/components/billing/billing-nav";

const NAV_ITEMS: BillingNavItem[] = [
  { label: "Overview", href: "/billing" },
  { label: "Catalog", href: "/billing/catalog" },
  { label: "Subscriptions", href: "/billing/subscriptions" },
  { label: "Invoices", href: "/billing/invoices" },
  { label: "Usage", href: "/billing/usage" },
  { label: "Credits", href: "/billing/credits" }
];

export default async function BillingLayout({ children }: { children: ReactNode }) {
  if (!isAdminBillingEnabled()) {
    redirect("/");
  }

  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/signin");
  }

  const roles = extractAdminRoles(session);
  if (!roles.has("super-admin")) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Billing Operations</h2>
        <p className="text-sm text-muted-foreground">
          Inspect product catalog settings, track subscriptions, review invoices, and analyze usage telemetry for every
          tenant.
        </p>
      </header>

      <BillingNav items={NAV_ITEMS} />

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</section>
    </div>
  );
}
