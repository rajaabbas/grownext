import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { createTask, listTasksForTenant, type TaskRecord } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional()
});

const writableRoles = new Set(["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR"]);

const transformTask = (task: TaskRecord) => ({
  id: task.id,
  organizationId: task.organizationId,
  tenantId: task.tenantId,
  title: task.title,
  description: task.description,
  status: task.status,
  assignedToId: task.assignedToId,
  createdById: task.createdById,
  dueDate: task.dueDate?.toISOString() ?? null,
  completedAt: task.completedAt?.toISOString() ?? null,
  createdAt: task.createdAt.toISOString()
});

export async function GET(_request: Request) {
  try {
    const supabase = getSupabaseRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authContext = await getTasksAuthContext(session);

    const tasks = await listTasksForTenant(
      buildServiceRoleClaims(authContext.organizationId),
      authContext.tenantId
    );

    return NextResponse.json({ tasks: tasks.map(transformTask) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authContext = await getTasksAuthContext(session);
    const roles = authContext.roles;

    if (!roles.some((role) => writableRoles.has(role))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const task = await createTask(buildServiceRoleClaims(authContext.organizationId), {
      organizationId: authContext.organizationId,
      tenantId: authContext.tenantId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      createdById: authContext.userId,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
    });

    return NextResponse.json({ task: transformTask(task) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
