create table if not exists public.chat_attachment_ocr_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  mime_type text not null check (mime_type like 'image/%' or mime_type = 'application/pdf'),
  extracted_text text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, content_sha256)
);

alter table public.chat_attachment_ocr_cache enable row level security;

create policy "Users can read their own attachment OCR cache"
  on public.chat_attachment_ocr_cache for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can save their own attachment OCR cache"
  on public.chat_attachment_ocr_cache for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own attachment OCR cache"
  on public.chat_attachment_ocr_cache for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
