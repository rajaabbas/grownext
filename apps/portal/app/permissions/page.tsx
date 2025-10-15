import { redirect } from "next/navigation";
import { PermissionsManager, type RoleDefinition } from "@/components/permissions/permissions-manager";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";
import { hasPortalPermission, resolvePortalPermissions } from "@/lib/portal-permissions";

const defaultRoles: RoleDefinition[] = [
  {
    id: "role-owner",
    name: "Owner",
    description:
      "Full control over the organization, identity configuration, and tenants. Can delegate new admins and delete the organization.",
    inherited: true,
    portalPermissions: {
      organization: ["organization:view", "organization:update", "organization:billing", "organization:delete"],
      members: ["members:view", "members:invite", "members:manage"],
      tenant: ["tenant:view", "tenant:create", "tenant:update", "tenant:members", "tenant:apps"],
      identity: ["identity:read", "identity:providers", "identity:audit"],
      permissions: ["permissions:view", "permissions:modify"]
    }
  },
  {
    id: "role-admin",
    name: "Admin",
    description:
      "Global administrator with access to billing, identity settings, and tenant management. Cannot delete the organization.",
    inherited: true,
    portalPermissions: {
      organization: ["organization:view", "organization:update", "organization:billing"],
      members: ["members:view", "members:invite", "members:manage"],
      tenant: ["tenant:view", "tenant:create", "tenant:update", "tenant:members", "tenant:apps"],
      identity: ["identity:read", "identity:providers", "identity:audit"],
      permissions: ["permissions:view", "permissions:modify"]
    }
  },
  {
    id: "role-manager",
    name: "Manager",
    description:
      "Trusted collaborator who can manage tenants and members but lacks billing and identity provider access.",
    inherited: true,
    portalPermissions: {
      organization: ["organization:view"],
      members: ["members:view", "members:invite", "members:manage"],
      tenant: ["tenant:view", "tenant:create", "tenant:update", "tenant:members", "tenant:apps"],
      identity: ["identity:read", "identity:audit"],
      permissions: ["permissions:view"]
    }
  },
  {
    id: "role-member",
    name: "Member",
    description:
      "Standard portal member with read access to identity configuration and their assigned tenants.",
    inherited: true,
    portalPermissions: {
      organization: ["organization:view"],
      members: ["members:view"],
      tenant: ["tenant:view"],
      identity: ["identity:read"],
      permissions: ["permissions:view"]
    }
  }
];

export default async function PermissionsPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  let launcher;
  try {
    launcher = await fetchPortalLauncher(session.access_token);
  } catch (error) {
    console.error("Failed to load permissions context", error);
    redirect("/login");
  }

  const permissions = resolvePortalPermissions(launcher.user.organizationRole);

  if (!hasPortalPermission(permissions, "permissions:view")) {
    redirect("/");
  }

  const canModify = hasPortalPermission(permissions, "permissions:modify");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Permissions</h1>
        <p className="text-sm text-slate-400">
          Define how organization members interact with GrowNext identity and portal features. Roles
          here do not affect individual product apps; those teams can continue to manage tenant
          access locally.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <h2 className="text-lg font-semibold text-white">How permissions work</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>Organization permissions apply across every tenant in the workspace.</li>
          <li>Member permissions determine who can view, invite, or manage organization members.</li>
          <li>Tenant permissions control what a role can do inside each tenant they can see.</li>
          <li>
            Identity permissions cover authentication, providers, and audit visibility inside the
            identity service.
          </li>
          <li>Permissions settings govern who can review or modify the role catalog itself.</li>
          <li>
            Owners retain full access and cannot be downgraded. Custom roles can be assigned to any
            member.
          </li>
        </ul>
      </section>

      <PermissionsManager initialRoles={defaultRoles} canModify={canModify} />
    </div>
  );
}
