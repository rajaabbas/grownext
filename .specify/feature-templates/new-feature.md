# New Feature Template

## Summary
- What problem are we solving?
- Which personas benefit?

## Data Model (optional)
- New tables or fields?
- Required RLS policies?

## API
- Endpoints to add or change.
- Contracts to extend (`@ma/contracts`).
- Validation rules and error cases.

## Worker Jobs
- Queues and job payloads.
- Idempotency and retry strategy.
- Downstream side effects.

## UI
- Screens or components involved (`@ma/ui` reuse preferred).
- Navigation changes.
- Accessibility considerations.

## Tests
- Unit / integration coverage expectations.
- Manual QA or smoke plans if applicable.
