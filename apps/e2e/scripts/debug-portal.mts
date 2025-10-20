import { signupOrganizationOwner, ensureTasksProductEntitlement, fetchOrganization, fetchPortalPermissions } from "../utils/api-client";
import { hasSupabaseAdmin, resetUserEmailVerification } from "../utils/supabase-admin";

const run = async () => {
  console.log("start script");
  const suffix = Date.now().toString(36);
  const email = `dbg.owner.${suffix}@example.com`;
  const password = `P@ssw0rd${suffix}`;
  const organizationName = `Debug Org ${suffix}`;
  const fullName = `Owner ${suffix}`;

  const session = await signupOrganizationOwner({
    email,
    password,
    fullName,
    organizationName
  });

  console.log("after signup", session);

  await ensureTasksProductEntitlement(session.accessToken, {
    organizationId: session.organizationId,
    tenantId: session.tenantId,
    userId: session.userId
  });

  console.log("entitlement ensured");

  if (hasSupabaseAdmin) {
    await resetUserEmailVerification(session.userId).catch((error) => {
      console.warn("reset email err", error);
    });
  }

  console.log("reset done");

  const org = await fetchOrganization(session.accessToken);
  console.log("org", org.id, org.name);

  const perms = await fetchPortalPermissions(session.accessToken);
  console.log("perms roles", Object.keys(perms.roles));
};

run().catch((error) => {
  console.error("debug run failed", error);
  process.exit(1);
});
