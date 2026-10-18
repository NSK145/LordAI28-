-- Repair settings columns used by the app when a legacy user_settings table
-- was created without the full preference set. Defaults are applied only to
-- newly-added columns; existing settings and user data are preserved.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_mode text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS voice_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS auto_speak boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own settings" ON public.user_settings;
CREATE POLICY "Users manage their own settings"
  ON public.user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
