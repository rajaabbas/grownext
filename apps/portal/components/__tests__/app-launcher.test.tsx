import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLauncher } from "../app-launcher";

describe("AppLauncher", () => {
  it("renders product cards", () => {
    render(
      <AppLauncher
        products={[
          {
            id: "tasks",
            name: "Tasks",
            description: "Task workflows",
            icon: "✅",
            url: "https://tasks.localhost",
            roles: ["Owner"]
          }
        ]}
      />
    );

    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });
});
