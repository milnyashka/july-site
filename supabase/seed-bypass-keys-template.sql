-- Шаблон для остальных тарифов July Bypass
-- plan_id в базе:
--   3h  = 3 часа
--   6h  = 6 часов
--   12h = 12 часов
--   1d  = 1 день (24 часа)
--   7d  = 7 дней
--   14d = 14 дней
--   30d = 30 дней

-- 6 часов
-- insert into public.license_keys (key, plan_id) values
--   ('Jule_XXXXX_6HOURS', '6h')
-- on conflict (key) do nothing;

-- 12 часов
-- insert into public.license_keys (key, plan_id) values
--   ('Jule_XXXXX_12HOURS', '12h')
-- on conflict (key) do nothing;

-- 1 день / 24 часа
-- insert into public.license_keys (key, plan_id) values
--   ('Jule_XXXXX_1DAY', '1d')
-- on conflict (key) do nothing;

-- 7 дней
-- insert into public.license_keys (key, plan_id) values
--   ('Jule_XXXXX_7DAYS', '7d')
-- on conflict (key) do nothing;

-- 14 дней
-- insert into public.license_keys (key, plan_id) values
--   ('Jule_XXXXX_14DAYS', '14d')
-- on conflict (key) do nothing;

-- 30 дней
-- insert into public.license_keys (key, plan_id) values
--   ('Jule_XXXXX_30DAYS', '30d')
-- on conflict (key) do nothing;