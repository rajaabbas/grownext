/*
  Warnings:

  - You are about to drop the `example_records` table. If the table is not empty, all the data it contains will be lost.

*/
CREATE TYPE "core"."OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "core"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- Ensure updated_at helper supports camelCase and snake_case columns
create or replace function core.set_updated_at()
returns trigger as $$
begin
  if (to_jsonb(new) ? 'updatedAt') then
    new."updatedAt" = now();
  elsif (to_jsonb(new) ? 'updated_at') then
    new."updated_at" = now();
  end if;
  return new;
end;
$$ language plpgsql;

-- DropTable
DROP TABLE "core"."example_records";

-- CreateTable
CREATE TABLE "core"."organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."user_profiles" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "core"."organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "core"."OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."organization_invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "core"."OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "status" "core"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "core"."organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "core"."organization_members"("organization_id");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "core"."organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "core"."organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_user_id_key" ON "core"."organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_key" ON "core"."organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_idx" ON "core"."organization_invitations"("organization_id");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "core"."organization_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "core"."user_profiles"("email");

-- AddForeignKey
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Updated at triggers
drop trigger if exists organizations_set_updated_at on core.organizations;
create trigger organizations_set_updated_at
before update on core.organizations
for each row
execute function core.set_updated_at();

drop trigger if exists user_profiles_set_updated_at on core.user_profiles;
create trigger user_profiles_set_updated_at
before update on core.user_profiles
for each row
execute function core.set_updated_at();

drop trigger if exists organization_members_set_updated_at on core.organization_members;
create trigger organization_members_set_updated_at
before update on core.organization_members
for each row
execute function core.set_updated_at();

drop trigger if exists organization_invitations_set_updated_at on core.organization_invitations;
create trigger organization_invitations_set_updated_at
before update on core.organization_invitations
for each row
execute function core.set_updated_at();

-- Row level security policies
alter table core.organizations enable row level security;
alter table core.user_profiles enable row level security;
alter table core.organization_members enable row level security;
alter table core.organization_invitations enable row level security;

create policy organizations_select
  on core.organizations
  for select
  using (
    exists (
      select 1
      from core.organization_members m
      where m.organization_id = organizations.id
        and m.user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

create policy organizations_update
  on core.organizations
  for update
  using (
    exists (
      select 1
      from core.organization_members m
      where m.organization_id = organizations.id
        and m.user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub'
        and m.role in ('OWNER', 'ADMIN')
    )
  )
  with check (
    exists (
      select 1
      from core.organization_members m
      where m.organization_id = organizations.id
        and m.user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub'
        and m.role in ('OWNER', 'ADMIN')
    )
  );

create policy user_profiles_select
  on core.user_profiles
  for select
  using (user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub');

create policy user_profiles_update
  on core.user_profiles
  for update
  using (user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub')
  with check (user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub');

create policy organization_members_select
  on core.organization_members
  for select
  using (
    organization_id = current_setting('request.jwt.claims', true)::jsonb->>'organization_id'
  );

create policy organization_members_delete
  on core.organization_members
  for delete
  using (
    exists (
      select 1
      from core.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub'
        and m.role in ('OWNER', 'ADMIN')
    )
  );

create policy organization_members_update
  on core.organization_members
  for update
  using (
    exists (
      select 1
      from core.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub'
        and m.role in ('OWNER', 'ADMIN')
    )
  )
  with check (organization_id = current_setting('request.jwt.claims', true)::jsonb->>'organization_id');

create policy organization_invitations_select
  on core.organization_invitations
  for select
  using (
    organization_id = current_setting('request.jwt.claims', true)::jsonb->>'organization_id'
  );

create policy organization_invitations_insert
  on core.organization_invitations
  for insert
  with check (
    organization_id = current_setting('request.jwt.claims', true)::jsonb->>'organization_id'
    and invited_by_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    and exists (
      select 1
      from core.organization_members m
      where m.organization_id = organization_invitations.organization_id
        and m.user_id = organization_invitations.invited_by_id
        and m.role in ('OWNER', 'ADMIN')
    )
  );

create policy organization_invitations_update
  on core.organization_invitations
  for update
  using (
    organization_id = current_setting('request.jwt.claims', true)::jsonb->>'organization_id'
    and exists (
      select 1
      from core.organization_members m
      where m.organization_id = organization_invitations.organization_id
        and m.user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub'
        and m.role in ('OWNER', 'ADMIN')
    )
  )
  with check (
    organization_id = current_setting('request.jwt.claims', true)::jsonb->>'organization_id'
  );

create policy organization_invitations_delete
  on core.organization_invitations
  for delete
  using (
    organization_id = current_setting('request.jwt.claims', true)::jsonb->>'organization_id'
    and exists (
      select 1
      from core.organization_members m
      where m.organization_id = organization_invitations.organization_id
        and m.user_id::text = current_setting('request.jwt.claims', true)::jsonb->>'sub'
        and m.role in ('OWNER', 'ADMIN')
    )
  );

grant usage on schema core to authenticated;
grant select, insert, update, delete on core.organizations to authenticated;
grant select, insert, update, delete on core.user_profiles to authenticated;
grant select, insert, update, delete on core.organization_members to authenticated;
grant select, insert, update, delete on core.organization_invitations to authenticated;
