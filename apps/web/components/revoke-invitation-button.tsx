"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Button } from "@ma/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

interface RevokeInvitationButtonProps {
  invitationId: string;
  disabled?: boolean;
}

export const RevokeInvitationButton = ({ invitationId, disabled }: RevokeInvitationButtonProps) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRevoke = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("You are not logged in");
        setLoading(false);
        return;
      }

      const response = await fetch(`${getApiBaseUrl()}/organization/invitations/${invitationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErrorMessage(body?.error ?? "Failed to revoke invitation");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2" data-testid={`revoke-invitation-${invitationId}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRevoke}
        disabled={loading || disabled}
        data-testid={`revoke-invitation-button-${invitationId}`}
      >
        {loading ? "Revoking…" : "Revoke"}
      </Button>
      {errorMessage ? (
        <p className="text-xs text-destructive" data-testid={`revoke-invitation-message-${invitationId}`}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
