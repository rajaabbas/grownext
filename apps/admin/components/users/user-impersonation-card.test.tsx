import { render, screen } from "@testing-library/react";

import { ImpersonationSessionProvider } from "@/components/providers/impersonation-session-provider";

import { UserImpersonationCard } from "./user-impersonation-card";

describe("UserImpersonationCard", () => {
  it("renders impersonation form controls", () => {
    render(
      <ImpersonationSessionProvider>
        <UserImpersonationCard userId="user-1" userEmail="user@example.com" userName="User Example" />
      </ImpersonationSessionProvider>
    );

    expect(screen.getByText(/Generate session/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Purpose/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Duration/i)).toBeInTheDocument();
  });
});
