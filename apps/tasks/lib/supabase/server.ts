import { cookies } from "next/headers";
import {
  createRouteHandlerClient,
  createServerComponentClient
} from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";
import { resolveSupabaseConfig } from "./config";

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
