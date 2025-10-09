"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";

export const SessionManagementCard = () => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [deviceCount, setDeviceCount] = useState<number | null>(1);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSignOutOthers = async () => {
    setStatus("loading");
    setMessage(null);

    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("success");
      setMessage("Signed out from other devices.");
      setDeviceCount((current) => (typeof current === "number" && current > 0 ? 1 : current));
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <Card data-testid="session-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="session-card-heading">
          Session security
        </h2>
        <p className="text-sm text-muted-foreground">
          Sign out of other active sessions if you suspect unauthorized access.
        </p>
      </CardHeader>
      <CardContent className="space-y-3" data-testid="session-card-content">
        <div className="text-sm text-muted-foreground" data-testid="session-count">
          Active sessions (including this one): {deviceCount ?? "—"}
        </div>
        <Button
          variant="outline"
          onClick={handleSignOutOthers}
          disabled={status === "loading"}
          data-testid="session-signout-others"
        >
          {status === "loading" ? "Signing out..." : "Sign out other sessions"}
        </Button>
        {message ? (
          <p
            className={`text-sm ${
              status === "error" ? "text-destructive" : status === "success" ? "text-emerald-600" : "text-muted-foreground"
            }`}
            data-testid="session-message"
          >
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
