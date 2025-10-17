DO $$
BEGIN
  CREATE TYPE "tasks"."TaskVisibility" AS ENUM ('PERSONAL', 'PROJECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tasks"."tasks"
  ADD COLUMN IF NOT EXISTS "visibility" "tasks"."TaskVisibility" NOT NULL DEFAULT 'PROJECT';
