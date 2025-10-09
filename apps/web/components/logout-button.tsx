"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Button } from "@ma/ui";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface LogoutButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  idleLabel?: string;
  loadingLabel?: string;
  redirectTo?: string;
}

export const LogoutButton = ({
  idleLabel = "Sign out",
  loadingLabel = "Signing out...",
  redirectTo = "/login",
  disabled,
  ...buttonProps
}: LogoutButtonProps) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Error signing out", error);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignOut}
      disabled={loading || disabled}
      data-testid="logout-button"
      {...buttonProps}
    >
      {loading ? loadingLabel : idleLabel}
    </Button>
  );
};
