import { cookies } from "next/headers";
import {
  createRouteHandlerClient,
  createServerComponentClient
} from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";

const ensureSupabaseEnv = () => {
  const defaultUrl = "https://example.supabase.co";
  const defaultAnonKey = "anon";

  process.env.SUPABASE_URL ??= process.env.NEXT_PUBLIC_SUPABASE_URL ?? defaultUrl;
  process.env.SUPABASE_ANON_KEY ??= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? defaultAnonKey;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= process.env.SUPABASE_URL ?? defaultUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??=
    process.env.SUPABASE_ANON_KEY ?? defaultAnonKey;
};

export const getSupabaseServerComponentClient = () => {
  ensureSupabaseEnv();
  return createServerComponentClient<BoilerplateDatabase>({ cookies });
};

export const getSupabaseRouteHandlerClient = () => {
  ensureSupabaseEnv();
  return createRouteHandlerClient<BoilerplateDatabase>({ cookies });
};
