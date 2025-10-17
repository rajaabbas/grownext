import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { deleteSubtask, updateSubtask } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { fetchOwnerMap } from "../../../owners";
import { resolvePermissionEvaluator } from "../../../permissions";
import { transformSubtasks } from "../../../serializer";
import { requireRequestedWithHeader } from "@/lib/security";

const updateSubtaskSchema = z.object({
  title: z.string().min(1).optional(),
  isCompleted: z.boolean().optional()
});

type RouteParams = {
  params: {
    taskId: string;
    subtaskId: string;
  };
};

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

export async function PATCH(request: Request, { params }: RouteParams) {
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

    const accessToken = session.access_token;
    if (!accessToken) {
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
    const parsed = updateSubtaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    if (parsed.data.title === undefined && parsed.data.isCompleted === undefined) {
      return NextResponse.json({ error: "no_updates" }, { status: 400 });
    }

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const permissionEvaluator = await resolvePermissionEvaluator({
      serviceClaims,
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      roles: authContext.roles
    });

    if (!permissionEvaluator("edit")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const subtask = await updateSubtask(serviceClaims, params.subtaskId, authContext.tenantId, {
      title: parsed.data.title,
      isCompleted: parsed.data.isCompleted
    });

    const owners = await fetchOwnerMap(accessToken, [subtask.createdById], authContext.tenantId);

    return NextResponse.json({ subtask: transformSubtasks([subtask], owners)[0] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
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

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const permissionEvaluator = await resolvePermissionEvaluator({
      serviceClaims,
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      roles: authContext.roles
    });

    if (!permissionEvaluator("edit")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await deleteSubtask(serviceClaims, params.subtaskId, authContext.tenantId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
