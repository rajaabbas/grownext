import { NextResponse } from "next/server";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { createTask, listTasksForTenant } from "@ma/tasks-db";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { fetchOwner, fetchOwnerMap } from "./owners";
import { transformTask } from "./serializer";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional()
});

const writableRoles = new Set(["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR"]);

export async function GET() {
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

    const authContext = await getTasksAuthContext(session);

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const tasks = await listTasksForTenant(serviceClaims, authContext.tenantId);
    const owners = await fetchOwnerMap(
      accessToken,
      tasks.map((task) => task.createdById),
      authContext.tenantId
    );

    return NextResponse.json(
      {
        tasks: tasks.map((task) => transformTask(task, owners.get(task.createdById)))
      },
      { headers: { "Cache-Control": "no-store" } }
    );
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

    const accessToken = session.access_token;
    if (!accessToken) {
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

    const serviceClaims = buildServiceRoleClaims(authContext.organizationId);
    const task = await createTask(serviceClaims, {
      organizationId: authContext.organizationId,
      tenantId: authContext.tenantId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      createdById: authContext.userId,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
    });

    const owner = await fetchOwner(accessToken, task.createdById, authContext.tenantId);

    return NextResponse.json({ task: transformTask(task, owner ?? undefined) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
