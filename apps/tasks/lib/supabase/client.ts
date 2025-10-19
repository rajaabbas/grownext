"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";
import { resolveSupabaseConfig } from "./config";

export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseConfig();
  return createClientComponentClient<BoilerplateDatabase>({
    supabaseUrl,
    supabaseKey: supabaseAnonKey
  });
};
