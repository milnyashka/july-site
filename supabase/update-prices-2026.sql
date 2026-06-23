-- Run in Supabase SQL Editor to sync plan prices (USD source, RUB @ 79)

update public.plans set price = 0.15, price_usd = 0.15, price_rub = 10.00 where id = '3h';
update public.plans set price = 0.20, price_usd = 0.20, price_rub = 15.00 where id = '6h';
update public.plans set price = 0.45, price_usd = 0.45, price_rub = 38.00 where id = '12h';
update public.plans set price = 0.70, price_usd = 0.70, price_rub = 55.00 where id = '1d';
update public.plans set price = 4.50, price_usd = 4.50, price_rub = 350.00 where id = '7d';
update public.plans set price = 6.80, price_usd = 6.80, price_rub = 539.00 where id = '14d';
update public.plans set price = 11.00, price_usd = 11.00, price_rub = 849.00 where id = '30d';