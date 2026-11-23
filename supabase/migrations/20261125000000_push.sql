-- اشتراک اعلان پوش دستگاه‌ها. جدول مستقیم در دسترس کلید anon نیست؛ فقط با دو تابع زیر (و کلید سرویس در سرور).
create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);
alter table push_subscriptions disable row level security;
revoke all on push_subscriptions from anon, authenticated;

create or replace function push_save(p_user uuid, p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint is null or p_p256dh is null or p_auth is null then raise exception 'GL_BAD_VALUE'; end if;
  if not exists (select 1 from profiles where id = p_user and active) then raise exception 'GL_NO_USER'; end if;
  insert into push_subscriptions(user_id, endpoint, p256dh, auth) values (p_user, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create or replace function push_remove(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;

grant execute on function push_save(uuid, text, text, text) to anon, authenticated;
grant execute on function push_remove(text) to anon, authenticated;

notify pgrst, 'reload schema';
