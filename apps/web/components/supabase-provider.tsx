"use client";

import { SessionContextProvider } from "@supabase/auth-helpers-react";
import type { Session } from "@supabase/supabase-js";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

interface SupabaseProviderProps {
  session: Session | null;
  children: React.ReactNode;
}

export const SupabaseProvider = ({ children, session }: SupabaseProviderProps) => {
  const [supabaseClient] = useState(() => createBrowserSupabaseClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={session}>
      {children}
    </SessionContextProvider>
  );
};
