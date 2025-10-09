"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface SupabaseListenerProps {
  accessToken?: string;
}

export const SupabaseListener = ({ accessToken }: SupabaseListenerProps) => {
  const router = useRouter();
  const supabase = useSupabaseClient();

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token !== accessToken) {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [accessToken, supabase, router]);

  return null;
};
