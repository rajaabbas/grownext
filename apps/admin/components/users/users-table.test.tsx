import { render, screen } from "@testing-library/react";
import { UsersTable } from "./users-table";

const buildResponse = () => ({
  users: [
    {
      id: "user-1",
      email: "user@example.com",
      fullName: "User Example",
      status: "ACTIVE" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      organizations: [
        { id: "org-1", name: "Acme", slug: "acme", role: "ADMIN" as const }
      ],
      tenantCount: 1,
      productSlugs: ["tasks"],
      productCount: 1
    }
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  }
});

describe("UsersTable", () => {
  it("renders summary rows", () => {
    const data = buildResponse();
    render(<UsersTable initialData={data} />);

    expect(screen.getByText(/User Example/)).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Active/i)[0]).toBeInTheDocument();
    expect(screen.getByLabelText(/Status/i)).toBeInTheDocument();
  });
});
