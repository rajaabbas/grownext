create schema if not exists core;

create table if not exists core.example_records (
    id text primary key,
    tenant_id text not null,
    data jsonb,
    "createdAt" timestamptz not null default now(),
    "updatedAt" timestamptz not null default now()
);

create index if not exists example_records_tenant_idx on core.example_records (tenant_id);

create or replace function core.set_updated_at()
returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists example_records_set_updated_at on core.example_records;

create trigger example_records_set_updated_at
before update on core.example_records
for each row
execute function core.set_updated_at();

alter table core.example_records enable row level security;

create policy tenant_isolation_select
  on core.example_records
  for select
  to authenticated
  using ((current_setting('request.jwt.claims', true)::jsonb->>'tenant_id') = tenant_id);

create policy tenant_isolation_write
  on core.example_records
  for all
  to authenticated
  using ((current_setting('request.jwt.claims', true)::jsonb->>'tenant_id') = tenant_id)
  with check ((current_setting('request.jwt.claims', true)::jsonb->>'tenant_id') = tenant_id);

grant usage on schema core to authenticated;
grant select, insert, update, delete on core.example_records to authenticated;
