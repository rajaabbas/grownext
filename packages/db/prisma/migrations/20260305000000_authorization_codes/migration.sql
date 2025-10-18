CREATE TABLE "core"."authorization_codes" (
  "id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "client_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "code_challenge" TEXT NOT NULL,
  "code_challenge_method" TEXT NOT NULL,
  "session_id" UUID,
  "nonce" TEXT,
  "roles" "core"."ProductRole"[] NOT NULL DEFAULT ARRAY[]::"core"."ProductRole"[],
  "email" TEXT,
  "expires_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "authorization_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "authorization_codes_expires_at_idx" ON "core"."authorization_codes"("expires_at");
CREATE UNIQUE INDEX "authorization_codes_code_hash_key" ON "core"."authorization_codes"("code_hash");
