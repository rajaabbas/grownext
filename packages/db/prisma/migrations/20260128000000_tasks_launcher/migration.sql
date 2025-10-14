-- Add launcher URL to products
ALTER TABLE "core"."products"
  ADD COLUMN "launcher_url" TEXT;

-- Task status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TaskStatus'
      AND n.nspname = 'core'
  ) THEN
    CREATE TYPE "core"."TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');
  END IF;
END $$;

-- Tasks table
CREATE TABLE IF NOT EXISTS "core"."tasks" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "core"."TaskStatus" NOT NULL DEFAULT 'OPEN',
  "assigned_to_id" UUID,
  "created_by_id" UUID NOT NULL,
  "due_date" TIMESTAMP WITHOUT TIME ZONE,
  "completed_at" TIMESTAMP WITHOUT TIME ZONE,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tasks_tenant_id_idx" ON "core"."tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tasks_organization_id_idx" ON "core"."tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_id_idx" ON "core"."tasks" ("assigned_to_id");

ALTER TABLE "core"."tasks"
  ADD CONSTRAINT "tasks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core"."tasks"
  ADD CONSTRAINT "tasks_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core"."tasks"
  ADD CONSTRAINT "tasks_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "core"."tasks"
  ADD CONSTRAINT "tasks_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
