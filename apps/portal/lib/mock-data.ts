export interface LauncherProduct {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  roles: string[];
  lastUsedAt?: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  members: number;
  products: number;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  userAgent: string;
  ipAddress: string;
}

export interface LauncherData {
  user: {
    id: string;
    email: string;
    organization: string;
  };
  tenants: TenantSummary[];
  products: LauncherProduct[];
  sessions: SessionSummary[];
}

export const mockLauncherData: LauncherData = {
  user: {
    id: "user-1",
    email: "demo@tenant.io",
    organization: "Seeded Organization"
  },
  tenants: [
    { id: "tenant-1", name: "Studio", slug: "studio", members: 8, products: 3 },
    { id: "tenant-2", name: "Marketing", slug: "marketing", members: 4, products: 2 }
  ],
  products: [
    {
      id: "tasks",
      name: "Tasks",
      description: "Track and manage lightweight workflow items",
      icon: "✅",
      url: "https://tasks.localhost",
      roles: ["Owner", "Editor"],
      lastUsedAt: new Date().toISOString()
    },
  ],
  sessions: [
    {
      id: "sess-1",
      createdAt: new Date().toISOString(),
      userAgent: "Chrome on macOS",
      ipAddress: "127.0.0.1"
    },
    {
      id: "sess-2",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      userAgent: "iOS App",
      ipAddress: "127.0.0.1"
    }
  ]
};
