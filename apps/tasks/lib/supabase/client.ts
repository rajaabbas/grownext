"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";

export const getSupabaseClient = () =>
  createClientComponentClient<BoilerplateDatabase>();
