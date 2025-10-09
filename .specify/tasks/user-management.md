# User Management Boilerplate Tasks

- Keep environment secrets out of version control. Use `.env.example` and per-app examples as the only tracked files.
- Apply Prisma migrations (including invitation token hashing) before promoting changes to shared environments.
- Ensure Supabase SMTP settings are configured so verification and recovery flows can deliver mail.
- Rate-limit auth endpoints and audit logs before production cutovers.
- Provide automated tests for invitation role changes, MFA toggles, and password reset flows when customizing this starter.
