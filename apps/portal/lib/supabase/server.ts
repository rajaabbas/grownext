import { cookies } from "next/headers";
import {
  createRouteHandlerClient,
  createServerComponentClient
} from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";

const resolveSupabaseConfig = () => {
  const defaultUrl = "https://example.supabase.co";
  const defaultAnonKey = "anon";

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    defaultUrl;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    defaultAnonKey;

  return { supabaseUrl, supabaseAnonKey };
};

export const getSupabaseServerComponentClient = () => {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseConfig();
  return createServerComponentClient<BoilerplateDatabase>({ cookies }, {
    supabaseUrl,
    supabaseKey: supabaseAnonKey
  });
};

export const getSupabaseRouteHandlerClient = () => {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseConfig();
  return createRouteHandlerClient<BoilerplateDatabase>({ cookies }, {
    supabaseUrl,
    supabaseKey: supabaseAnonKey
  });
};
