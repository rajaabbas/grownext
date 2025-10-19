const DEFAULT_SUPABASE_URL = "https://example.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "anon";

export const resolveSupabaseConfig = () => {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.SUPABASE_PROJECT_URL ??
    DEFAULT_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    DEFAULT_SUPABASE_ANON_KEY;

  return { supabaseUrl, supabaseAnonKey };
};
