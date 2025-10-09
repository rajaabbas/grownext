import { Card, CardContent, CardHeader } from "@ma/ui";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const emailVerified = Boolean(user.user_metadata?.email_verified);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <h1 className="text-3xl font-semibold" data-testid="dashboard-heading">
        Dashboard
      </h1>
      {!emailVerified ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100"
          data-testid="dashboard-email-alert"
        >
          <p className="font-medium">Verify your email</p>
          <p className="text-xs md:text-sm">
            We sent a verification link to {user.email ?? "your inbox"}. You can keep working while you wait—click the link when it arrives to dismiss this reminder.
          </p>
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">You&apos;re all set</h2>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Start building your app by inviting teammates to your organization, personalizing your
            profile, and connecting product features to your multi-tenant data model.
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>Visit the Organization page to update details and manage members.</li>
            <li>Head to your Profile to keep your account information current.</li>
            <li>Extend this dashboard with metrics, quick actions, or onboarding tasks.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
