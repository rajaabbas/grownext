import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";
import { cookies } from "next/headers";

export const createServerSupabaseClient = () =>
  createServerComponentClient<BoilerplateDatabase, "public">({ cookies });
