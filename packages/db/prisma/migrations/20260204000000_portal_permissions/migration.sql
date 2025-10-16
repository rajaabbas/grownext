-- Create portal role permissions table
CREATE TABLE "core"."portal_role_permissions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portal_role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portal_role_permissions_org_role_key"
  ON "core"."portal_role_permissions" ("organization_id", "role");

ALTER TABLE "core"."portal_role_permissions"
  ADD CONSTRAINT "portal_role_permissions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
