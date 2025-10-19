import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm node scripts/grant-super-admin.mjs <email>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const findUserByEmail = async (targetEmail) => {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
};

try {
  const user = await findUserByEmail(email);
  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(2);
  }

  const existingAppMeta = user.app_metadata ?? {};
  const roles = new Set();

  const pushRoles = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim().length > 0) {
          roles.add(entry.trim());
        }
      }
      return;
    }
    if (typeof value === "string") {
      roles.add(value.trim());
    }
  };

  pushRoles(existingAppMeta.roles);
  roles.add("super-admin");

  const nextAppMetadata = {
    ...existingAppMeta,
    roles: Array.from(roles),
    super_admin: true
  };

  const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: nextAppMetadata
  });

  if (updateError) {
    throw updateError;
  }

  console.log(`Updated user ${email} (${user.id}) with app_metadata`, updated?.user?.app_metadata ?? nextAppMetadata);
} catch (error) {
  console.error("Failed to grant super-admin role:", error.message ?? error);
  process.exit(1);
}
