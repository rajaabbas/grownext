"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";

const resolveBrowserSupabaseConfig = () => {
  const defaultUrl = "https://example.supabase.co";
  const defaultAnonKey = "anon";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? defaultUrl;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? defaultAnonKey;

  return { supabaseUrl, supabaseAnonKey };
};

export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey } = resolveBrowserSupabaseConfig();
  return createClientComponentClient<BoilerplateDatabase>({
    supabaseUrl,
    supabaseKey: supabaseAnonKey
  });
};
