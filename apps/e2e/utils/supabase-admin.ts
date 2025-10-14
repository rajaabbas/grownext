import { createClient, SupabaseClient, type User } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseAdmin = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

let cachedClient: SupabaseClient | null = null;

const getClient = (): SupabaseClient => {
  if (!hasSupabaseAdmin) {
    throw new Error(
      "Supabase service role credentials are missing. Provide E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false
    }
  });

  return cachedClient;
};

const setUserEmailVerified = async (userId: string, verified: boolean): Promise<void> => {
  if (!hasSupabaseAdmin) {
    return;
  }

  const client = getClient();

  const { error } = await client.auth.admin.updateUserById(userId, {
    user_metadata: {
      email_verified: verified
    }
  });

  if (error) {
    throw new Error(`Failed to update email verification: ${error.message}`);
  }
};

export const markUserEmailVerified = async (userId: string): Promise<void> => {
  await setUserEmailVerified(userId, true);
};

export const resetUserEmailVerification = async (userId: string): Promise<void> => {
  await setUserEmailVerified(userId, false);
};

interface CreateSupabaseUserInput {
  email: string;
  password: string;
  emailVerified?: boolean;
  userMetadata?: Record<string, unknown>;
  appMetadata?: Record<string, unknown>;
}

export const createSupabaseUser = async (input: CreateSupabaseUserInput): Promise<User> => {
  if (!hasSupabaseAdmin) {
    throw new Error("Supabase admin credentials are required to create users");
  }

  const client = getClient();

  const { data, error } = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: input.emailVerified ?? true,
    user_metadata: input.userMetadata ?? {},
    app_metadata: input.appMetadata ?? {}
  });

  if (error || !data.user) {
    throw new Error(`Failed to create Supabase user: ${error?.message ?? "unknown error"}`);
  }

  return data.user;
};

interface UpdateSupabaseUserContextInput {
  userId: string;
  userMetadata?: Record<string, unknown>;
  appMetadata?: Record<string, unknown>;
}

export const updateSupabaseUserContext = async (input: UpdateSupabaseUserContextInput): Promise<void> => {
  if (!hasSupabaseAdmin) {
    return;
  }

  const client = getClient();
  const { error } = await client.auth.admin.updateUserById(input.userId, {
    user_metadata: input.userMetadata,
    app_metadata: input.appMetadata
  });

  if (error) {
    throw new Error(`Failed to update Supabase user context: ${error.message}`);
  }
};
