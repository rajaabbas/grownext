import { LogoutButton } from "@/components/logout-button";

export default function LogoutPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Logout</h1>
      <p className="text-sm text-muted-foreground">
        Sign out of Supabase auth. This only removes the client session; backend APIs remain
        protected by JWT.
      </p>
      <LogoutButton />
    </div>
  );
}
