import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { createTask, listTasksForTenant, listTasksForUser } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { fetchOwnerMap } from "./owners";
import { transformTask } from "./serializer";
import { cancelDueSoonNotification, dueSoonJobId, enqueueTaskNotification } from "@/lib/queues";
import type { SerializedTask } from "./serializer";
import { resolvePermissionEvaluator } from "./permissions";
import { dueDateSchema } from "./due-date-schema";
import { requireRequestedWithHeader } from "@/lib/security";
import { taskErrorToResponse } from "./error-utils";
import { emitTaskCreatedUsage } from "@/lib/billing-usage";

const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const LIST_VIEWS = ["list", "board", "my"] as const;
const BOARD_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "ARCHIVED"] as const;

const DUE_SOON_THRESHOLD_MS = 1000 * 60 * 60 * 24;


const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: dueDateSchema,
  projectId: z.string().optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  followerIds: z.array(z.string().min(1)).optional(),
  visibility: z.enum(["PERSONAL", "PROJECT"]).optional()
});

type TaskView = (typeof LIST_VIEWS)[number];

interface ListQuery {
  view: TaskView;
  projectId: string | null | undefined;
  search?: string;
}

const normalizeProjectIdParam = (value: string | null): string | null | undefined => {
  if (!value || value === "all") {
    return undefined;
  }
  if (["unassigned", "none", "null"].includes(value)) {
    return null;
  }
  return value;
};

const parseListQuery = (request: Request): ListQuery => {
  const url = new URL(request.url);
  const viewParam = url.searchParams.get("view");
  const projectParam = url.searchParams.get("projectId");
  const searchParam = url.searchParams.get("search");

  const view: TaskView = LIST_VIEWS.includes(viewParam as TaskView)
    ? (viewParam as TaskView)
    : "list";

  const search = searchParam?.trim();

  return {
    view,
    projectId: normalizeProjectIdParam(projectParam),
    search: search && search.length > 0 ? search : undefined
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

const buildBoardView = (tasks: SerializedTask[]) => {
  return {
    columns: BOARD_STATUSES.map((status) => {
      const columnTasks = tasks
        .filter((task) => task.status === status)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
      return {
        status,
        label: status.replace(/_/g, " "),
        tasks: columnTasks
      };
    })
  };
};

const buildStats = (tasks: SerializedTask[]) => {
  const now = Date.now();
  let completed = 0;
  let overdue = 0;

  for (const task of tasks) {
    if (task.status === "COMPLETED") {
      completed += 1;
      continue;
    }
    if (task.dueDate) {
      const due = Date.parse(task.dueDate);
      if (!Number.isNaN(due) && due < now) {
        overdue += 1;
      }
    }
  }

  return {
    total: tasks.length,
    completed,
    overdue
  };
};

export async function GET(request: Request) {
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

    const listQuery = parseListQuery(request);
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

    const includeSubtasks = listQuery.view !== "board";
    const includeFollowers = true;

    const tasksRaw =
      listQuery.view === "my"
        ? await listTasksForUser(serviceClaims, authContext.tenantId, {
            userId: authContext.userId,
            includeFollowers,
            includeCreated: true,
            includeAssigned: true,
            includeCompleted: false
          })
        : await listTasksForTenant(serviceClaims, authContext.tenantId, {
            projectId: listQuery.projectId,
            search: listQuery.search,
            includeSubtasks,
            includeFollowers,
            includeComments: false,
            orderBy: listQuery.view === "board" ? "board" : "priority"
          });

    const owners = await fetchOwnerMap(
      accessToken,
      Array.from(
        new Set(
          tasksRaw.flatMap((task) => [
            task.createdById,
            task.assignedToId ?? undefined,
            ...(task.subtasks?.map((subtask) => subtask.createdById) ?? []),
            ...(task.comments?.map((comment) => comment.createdById) ?? []),
            ...(task.followers?.map((follower) => follower.userId) ?? [])
          ])
        )
      ).filter((id): id is string => typeof id === "string"),
      authContext.tenantId
    );

    const serializedTasks = tasksRaw.map((task) =>
      transformTask(task, owners, { includeSubtasks })
    );

    const stats = buildStats(serializedTasks);
    const board = listQuery.view === "board" ? buildBoardView(serializedTasks) : undefined;

    const permissions = {
      canView: true,
      canCreate: permissionEvaluator("create"),
      canEdit: permissionEvaluator("edit"),
      canComment: permissionEvaluator("comment"),
      canAssign: permissionEvaluator("assign"),
      canManage: permissionEvaluator("manage")
    };

    return NextResponse.json(
      {
        view: listQuery.view,
        projectId: listQuery.projectId ?? null,
        search: listQuery.search ?? null,
        tasks: serializedTasks,
        stats,
        board,
        permissions,
        currentUserId: authContext.userId
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return taskErrorToResponse(error);
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
    const parsed = createTaskSchema.safeParse(body);

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

    if (!permissionEvaluator("create")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const projectId = normalizeProjectIdParam(parsed.data.projectId ?? null);
    const assignedToId = parsed.data.assignedToId ?? null;

    const task = await createTask(serviceClaims, {
      organizationId: authContext.organizationId,
      tenantId: authContext.tenantId,
      projectId: projectId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      createdById: authContext.userId,
      assignedToId,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      priority: parsed.data.priority,
      followerIds: parsed.data.followerIds ?? [],
      visibility: parsed.data.visibility
    });

    const owners = await fetchOwnerMap(
      accessToken,
      [task.createdById, task.assignedToId ?? undefined].filter((id): id is string => !!id),
      authContext.tenantId
    );

    if (task.assignedToId) {
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

    const serialized = transformTask(task, owners, { includeSubtasks: true });

    await emitTaskCreatedUsage(
      {
        accessToken,
        organizationId: authContext.organizationId,
        tenantId: authContext.tenantId,
        productId: authContext.productId
      },
      {
        id: task.id,
        createdAt: task.createdAt,
        projectId: task.projectId ?? null,
        assignedToId: task.assignedToId,
        createdById: task.createdById
      }
    );

    return NextResponse.json({ task: serialized }, { status: 201 });
  } catch (error) {
    return taskErrorToResponse(error);
  }
}
