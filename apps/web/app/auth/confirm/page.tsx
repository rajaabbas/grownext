import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface ConfirmPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const next = typeof searchParams?.next === "string" ? searchParams?.next : "/dashboard";

  if (user) {
    try {
      await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          email_verified: true
        }
      });
    } catch {
      // ignore update errors; user can retry from dashboard banner
    }
    redirect(next);
  }

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Email confirmed</h1>
      <p className="text-sm text-muted-foreground">
        Sign in to your workspace to finish verifying your account.
      </p>
    </div>
  );
}
