# Tasks Application

The Tasks product is a Next.js application backed by the dedicated `@ma/tasks-db` schema and the identity service for tenancy enforcement. It now supports:

- Project picker with list, board, and "My Tasks" views driven by `/api/tasks`.
- Extended task metadata (description, priority, due date) with optimistic field updates and toast feedback.
- Collaboration essentials: subtasks, comments, followers, and automatic follower enrichment via the identity service.
- A permissions center (`/tasks/settings?tenantId=...`) that surfaces overrides stored in `task_permission_policies` and allows per-project adjustments layered on top of identity roles.
- Notification hooks that enqueue BullMQ jobs on the `task-notifications` queue whenever assignments change, comments are posted, or due dates approach.

## HTTP Surface

| Route | Description |
|-------|-------------|
| `GET /api/tasks` | Returns tasks for the active tenant with optional `view` (`list`, `board`, `my`) and `projectId` filters. The payload includes stats, permissions, and board columns. |
| `POST /api/tasks` | Creates a task. Supports `title`, `description`, `projectId`, `priority`, `dueDate`, and optional initial followers. |
| `PATCH /api/tasks/:id` | Updates core fields (title, description, project, priority, dueDate, sort order) or status. Emits assignment + due-soon notifications when relevant. |
| `DELETE /api/tasks/:id` | Removes a task (requires manage permissions). |
| `GET/POST /api/tasks/:id/subtasks` | Lists or creates subtasks. |
| `PATCH/DELETE /api/tasks/:id/subtasks/:subtaskId` | Updates or deletes a subtask. |
| `GET/POST /api/tasks/:id/comments` | Lists comments or posts a new one. Followers + assignees receive notification jobs. |
| `DELETE /api/tasks/:id/comments/:commentId` | Removes a comment (manage permissions). |
| `GET/POST/DELETE /api/tasks/:id/followers` | Manage followers. POST defaults to the caller when `userId` is omitted. |
| `GET /api/projects` | Lists all projects and summary counters for the tenant. |
| `POST /api/projects` | Creates a project. |
| `PATCH /api/projects/:projectId` | Updates project details or archived state. |
| `GET /api/settings/permissions` | Lists task permission overrides (optionally filtered by project). |
| `POST /api/settings/permissions` | Upserts an override. |
| `DELETE /api/settings/permissions/:id` | Removes an override. |
| `GET /api/users` | Convenience wrapper around the identity service to decorate user IDs with email/name metadata. |

All routes expect a Supabase access token from the identity service. Authorization combines identity roles (ADMIN, MEMBER, etc.) with overrides defined in `task_permission_policies` via `buildTaskPermissionEvaluator`.

## Notifications

The API modules publish BullMQ jobs to `task-notifications` using `enqueueTaskNotification` from `apps/tasks/lib/queues`. The worker subscribes to the queue and currently logs the following job types:

- `task.assigned` – triggered when an assignee is set or changed.
- `task.commented` – triggered for new comments, fanning out to followers and the assignee.
- `task.dueSoon` – scheduled when due dates approach (24h threshold) via delayed jobs keyed by `task-dueSoon-<id>`.

## Front-end Notes

- Toasts appear in the top-right corner for successful mutations (creates, status changes, comments, follows) and client-detected due-soon reminders.
- The refreshed chrome includes a GN-branded top bar with a profile menu and a sidebar for Projects, Tasks, and Settings navigation.
- Projects can be created from the Tasks dashboard via the "New Project" dialog next to the project picker; the form posts to `/api/projects` and refreshes the picker and summaries automatically.
- The Projects view displays cards with live task counts per initiative and provides the same project creation flow as the dashboard.
- The board view groups tasks by status and provides "Move to …" buttons for quick status changes without drag-and-drop.
- The detail panel is the central place to edit description, dates, priority, project, subtasks, comments, and follower state.
- The permissions page relies on `/api/settings/permissions` and `/api/users` to render user-friendly rows and is intended for admins with `tasks:admin` entitlements.

## Background Jobs

Run `pnpm --filter @ma/worker dev` to process notification jobs during development. The worker uses the same `REDIS_URL` as the application queues; watch the logs for the stub "email" deliveries when tasks are assigned, commented, or nearing their due date.
