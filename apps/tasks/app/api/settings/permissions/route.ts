import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { listPermissionPolicies, upsertPermissionPolicy } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { resolvePermissionEvaluator } from "../../tasks/permissions";
import { requireRequestedWithHeader } from "@/lib/security";

const listQuerySchema = z.object({
  projectId: z.string().optional().nullable()
});

const upsertPolicySchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  canManage: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canComment: z.boolean().optional(),
  canAssign: z.boolean().optional()
});

const resolveTenantId = (request: Request): string | null => {
  const headerTenant = request.headers.get("x-tenant-id");
  if (headerTenant && headerTenant.trim().length > 0) {
    return headerTenant.trim();
  }

  try {
    const url = new URL(request.url);
    const queryTenant = url.searchParams.get("tenantId");
    return queryTenant && queryTenant.trim().length > 0 ? queryTenant.trim() : null;
  } catch {
    return null;
  }
};

const transformPolicy = (
  policy: Awaited<ReturnType<typeof upsertPermissionPolicy>> | Awaited<ReturnType<typeof listPermissionPolicies>>[number]
) => ({
  id: policy.id,
  tenantId: policy.tenantId,
  projectId: policy.projectId ?? null,
  userId: policy.userId,
  canManage: policy.canManage,
  canEdit: policy.canEdit,
  canComment: policy.canComment,
  canAssign: policy.canAssign,
  createdAt: policy.createdAt.toISOString(),
  updatedAt: policy.updatedAt.toISOString()
});

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = resolveTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: "tenant_required" }, { status: 400 });
    }

    const authContext = await getTasksAuthContext(session, tenantId);
    if (authContext.tenantId !== tenantId) {
      return NextResponse.json({ error: "tenant_mismatch" }, { status: 403 });
    }

    const query = listQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) {
      return NextResponse.json({ error: query.error.message }, { status: 400 });
    }

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const permissionEvaluator = await resolvePermissionEvaluator({
      serviceClaims,
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      roles: authContext.roles
    });

    if (!permissionEvaluator("manage")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const policies = await listPermissionPolicies(serviceClaims, {
      tenantId: authContext.tenantId,
      projectId: query.data.projectId ?? undefined
    });

    return NextResponse.json({ policies: policies.map(transformPolicy) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }
  try {
    const supabase = getSupabaseRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = resolveTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: "tenant_required" }, { status: 400 });
    }

    const authContext = await getTasksAuthContext(session, tenantId);
    if (authContext.tenantId !== tenantId) {
      return NextResponse.json({ error: "tenant_mismatch" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = upsertPolicySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const permissionEvaluator = await resolvePermissionEvaluator({
      serviceClaims,
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      roles: authContext.roles
    });

    if (!permissionEvaluator("manage")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const policy = await upsertPermissionPolicy(serviceClaims, {
      tenantId: authContext.tenantId,
      projectId: parsed.data.projectId ?? null,
      userId: parsed.data.userId,
      canManage: parsed.data.canManage,
      canEdit: parsed.data.canEdit,
      canComment: parsed.data.canComment,
      canAssign: parsed.data.canAssign
    });

    return NextResponse.json({ policy: transformPolicy(policy) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
