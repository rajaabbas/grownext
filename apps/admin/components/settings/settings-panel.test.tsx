import { render, screen } from "@testing-library/react";

import { SettingsPanel } from "./settings-panel";

describe("SettingsPanel", () => {
  it("renders switches for feature flags", () => {
    render(
      <SettingsPanel
        initialFlags={{ impersonationEnabled: true, auditExportsEnabled: false }}
        observabilityEndpoint="https://example.com"
      />
    );

    expect(screen.getByText(/Impersonation/)).toBeInTheDocument();
    expect(screen.getByText(/Audit exports/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
  });
});
