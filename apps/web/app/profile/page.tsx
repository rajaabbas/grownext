import { ProfileForm } from "@/components/profile-form";
import { SessionManagementCard } from "@/components/session-management-card";
import { MfaTotpCard } from "@/components/mfa-totp-card";
import { PasswordChangeCard } from "@/components/password-change-card";
import { getApiBaseUrl } from "@/lib/api";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { UserProfileSchema } from "@ma/contracts";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function ProfilePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieHeader = headers().get("cookie") ?? "";

  const response = await fetch(`${getApiBaseUrl()}/profile`, {
    headers: {
      "Content-Type": "application/json",
      // Forward Supabase auth cookies so the API can extract claims
      ...(cookieHeader ? { cookie: cookieHeader } : {})
    },
    cache: "no-store"
  });

  let profile = {
    userId: user.id,
    email: user.email ?? "",
    fullName: (user.user_metadata?.full_name as string | undefined) ?? ""
  };

  if (response.ok) {
    const payload = await response.json();
    profile = UserProfileSchema.parse(payload);
  } else if (response.status !== 404) {
    throw new Error("Unable to load profile");
  }

  return (
    <div className="space-y-6" data-testid="profile-page">
      <h1 className="text-3xl font-semibold" data-testid="profile-heading">
        Account
      </h1>
      <ProfileForm initialProfile={profile} />
      <PasswordChangeCard />
      <SessionManagementCard />
      <MfaTotpCard />
    </div>
  );
}
