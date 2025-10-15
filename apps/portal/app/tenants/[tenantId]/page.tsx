import { notFound, redirect } from "next/navigation";
import { TenantHeader } from "@/components/tenant-header";
import { TenantAppsSection } from "@/components/tenant-apps-section";
import { TenantMembersSection } from "@/components/tenant-members-section";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import {
  fetchPortalLauncher,
  fetchOrganizationProducts,
  fetchTenantDetail,
  type TenantDetailResponse
} from "@/lib/identity";
import { hasPortalPermission, resolvePortalPermissions } from "@/lib/portal-permissions";

type NormalizedTenantMember = {
  id: string;
  organizationMemberId: string;
  role: string;
  organizationMember: {
    id: string;
    userId: string;
    role: string;
    user: {
      fullName: string;
      email: string;
    };
  };
};

type NormalizedOrganizationMember = {
  id: string;
  userId: string;
  role: string;
  user: {
    fullName: string;
    email: string;
  };
};

interface TenantDetailPageProps {
  params: {
    tenantId: string;
  };
}

const normalizeTenantMembers = (detail: TenantDetailResponse): NormalizedTenantMember[] =>
  detail.members.map((member) => ({
    id: member.id,
    organizationMemberId: member.organizationMemberId,
    role: member.role,
    organizationMember: {
      id: member.organizationMember.id,
      userId: member.organizationMember.userId,
      role: member.organizationMember.role,
      user: {
        fullName: member.organizationMember.user.fullName,
        email: member.organizationMember.user.email
      }
    }
  }));

const normalizeOrganizationMembers = (
  detail: TenantDetailResponse
): NormalizedOrganizationMember[] =>
  detail.organizationMembers.map((member) => ({
    id: member.id,
    userId: member.userId,
    role: member.role,
    user: {
      fullName: member.user.fullName,
      email: member.user.email
    }
  }));

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const tenantIdentifier = decodeURIComponent(params.tenantId);
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
    console.error("Failed to resolve portal context for tenant view", error);
    redirect("/login");
  }
  const permissions = resolvePortalPermissions(launcher.user.organizationRole);

  if (!hasPortalPermission(permissions, "tenant:view")) {
    redirect("/");
  }

  let detail: TenantDetailResponse | null = null;
  try {
    detail = await fetchTenantDetail(session.access_token, tenantIdentifier);
  } catch (error) {
    console.error("Failed to load tenant detail", error);
    const message = (error as Error).message;
    if (message.includes("(404)")) {
      notFound();
    }
    redirect("/");
  }

  if (!detail) {
    notFound();
  }

  let organizationProducts: Awaited<ReturnType<typeof fetchOrganizationProducts>> | null = null;
  if (hasPortalPermission(permissions, "tenant:apps") || hasPortalPermission(permissions, "tenant:update")) {
    try {
      organizationProducts = await fetchOrganizationProducts(
        session.access_token,
        detail.tenant.organizationId
      );
    } catch (error) {
      const message = (error as Error).message.toLowerCase();
      if (message.includes("forbidden") || message.includes("(403)")) {
        console.info("Organization products require elevated access; continuing without catalog.");
      } else {
        console.error("Failed to load organization products for tenant detail", error);
      }
    }
  }

  const orgProducts = organizationProducts?.products ?? [];
  const baseProducts =
    orgProducts.length > 0
      ? orgProducts.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description ?? null,
          iconUrl: product.iconUrl ?? null,
          launcherUrl: product.launcherUrl ?? null
        }))
      : detail.applications.map((app) => ({
          id: app.product.id,
          name: app.product.name,
          description: app.product.description ?? null,
          iconUrl: app.product.iconUrl ?? null,
          launcherUrl: app.product.launcherUrl ?? null
        }));

  const productMetadata = baseProducts.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    iconUrl: product.iconUrl,
    launcherUrl: product.launcherUrl
  }));

  const enabledProductIds = detail.applications.map((application) => application.productId);

  const tenantMembers = normalizeTenantMembers(detail);
  const organizationMembers = normalizeOrganizationMembers(detail);
  const membersByUserId = new Map<string, NormalizedOrganizationMember>(
    organizationMembers.map((member) => [member.userId, member])
  );

  const now = Date.now();
  const activeEntitlements = detail.entitlements.filter(
    (entitlement) =>
      !entitlement.expiresAt || new Date(entitlement.expiresAt).getTime() >= now
  );

  const entitlementsByProduct = new Map<
    string,
    Array<{
      entitlementId: string;
      userId: string;
      userName: string;
      userEmail: string | null;
      roles: string[];
    }>
  >();

  const userEntitlements = new Map<
    string,
    Record<string, { entitlementId: string; roles: string[] }>
  >();

  for (const entitlement of activeEntitlements) {
    const member = membersByUserId.get(entitlement.userId);
    const entry = entitlementsByProduct.get(entitlement.productId) ?? [];
    const fallbackRole =
      tenantMembers.find(
        (tenantMember) => tenantMember.organizationMember.userId === entitlement.userId
      )?.role ?? member?.role ?? "MEMBER";
    const productRoles =
      entitlement.roles && entitlement.roles.length > 0 ? entitlement.roles : [fallbackRole];
    entry.push({
      entitlementId: entitlement.id,
      userId: entitlement.userId,
      userName: member?.user.fullName ?? entitlement.userId,
      userEmail: member?.user.email ?? null,
      roles: productRoles
    });
    entitlementsByProduct.set(entitlement.productId, entry);

    const userEntry = userEntitlements.get(entitlement.userId) ?? {};
    userEntry[entitlement.productId] = {
      entitlementId: entitlement.id,
      roles: entitlement.roles
    };
    userEntitlements.set(entitlement.userId, userEntry);
  }

  const entitlementsByProductRecord = Object.fromEntries(entitlementsByProduct) as Record<
    string,
    Array<{
      entitlementId: string;
      userId: string;
      userName: string;
      userEmail: string | null;
      roles: string[];
    }>
  >;
  const userEntitlementsRecord = Object.fromEntries(userEntitlements) as Record<
    string,
    Record<string, { entitlementId: string; roles: string[] }>
  >;

  const canManageTenantMembers = hasPortalPermission(permissions, "tenant:members");
  const canManageTenantApps = hasPortalPermission(permissions, "tenant:apps");

  return (
    <div className="space-y-8">
      <TenantHeader
        tenant={{
          id: detail.tenant.id,
          organizationId: detail.tenant.organizationId,
          name: detail.tenant.name,
          slug: detail.tenant.slug,
          description: detail.tenant.description
        }}
      />
      <TenantAppsSection
        tenantId={detail.tenant.id}
        products={productMetadata}
        enabledProductIds={enabledProductIds}
        entitlementsByProduct={entitlementsByProductRecord}
        canManageApps={canManageTenantApps}
      />
      <TenantMembersSection
        tenantId={detail.tenant.id}
        organizationId={detail.tenant.organizationId}
        members={tenantMembers}
        organizationMembers={organizationMembers}
        products={productMetadata.map(({ id, name }) => ({ id, name }))}
        enabledProductIds={enabledProductIds}
        userEntitlements={userEntitlementsRecord}
        canManageMembers={canManageTenantMembers}
        canManageApps={canManageTenantApps}
      />
    </div>
  );
}
