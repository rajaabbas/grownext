# Changelog

## Unreleased

### Security & Hardening
- Lock down Fastify CORS defaults to allow only `APP_BASE_URL`, with optional expansion via the new `API_CORS_ORIGINS` env.
- Disable proxy-trusting unless explicitly enabled through `TRUST_PROXY`, preventing spoofed IP headers from bypassing rate limits.
- Remove the `x-request-jwt-claims` response header to avoid leaking Supabase metadata.
- Require MFA verification during password changes and expose a matching UX for users prompted for TOTP codes.

### Developer Experience
- Document the new environment variables in the README and env templates so adopters understand the default security posture.
- Keep the signup error state accessible (persistent status element) for more reliable testing and screen-reader feedback.
- Add unit coverage for the password update flow, including MFA challenges, to guard against regressions.

### Verification
- `pnpm lint`
- `pnpm test`
- `pnpm e2e:test`
