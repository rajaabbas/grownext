import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { createComment, getTaskById, listCommentsForTask } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { fetchOwnerMap } from "../../owners";
import { resolvePermissionEvaluator } from "../../permissions";
import { transformComments } from "../../serializer";
import { enqueueTaskNotification } from "@/lib/queues";
import { requireRequestedWithHeader } from "@/lib/security";
import { emitTaskCommentUsage } from "@/lib/billing-usage";

const createCommentSchema = z.object({
  body: z.string().min(1)
});

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

export async function GET(request: Request, { params }: RouteParams) {
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

    const comments = await listCommentsForTask(serviceClaims, params.taskId, authContext.tenantId);

    const owners = await fetchOwnerMap(
      accessToken,
      comments.map((comment) => comment.createdById),
      authContext.tenantId
    );

    return NextResponse.json({ comments: transformComments(comments, owners) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
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
    const parsed = createCommentSchema.safeParse(body);

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

    if (!permissionEvaluator("comment")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const comment = await createComment(serviceClaims, params.taskId, authContext.tenantId, {
      body: parsed.data.body,
      createdById: authContext.userId
    });

    const task = await getTaskById(serviceClaims, params.taskId, authContext.tenantId);
    const recipients = new Set<string>();
    if (task.assignedToId) recipients.add(task.assignedToId);
    for (const follower of task.followers ?? []) {
      recipients.add(follower.userId);
    }
    recipients.add(task.createdById);
    recipients.delete(authContext.userId);
    if (recipients.size > 0) {
      await enqueueTaskNotification("task.commented", {
        taskId: task.id,
        tenantId: authContext.tenantId,
        commentId: comment.id,
        authorId: authContext.userId,
        recipients: Array.from(recipients),
        title: task.title
      });
    }

    const owners = await fetchOwnerMap(accessToken, [comment.createdById], authContext.tenantId);

    await emitTaskCommentUsage(
      {
        accessToken,
        organizationId: authContext.organizationId,
        tenantId: authContext.tenantId,
        productId: authContext.productId
      },
      {
        id: comment.id,
        createdAt: comment.createdAt,
        taskId: comment.taskId,
        createdById: comment.createdById
      }
    );

    return NextResponse.json({ comment: transformComments([comment], owners)[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
