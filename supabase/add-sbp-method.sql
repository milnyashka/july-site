-- Allow sbp and cryptobot top-up methods in topup_requests
alter table public.topup_requests
  drop constraint if exists topup_requests_method_check;

alter table public.topup_requests
  add constraint topup_requests_method_check
  check (method in ('crypto', 'card', 'sbp', 'cryptobot'));