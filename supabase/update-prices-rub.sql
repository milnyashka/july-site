-- Run in Supabase SQL Editor — fixed RUB prices (not converted from USD)

update public.plans set price_rub = 10 where id = '3h';
update public.plans set price_rub = 15 where id = '6h';
update public.plans set price_rub = 38 where id = '12h';
update public.plans set price_rub = 55 where id = '1d';
update public.plans set price_rub = 350 where id = '7d';
update public.plans set price_rub = 539 where id = '14d';
update public.plans set price_rub = 849 where id = '30d';