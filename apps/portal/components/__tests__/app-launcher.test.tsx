import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { AppLauncher } from "../app-launcher";

describe("AppLauncher", () => {
  it("renders product cards", () => {
    render(
      <AppLauncher
        products={[
          {
            productId: "tasks",
            productSlug: "tasks",
            name: "Tasks",
            description: "Task workflows",
            iconUrl: null,
            launchUrl: "https://tasks.localhost",
            roles: ["Owner"],
            lastUsedAt: null
          }
        ]}
      />
    );

    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Launch Tasks" })).toHaveAttribute(
      "href",
      "https://tasks.localhost"
    );
  });

  it("meets basic accessibility expectations", async () => {
    const { container } = render(
      <AppLauncher
        products={[
          {
            productId: "portal",
            productSlug: "portal",
            name: "Portal",
            description: "Centralized access to GrowNext products.",
            iconUrl: null,
            launchUrl: "https://portal.localhost",
            roles: ["Admin"],
            lastUsedAt: new Date().toISOString()
          }
        ]}
      />
    );

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
