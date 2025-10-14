import { cookies } from "next/headers";
import {
  createRouteHandlerClient,
  createServerComponentClient
} from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";

export const getSupabaseServerComponentClient = () =>
  createServerComponentClient<BoilerplateDatabase>({ cookies });

export const getSupabaseRouteHandlerClient = () =>
  createRouteHandlerClient<BoilerplateDatabase>({ cookies });
