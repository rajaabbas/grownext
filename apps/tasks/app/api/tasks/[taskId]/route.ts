import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { deleteTask, setTaskStatus, updateTask, type TaskRecord } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import type { TaskStatus } from "@ma/tasks-db";
import { fetchOwner } from "../owners";
import { transformTask } from "../serializer";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "ARCHIVED"]).optional()
});

const writableRoles = new Set(["ADMIN", "MEMBER"]);
const deleteRoles = new Set(["ADMIN", "MEMBER"]);

type RouteParams = {
  params: {
    taskId: string;
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
    const roles = authContext.roles;

    if (!roles.some((role) => writableRoles.has(role))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const claims = buildServiceRoleClaims(authContext.organizationId);

    let task: TaskRecord;

    if (parsed.data.status) {
      task = await setTaskStatus(
        claims,
        params.taskId,
        authContext.tenantId,
        parsed.data.status as TaskStatus
      );
    } else {
      const dueDate =
        parsed.data.dueDate === undefined
          ? undefined
          : parsed.data.dueDate === null
            ? null
            : new Date(parsed.data.dueDate);

      task = await updateTask(claims, params.taskId, authContext.tenantId, {
        title: parsed.data.title,
        description: parsed.data.description,
        dueDate
      });
    }

    const owner = await fetchOwner(accessToken, task.createdById, authContext.tenantId);

    return NextResponse.json({ task: transformTask(task, owner ?? undefined) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
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
    const roles = authContext.roles;

    if (!roles.some((role) => deleteRoles.has(role))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await deleteTask(
      buildServiceRoleClaims(authContext.organizationId),
      params.taskId,
      authContext.tenantId
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
