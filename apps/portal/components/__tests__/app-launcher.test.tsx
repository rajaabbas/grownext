import { render, screen } from "@testing-library/react";
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
  });
});
