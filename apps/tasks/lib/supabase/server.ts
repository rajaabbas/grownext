import { cookies } from "next/headers";
import {
  createRouteHandlerClient,
  createServerComponentClient
} from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.SUPABASE_PROJECT_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)."
  );
}

export const getSupabaseServerComponentClient = () =>
  createServerComponentClient<BoilerplateDatabase>({ cookies }, { supabaseUrl, supabaseKey: supabaseAnonKey });

export const getSupabaseRouteHandlerClient = () =>
  createRouteHandlerClient<BoilerplateDatabase>({ cookies }, { supabaseUrl, supabaseKey: supabaseAnonKey });
