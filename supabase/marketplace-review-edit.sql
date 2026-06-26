-- Редактирование отзывов покупателем (в течение 30 дней)
-- Запусти в Supabase SQL Editor

alter table public.marketplace_reviews
  add column if not exists updated_at timestamptz;

update public.marketplace_reviews
set updated_at = created_at
where updated_at is null;

drop policy if exists "Buyers update own reviews" on public.marketplace_reviews;
create policy "Buyers update own reviews" on public.marketplace_reviews
  for update
  using (
    auth.uid() = reviewer_id
    and created_at > now() - interval '30 days'
  )
  with check (auth.uid() = reviewer_id);