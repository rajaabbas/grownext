import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { addFollower, listFollowers, removeFollower } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { fetchOwnerMap } from "../../owners";
import { resolvePermissionEvaluator } from "../../permissions";
import { requireRequestedWithHeader } from "@/lib/security";

const modifyFollowerSchema = z.object({
  userId: z.string().min(1).optional()
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

const serializeFollowers = (followers: { userId: string; createdAt: Date }[], owners: Map<string, { id: string; email: string | null; fullName: string | null }>) =>
  followers.map((follower) => ({
    id: follower.userId,
    joinedAt: follower.createdAt.toISOString(),
    owner: owners.get(follower.userId) ?? { id: follower.userId, email: null, fullName: null }
  }));

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

    const followers = await listFollowers(serviceClaims, params.taskId, authContext.tenantId);
    const owners = await fetchOwnerMap(
      accessToken,
      followers.map((follower) => follower.userId),
      authContext.tenantId
    );

    return NextResponse.json({ followers: serializeFollowers(followers, owners) });
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
    const parsed = modifyFollowerSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const targetUserId = parsed.data.userId ?? authContext.userId;

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const permissionEvaluator = await resolvePermissionEvaluator({
      serviceClaims,
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      roles: authContext.roles
    });

    if (targetUserId !== authContext.userId && !permissionEvaluator("manage")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (targetUserId === authContext.userId && !permissionEvaluator("comment")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const follower = await addFollower(serviceClaims, params.taskId, authContext.tenantId, targetUserId);
    const owners = await fetchOwnerMap(accessToken, [follower.userId], authContext.tenantId);

    return NextResponse.json({ follower: serializeFollowers([follower], owners)[0] }, { status: 201 });
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

    const body = await request.json().catch(() => null);
    const parsed = modifyFollowerSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const targetUserId = parsed.data.userId ?? authContext.userId;

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const permissionEvaluator = await resolvePermissionEvaluator({
      serviceClaims,
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      roles: authContext.roles
    });

    if (targetUserId !== authContext.userId && !permissionEvaluator("manage")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (targetUserId === authContext.userId && !permissionEvaluator("comment")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await removeFollower(serviceClaims, params.taskId, authContext.tenantId, targetUserId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
