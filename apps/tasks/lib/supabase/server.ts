import { cookies } from "next/headers";
import {
  createRouteHandlerClient,
  createServerComponentClient
} from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";

const ensureSupabaseEnv = () => {
  const defaultUrl = "https://example.supabase.co";
  const defaultAnonKey = "anon";

  process.env.SUPABASE_URL ??=
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_PROJECT_URL ?? defaultUrl;
  process.env.SUPABASE_ANON_KEY ??=
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? defaultAnonKey;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= process.env.SUPABASE_URL ?? defaultUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??=
    process.env.SUPABASE_ANON_KEY ?? defaultAnonKey;

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  };
};

export const getSupabaseServerComponentClient = () => {
  const { supabaseUrl, supabaseAnonKey } = ensureSupabaseEnv();
  return createServerComponentClient<BoilerplateDatabase>({ cookies }, {
    supabaseUrl,
    supabaseKey: supabaseAnonKey
  });
};

export const getSupabaseRouteHandlerClient = () => {
  const { supabaseUrl, supabaseAnonKey } = ensureSupabaseEnv();
  return createRouteHandlerClient<BoilerplateDatabase>({ cookies }, {
    supabaseUrl,
    supabaseKey: supabaseAnonKey
  });
};
