#!/usr/bin/env tsx

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm promote:super-admin <user-email>");
  process.exit(1);
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.E2E_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Supabase credentials missing. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment."
  );
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const findUserByEmail = async (targetEmail: string) => {
  let page = 1;
  const perPage = 1000;

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
      email: targetEmail
    });

    if (error) {
      throw new Error(error.message);
    }

    const { users = [] } = data ?? {};
    const match = users.find((candidate) => candidate.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) {
      return match;
    }

    if (!users.length || users.length < perPage) {
      return null;
    }

    page += 1;
  }
};

let user;
try {
  user = await findUserByEmail(email);
} catch (err) {
  console.error("Failed to fetch user:", (err as Error).message);
  process.exit(1);
}

if (!user) {
  console.error(`No Supabase user found with email ${email}`);
  process.exit(1);
}

const existingAppMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
const existingUserMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;

const existingAppRoles = new Set<string>(
  Array.isArray(existingAppMetadata.roles)
    ? (existingAppMetadata.roles as unknown[])
        .filter((role): role is string => typeof role === "string")
        .map((role) => role.toLowerCase())
    : []
);
existingAppRoles.add("super-admin");

const updatedAppMetadata = {
  ...existingAppMetadata,
  roles: Array.from(existingAppRoles),
  "super-admin": true
};

const existingUserRoles = new Set<string>(
  Array.isArray(existingUserMetadata.roles)
    ? (existingUserMetadata.roles as unknown[])
        .filter((role): role is string => typeof role === "string")
        .map((role) => role.toLowerCase())
    : []
);
existingUserRoles.add("super-admin");

const updatedUserMetadata = {
  ...existingUserMetadata,
  roles: Array.from(existingUserRoles),
  "super-admin": true
};

const { error: updateError } = await client.auth.admin.updateUserById(user.id, {
  app_metadata: updatedAppMetadata,
  user_metadata: updatedUserMetadata
});

if (updateError) {
  console.error("Failed to promote user to super admin:", updateError.message);
  process.exit(1);
}

console.log(`✅ Promoted ${email} to super admin.`);
