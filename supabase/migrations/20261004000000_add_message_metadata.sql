-- Chat stores small attachment references and optional source/reasoning data
-- here. Binary uploads remain in the private chat-attachments bucket.
alter table public.messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
