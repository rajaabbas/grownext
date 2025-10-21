"use server";

import { NextResponse } from "next/server";
import type { PortalLauncherResponse, PortalPermission } from "@ma/contracts";
import { isPortalBillingEnabled } from "@/lib/feature-flags";
import { fetchPortalLauncher } from "@/lib/identity";
import {
  hasPortalPermission,
  resolvePortalPermissions
} from "@/lib/portal-permissions";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export type BillingAccess =
  | {
      kind: "allowed";
      accessToken: string;
      launcher: PortalLauncherResponse;
      permissions: Set<PortalPermission>;
    }
  | {
      kind: "error";
      response: NextResponse;
    };

const buildError = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status });

export const requireBillingAccess = async (): Promise<BillingAccess> => {
  if (!isPortalBillingEnabled()) {
    return {
      kind: "error",
      response: buildError({ error: "billing_disabled" }, 404)
    };
  }

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      kind: "error",
      response: buildError({ error: "unauthorized" }, 401)
    };
  }

  try {
    const launcher = await fetchPortalLauncher(session.access_token);
    const permissions = resolvePortalPermissions(
      launcher.user.organizationRole ?? null,
      launcher.rolePermissions
    );

    if (!hasPortalPermission(permissions, "organization:billing")) {
      return {
        kind: "error",
        response: buildError({ error: "forbidden" }, 403)
      };
    }

    return {
      kind: "allowed",
      accessToken: session.access_token,
      launcher,
      permissions
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message.includes("401") || message.includes("unauthorized") ? 401 : 502;

    return {
      kind: "error",
      response: buildError({ error: "billing_access_failed", message }, status)
    };
  }
};
