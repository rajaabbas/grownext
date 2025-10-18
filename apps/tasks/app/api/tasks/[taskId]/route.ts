import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import {
  deleteTask,
  getTaskById,
  setTaskStatus,
  updateTask,
  type TaskStatus
} from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { fetchOwnerMap } from "../owners";
import { resolvePermissionEvaluator } from "../permissions";
import { transformTask } from "../serializer";
import { cancelDueSoonNotification, dueSoonJobId, enqueueTaskNotification } from "@/lib/queues";
import { dueDateSchema } from "../due-date-schema";
import { requireRequestedWithHeader } from "@/lib/security";
import { taskErrorToResponse } from "../error-utils";

const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: dueDateSchema,
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "ARCHIVED"]).optional(),
  projectId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  sortOrder: z.number().int().optional(),
  visibility: z.enum(["PERSONAL", "PROJECT"]).optional()
});

const DUE_SOON_THRESHOLD_MS = 1000 * 60 * 60 * 24;


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

const normalizeProjectIdParam = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (["unassigned", "none", "null"].includes(trimmed)) {
    return null;
  }

  return trimmed;
};

const ensureUpdatesRequested = (data: z.infer<typeof updateTaskSchema>): boolean => {
  return (
    data.title !== undefined ||
    data.description !== undefined ||
    data.dueDate !== undefined ||
    data.status !== undefined ||
    data.projectId !== undefined ||
    data.assignedToId !== undefined ||
    data.priority !== undefined ||
    data.visibility !== undefined ||
    data.sortOrder !== undefined
  );
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
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    if (!ensureUpdatesRequested(parsed.data)) {
      return NextResponse.json({ error: "no_updates" }, { status: 400 });
    }

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const permissionEvaluator = await resolvePermissionEvaluator({
      serviceClaims,
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      roles: authContext.roles
    });

    const updates = parsed.data;
    const requiresEdit =
      updates.title !== undefined ||
      updates.description !== undefined ||
      updates.dueDate !== undefined ||
      updates.projectId !== undefined ||
      updates.priority !== undefined ||
      updates.visibility !== undefined;
    const requiresAssign = updates.assignedToId !== undefined;
    const requiresSortOrderOnly = updates.sortOrder !== undefined && updates.status === undefined && !requiresEdit && !requiresAssign;

    if (requiresEdit && !permissionEvaluator("edit")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (requiresAssign && !permissionEvaluator("assign")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (updates.status && !permissionEvaluator("edit")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (requiresSortOrderOnly && !permissionEvaluator("edit")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const previousTask = await getTaskById(serviceClaims, params.taskId, authContext.tenantId);

    let task = null;

    const dueDate =
      updates.dueDate === undefined
        ? undefined
        : updates.dueDate === null
          ? null
          : new Date(updates.dueDate);

    const projectId = normalizeProjectIdParam(updates.projectId);

    const shouldUpdateFields = requiresEdit || requiresAssign || (requiresSortOrderOnly && !updates.status);

    if (shouldUpdateFields) {
      task = await updateTask(serviceClaims, params.taskId, authContext.tenantId, {
        title: updates.title,
        description: updates.description,
        dueDate,
        priority: updates.priority,
        visibility: updates.visibility,
        projectId,
        assignedToId:
          updates.assignedToId === undefined ? undefined : updates.assignedToId ?? null,
        sortOrder: updates.status ? undefined : updates.sortOrder ?? undefined
      });
    }

    if (updates.status) {
      task = await setTaskStatus(serviceClaims, params.taskId, authContext.tenantId, updates.status as TaskStatus, {
        sortOrder: updates.sortOrder
      });
    }

    if (!task) {
      return NextResponse.json({ error: "task_not_found" }, { status: 404 });
    }

    if (updates.assignedToId !== undefined && task.assignedToId && task.assignedToId !== previousTask.assignedToId) {
      await enqueueTaskNotification("task.assigned", {
        taskId: task.id,
        tenantId: authContext.tenantId,
        assigneeId: task.assignedToId,
        title: task.title
      });
    }

    if (task.dueDate && task.status !== "COMPLETED") {
      await cancelDueSoonNotification(task.id);
      const recipients = new Set<string>();
      if (task.assignedToId) recipients.add(task.assignedToId);
      for (const follower of task.followers ?? []) {
        recipients.add(follower.userId);
      }
      recipients.add(task.createdById);
      if (recipients.size > 0) {
        const delay = Math.max(0, task.dueDate.getTime() - Date.now() - DUE_SOON_THRESHOLD_MS);
        await enqueueTaskNotification(
          "task.dueSoon",
          {
            taskId: task.id,
            tenantId: authContext.tenantId,
            dueDate: task.dueDate?.toISOString() ?? null,
            recipients: Array.from(recipients),
            title: task.title
          },
          {
            jobId: dueSoonJobId(task.id),
            delay
          }
        );
      }
    } else {
      await cancelDueSoonNotification(task.id);
    }

    const owners = await fetchOwnerMap(
      accessToken,
      [
        task.createdById,
        task.assignedToId ?? undefined,
        ...(task.subtasks?.map((subtask) => subtask.createdById) ?? []),
        ...(task.comments?.map((comment) => comment.createdById) ?? []),
        ...(task.followers?.map((follower) => follower.userId) ?? [])
      ].filter((id): id is string => typeof id === "string"),
      authContext.tenantId
    );

    const serialized = transformTask(task, owners, { includeSubtasks: true, includeComments: true });

    return NextResponse.json({ task: serialized });
  } catch (error) {
    return taskErrorToResponse(error);
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

    if (!permissionEvaluator("manage")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await deleteTask(serviceClaims, params.taskId, authContext.tenantId);
    await cancelDueSoonNotification(params.taskId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return taskErrorToResponse(error);
  }
}
