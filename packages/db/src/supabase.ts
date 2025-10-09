import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@ma/core";

export type ServiceSupabaseClient = SupabaseClient;

export const supabaseServiceClient: ServiceSupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);
