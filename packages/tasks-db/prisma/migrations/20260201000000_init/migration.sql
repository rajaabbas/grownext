CREATE SCHEMA IF NOT EXISTS "tasks";

DO $$
BEGIN
  CREATE TYPE "tasks"."TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tasks"."tasks" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "tasks"."TaskStatus" NOT NULL DEFAULT 'OPEN',
  "assigned_to_id" UUID,
  "created_by_id" UUID NOT NULL,
  "due_date" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tasks_tenant_id_idx" ON "tasks"."tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tasks_organization_id_idx" ON "tasks"."tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_id_idx" ON "tasks"."tasks" ("assigned_to_id");
