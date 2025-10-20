-- Align super_admin_bulk_jobs with updated Prisma schema
ALTER TABLE "core"."super_admin_bulk_jobs"
  ADD COLUMN IF NOT EXISTS "progress_message" TEXT,
  ADD COLUMN IF NOT EXISTS "progress_updated_at" TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS "failure_details" JSONB,
  ADD COLUMN IF NOT EXISTS "result_url" TEXT,
  ADD COLUMN IF NOT EXISTS "result_expires_at" TIMESTAMP WITHOUT TIME ZONE;
