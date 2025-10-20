-- Create new enums for user lifecycle and bulk operations
CREATE TYPE "core"."UserLifecycleStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "core"."SuperAdminBulkAction" AS ENUM ('ACTIVATE_USERS', 'SUSPEND_USERS', 'EXPORT_USERS');
CREATE TYPE "core"."SuperAdminBulkJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- Add lifecycle status column to user profiles
ALTER TABLE "core"."user_profiles"
  ADD COLUMN "status" "core"."UserLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- Super Admin bulk jobs table
CREATE TABLE "core"."super_admin_bulk_jobs" (
  "id" TEXT NOT NULL,
  "action" "core"."SuperAdminBulkAction" NOT NULL,
  "status" "core"."SuperAdminBulkJobStatus" NOT NULL DEFAULT 'PENDING',
  "user_ids" TEXT[] NOT NULL,
  "reason" TEXT,
  "total_count" INTEGER NOT NULL,
  "completed_count" INTEGER NOT NULL,
  "failed_count" INTEGER NOT NULL,
  "error_message" TEXT,
  "initiated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "super_admin_bulk_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "super_admin_bulk_jobs_initiated_by_id_fkey"
    FOREIGN KEY ("initiated_by_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "super_admin_bulk_jobs_initiated_by_id_idx"
  ON "core"."super_admin_bulk_jobs"("initiated_by_id");

-- Super Admin impersonation tokens table
CREATE TABLE "core"."super_admin_impersonation_tokens" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "reason" TEXT,
  "product_slug" TEXT,
  "expires_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "super_admin_impersonation_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "super_admin_impersonation_tokens_token_key" UNIQUE ("token"),
  CONSTRAINT "super_admin_impersonation_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "super_admin_impersonation_tokens_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "super_admin_impersonation_tokens_user_id_idx"
  ON "core"."super_admin_impersonation_tokens"("user_id");
CREATE INDEX "super_admin_impersonation_tokens_created_by_id_idx"
  ON "core"."super_admin_impersonation_tokens"("created_by_id");
CREATE INDEX "super_admin_impersonation_tokens_expires_at_idx"
  ON "core"."super_admin_impersonation_tokens"("expires_at");
