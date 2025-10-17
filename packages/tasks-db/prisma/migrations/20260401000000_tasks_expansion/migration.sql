DO $$
BEGIN
  CREATE TYPE "tasks"."TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tasks"."projects" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" VARCHAR(16),
  "created_by_id" UUID NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "projects_tenant_id_idx" ON "tasks"."projects" ("tenant_id");
CREATE INDEX IF NOT EXISTS "projects_organization_id_idx" ON "tasks"."projects" ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "projects_tenant_id_name_key" ON "tasks"."projects" ("tenant_id", "name");

ALTER TABLE "tasks"."tasks"
  ADD COLUMN IF NOT EXISTS "project_id" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" "tasks"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "tasks"."tasks"
  ADD CONSTRAINT "tasks_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "tasks"."projects"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "tasks_tenant_id_project_id_idx" ON "tasks"."tasks" ("tenant_id", "project_id");

CREATE TABLE IF NOT EXISTS "tasks"."task_subtasks" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "is_completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_by_id" UUID NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_subtasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_subtasks_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"."tasks"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "task_subtasks_task_id_idx" ON "tasks"."task_subtasks" ("task_id");
CREATE INDEX IF NOT EXISTS "task_subtasks_tenant_id_idx" ON "tasks"."task_subtasks" ("tenant_id");

CREATE TABLE IF NOT EXISTS "tasks"."task_comments" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_comments_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"."tasks"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "task_comments_task_id_idx" ON "tasks"."task_comments" ("task_id");
CREATE INDEX IF NOT EXISTS "task_comments_tenant_id_idx" ON "tasks"."task_comments" ("tenant_id");

CREATE TABLE IF NOT EXISTS "tasks"."task_followers" (
  "task_id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_followers_pkey" PRIMARY KEY ("task_id", "user_id"),
  CONSTRAINT "task_followers_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"."tasks"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "task_followers_tenant_id_idx" ON "tasks"."task_followers" ("tenant_id");

CREATE TABLE IF NOT EXISTS "tasks"."task_permission_policies" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT,
  "user_id" UUID NOT NULL,
  "can_manage" BOOLEAN NOT NULL DEFAULT FALSE,
  "can_edit" BOOLEAN NOT NULL DEFAULT FALSE,
  "can_comment" BOOLEAN NOT NULL DEFAULT TRUE,
  "can_assign" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_permission_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_permission_policies_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "tasks"."projects"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "task_permission_policies_tenant_id_idx"
  ON "tasks"."task_permission_policies" ("tenant_id");

CREATE INDEX IF NOT EXISTS "task_permission_policies_tenant_id_project_id_user_id_idx"
  ON "tasks"."task_permission_policies" ("tenant_id", "project_id", "user_id");
