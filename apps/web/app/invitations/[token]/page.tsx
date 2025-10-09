import { notFound } from "next/navigation";
import { InvitationDetailsResponseSchema } from "@ma/contracts";
import { getApiBaseUrl } from "@/lib/api";
import { AcceptInvitationForm } from "@/components/accept-invitation-form";

interface InvitationPageProps {
  params: {
    token: string;
  };
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const response = await fetch(`${getApiBaseUrl()}/auth/invitations/${params.token}`, {
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    if (response.status === 404) {
      notFound();
    }

    if (response.status === 410) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Invitation expired</h1>
          <p className="text-sm text-muted-foreground">
            This invitation link has expired. Ask your administrator to send a fresh invite.
          </p>
        </div>
      );
    }

    throw new Error("Failed to load invitation");
  }

  const payload = InvitationDetailsResponseSchema.parse(await response.json());

  return (
    <div className="space-y-6">
      <AcceptInvitationForm
        token={params.token}
        organizationName={payload.organizationName}
        email={payload.email}
        role={payload.role}
      />
    </div>
  );
}
