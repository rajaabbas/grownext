import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { createProject, listProjectSummariesForTenant, listProjectsForTenant } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { resolvePermissionEvaluator } from "../tasks/permissions";
import { requireRequestedWithHeader } from "@/lib/security";

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#?[0-9A-Fa-f]{3,8}$/)
    .optional()
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

const transformProject = (project: Awaited<ReturnType<typeof createProject>>) => ({
  id: project.id,
  tenantId: project.tenantId,
  name: project.name,
  description: project.description ?? null,
  color: project.color ?? null,
  archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString()
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

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const permissionEvaluator = await resolvePermissionEvaluator({
      serviceClaims,
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      roles: authContext.roles
    });

    if (!permissionEvaluator("view")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const [projects, summaries] = await Promise.all([
      listProjectsForTenant(serviceClaims, authContext.tenantId, { includeArchived: true }),
      listProjectSummariesForTenant(serviceClaims, authContext.tenantId)
    ]);

    return NextResponse.json({
      projects: projects.map(transformProject),
      summaries: summaries.map((summary) => ({
        projectId: summary.projectId,
        name: summary.name,
        openCount: summary.openCount,
        overdueCount: summary.overdueCount,
        completedCount: summary.completedCount,
        scope: summary.scope
      })),
      permissions: {
        canManage: permissionEvaluator("manage"),
        canCreate: permissionEvaluator("create"),
        canView: true
      }
    });
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
    const parsed = createProjectSchema.safeParse(body);

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

    const project = await createProject(serviceClaims, {
      organizationId: authContext.organizationId,
      tenantId: authContext.tenantId,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
      createdById: authContext.userId
    });

    return NextResponse.json({ project: transformProject(project) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
