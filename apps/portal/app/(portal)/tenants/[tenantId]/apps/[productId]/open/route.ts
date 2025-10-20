import { NextResponse } from "next/server";
import {
  fetchOrganizationProducts,
  fetchTenantDetail
} from "@/lib/identity";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

interface RouteParams {
  params: {
    tenantId: string;
    productId: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `/tenants/${encodeURIComponent(params.tenantId)}`);
    return NextResponse.redirect(loginUrl);
  }

  const tenantIdentifier = decodeURIComponent(params.tenantId);
  const productId = decodeURIComponent(params.productId);

  try {
    const detail = await fetchTenantDetail(session.access_token, tenantIdentifier);

    const application = detail.applications.find((app) => app.productId === productId);
    const isEnabled = !!application;
    if (!isEnabled) {
      const fallbackUrl = new URL(`/tenants/${encodeURIComponent(params.tenantId)}`, request.url);
      fallbackUrl.searchParams.set("error", "app_not_enabled");
      return NextResponse.redirect(fallbackUrl);
    }

    const organizationProducts = await fetchOrganizationProducts(
      session.access_token,
      detail.tenant.organizationId
    ).catch(() => null);

    const product = organizationProducts?.products.find((item) => item.id === productId);
    const launcherCandidate = product?.launcherUrl ?? application?.product.launcherUrl ?? null;

    if (!launcherCandidate) {
      const fallbackUrl = new URL(`/tenants/${encodeURIComponent(params.tenantId)}`, request.url);
      fallbackUrl.searchParams.set("error", "launcher_unavailable");
      return NextResponse.redirect(fallbackUrl);
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        tenant_id: detail.tenant.id,
        tenant_slug: detail.tenant.slug ?? detail.tenant.id,
        tenant_name: detail.tenant.name
      }
    });

    if (updateError) {
      const fallbackUrl = new URL(`/tenants/${encodeURIComponent(params.tenantId)}`, request.url);
      fallbackUrl.searchParams.set("error", "tenant_selection_failed");
      return NextResponse.redirect(fallbackUrl);
    }

    let redirectUrl = launcherCandidate;
    const setTenantParam = (url: URL) => {
      if (!url.searchParams.has("tenantId")) {
        url.searchParams.set("tenantId", detail.tenant.id);
      }
      return url.toString();
    };

    try {
      const parsed = new URL(launcherCandidate);
      redirectUrl = setTenantParam(parsed);
    } catch {
      try {
        const base = new URL(request.url);
        const parsed = new URL(launcherCandidate, base);
        redirectUrl = setTenantParam(parsed);
      } catch {
        const separator = launcherCandidate.includes("?") ? "&" : "?";
        redirectUrl = `${launcherCandidate}${separator}tenantId=${encodeURIComponent(detail.tenant.id)}`;
      }
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Failed to open tenant app", error);
    const fallbackUrl = new URL(`/tenants/${encodeURIComponent(params.tenantId)}`, request.url);
    fallbackUrl.searchParams.set("error", "app_launch_failed");
    return NextResponse.redirect(fallbackUrl);
  }
}
