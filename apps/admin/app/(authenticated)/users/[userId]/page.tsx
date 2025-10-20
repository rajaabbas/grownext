import Link from "next/link";
import { notFound } from "next/navigation";

import { UserDetailView } from "@/components/users/user-detail-view";
import { getSuperAdminUserDetail } from "@/lib/identity";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";

interface UserDetailPageProps {
  params: {
    userId: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function UserDetailPage({ params, searchParams }: UserDetailPageProps) {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    notFound();
  }

  const roles = extractAdminRoles(session);
  if (!hasRequiredAdminRole(roles, ["super-admin", "support"])) {
    notFound();
  }

  const canManageAccess = roles.has("super-admin");
  let detail: Awaited<ReturnType<typeof getSuperAdminUserDetail>> | null = null;
  let loadError: string | null = null;
  const verifiedEmailParam = searchParams?.verifiedEmail;
  const verifiedEmail = Array.isArray(verifiedEmailParam)
    ? verifiedEmailParam[0]
    : typeof verifiedEmailParam === "string"
      ? verifiedEmailParam
      : null;

  try {
    detail = await getSuperAdminUserDetail(session.access_token, params.userId, verifiedEmail ?? undefined);
  } catch (error) {
    const message = (error as Error).message ?? "";
    if (/404/.test(message) || /not\s*found/i.test(message) || /not_found/i.test(message)) {
      notFound();
    }
    console.error("Failed to load user detail", error);
    loadError = message || "Unable to load user detail right now.";
  }

  if (!detail || loadError) {
    return (
      <div className="space-y-6">
        <Link href="/users" className="text-sm font-medium text-primary underline underline-offset-4">
          ← Back to users
        </Link>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-destructive">
          <h3 className="text-base font-semibold text-foreground">Unable to load user details</h3>
          <p className="mt-2 text-muted-foreground">
            We couldn&apos;t retrieve the latest information for this account. Please try again after refreshing, or
            contact the platform team if the issue persists.
          </p>
          {loadError ? <p className="mt-3 text-xs text-muted-foreground">Error: {loadError}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/users" className="text-sm font-medium text-primary underline underline-offset-4">
        ← Back to users
      </Link>
      <UserDetailView initialDetail={detail} canManageAccess={canManageAccess} />
    </div>
  );
}
