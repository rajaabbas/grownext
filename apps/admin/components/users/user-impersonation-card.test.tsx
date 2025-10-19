import { render, screen } from "@testing-library/react";

import { UserImpersonationCard } from "./user-impersonation-card";

describe("UserImpersonationCard", () => {
  it("renders impersonation form controls", () => {
    render(<UserImpersonationCard userId="user-1" />);

    expect(screen.getByText(/Generate session/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Purpose/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Duration/i)).toBeInTheDocument();
  });
});
