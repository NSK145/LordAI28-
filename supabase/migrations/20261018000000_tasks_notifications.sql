-- The settings table is keyed by auth.users.id (UUID) in the existing schema.
-- Add missing preferences in place so existing settings remain intact.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_mode text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS voice_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS auto_speak boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own settings" ON public.user_settings;
CREATE POLICY "Users manage their own settings" ON public.user_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  done boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'med' CHECK (priority IN ('low', 'med', 'high')),
  due_at timestamptz,
  reminder_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS tasks_user_due_idx ON public.tasks(user_id, due_at) WHERE done = false;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
DROP POLICY IF EXISTS "Users manage their own tasks" ON public.tasks;
CREATE POLICY "Users manage their own tasks" ON public.tasks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS public.task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  due_at timestamptz NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, due_at),
  CONSTRAINT task_notifications_owner_fkey FOREIGN KEY (task_id, user_id)
    REFERENCES public.tasks(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS task_notifications_user_unread_idx ON public.task_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_notifications TO authenticated;
DROP POLICY IF EXISTS "Users manage their own task notifications" ON public.task_notifications;
CREATE POLICY "Users manage their own task notifications" ON public.task_notifications
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
