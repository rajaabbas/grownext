import { NextResponse } from "next/server";

import {
  SuperAdminBulkJobCreateRequestSchema,
  SuperAdminBulkJobSchema,
  SuperAdminBulkJobsResponseSchema
} from "@ma/contracts";

import { createBulkJob, listBulkJobs } from "@/lib/identity";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const ensureSuperAdmin = async () => {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  }

  const roles = extractAdminRoles(session);
  if (!hasRequiredAdminRole(roles, ["super-admin"])) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { session };
};

export async function GET() {
  const result = await ensureSuperAdmin();
  if ("error" in result) {
    return result.error;
  }

  try {
    const jobs = await listBulkJobs(result.session.access_token);
    return NextResponse.json(SuperAdminBulkJobsResponseSchema.parse(jobs), { status: 200 });
  } catch (error) {
    console.error("Failed to list bulk jobs", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const result = await ensureSuperAdmin();
  if ("error" in result) {
    return result.error;
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = SuperAdminBulkJobCreateRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const job = await createBulkJob(result.session.access_token, parsedBody.data);
    return NextResponse.json(SuperAdminBulkJobSchema.parse(job), { status: 201 });
  } catch (error) {
    console.error("Failed to create bulk job", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
