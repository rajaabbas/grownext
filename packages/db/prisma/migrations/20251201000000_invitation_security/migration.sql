create extension if not exists pgcrypto;

alter table core.organization_invitations
  add column token_hash text,
  add column token_hint text,
  add column issued_ip text,
  add column accepted_ip text,
  add column accepted_at timestamp(3);

update core.organization_invitations
set token_hash = encode(digest(token, 'sha256'), 'hex'),
    token_hint = right(token, 6)
where token_hash is null;

alter table core.organization_invitations
  alter column token_hash set not null;

drop index if exists core.organization_invitations_token_key;
alter table core.organization_invitations
  drop constraint if exists organization_invitations_token_key;

alter table core.organization_invitations
  drop column token;

create unique index organization_invitations_token_hash_key
  on core.organization_invitations(token_hash);
