-- Tasks database RLS policies
-- Apply via `supabase db push --config supabase/tasks/config.toml`

ALTER TABLE tasks.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tasks_service_only ON tasks.tasks;
CREATE POLICY tasks_service_only ON tasks.tasks
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
