-- GrowLand: اسکریپت کامل (نصب تازه + ارتقا). همان ترکیب supabase/migrations است.
-- در Supabase > SQL Editor کامل اجرا کنید؛ روی دیتابیس زنده امن و تکرارپذیر است.

-- این فایل را در Supabase > SQL Editor اجرا کن (چند بار اجرا کردنش مشکلی ایجاد نمی‌کند)
create extension if not exists pgcrypto;

create table if not exists fields (
  id bigint generated always as identity primary key,
  name text unique not null
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int,
  city text,
  phone text unique not null,
  password text not null,
  field text,
  role text not null default 'member' check (role in ('member','admin','super')),
  supervisor_id uuid references profiles(id) on delete set null,
  xp int not null default 0,
  created_at timestamptz default now()
);

create table if not exists skills (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  xp int not null default 0
);

create table if not exists reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  xp_awarded int not null default 0,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists report_messages (
  id bigint generated always as identity primary key,
  report_id bigint not null references reports(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists admin_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  from_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  count int not null default 0,
  unique (user_id, day)
);

-- امنیت مهم نیست: RLS خاموش و دسترسی کامل
alter table fields disable row level security;
alter table profiles disable row level security;
alter table skills disable row level security;
alter table reports disable row level security;
alter table report_messages disable row level security;
alter table admin_messages disable row level security;
alter table activity disable row level security;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- داده‌های اولیه
insert into fields (name) values ('برنامه نویسی'),('ترید'),('تولید محتوا'),('مدیریت'),('فروش')
on conflict (name) do nothing;
insert into profiles (name, phone, password, role, field)
values ('سوپر ادمین', '09333167279', 'Matin1384', 'super', 'مدیریت')
on conflict (phone) do nothing;

-- =====================================================================
-- GrowLand v4 — hardening migration
-- روی دیتابیس زنده امن است و چندبار اجرا کردنش مشکلی ایجاد نمی‌کند.
-- هیچ داده‌ای حذف نمی‌شود. قیدهای جدید با NOT VALID اضافه می‌شوند تا
-- ردیف‌های قدیمی خراب نشوند و فقط روی نوشتن‌های جدید اعمال شوند.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ۱) توابع کمکی خالص
-- ---------------------------------------------------------------------

-- ثابت‌های بازی (با rules.js در کلاینت یکی نگه دارید)
create or replace function gl_cfg(k text) returns int
language sql immutable as $$
  select case k
    when 'min_chars' then 150
    when 'min_words' then 15
    when 'min_distinct' then 20
    when 'report_xp' then 100
    when 'daily_cap' then 3
    when 'level_xp' then 1000
  end
$$;

-- «امروز» همیشه بر اساس تهران و ساعت سرور
create or replace function gl_today() returns date
language sql stable as $$
  select (now() at time zone 'Asia/Tehran')::date
$$;

create or replace function gl_now() returns timestamptz
language sql stable as $$ select now() $$;

-- یکسان‌سازی حروف عربی/فارسی (ي→ی ، ك→ک) و فاصله‌ها برای ذخیره
create or replace function gl_fa(t text) returns text
language sql immutable as $$
  select btrim(regexp_replace(
    translate(coalesce(t, ''), U&'\064A\0643', U&'\06CC\06A9'),
    '\s+', ' ', 'g'))
$$;

-- نرمال‌سازی کامل برای جستجو و تشخیص تکراری (معادل normFa در rules.js)
create or replace function gl_norm(t text) returns text
language sql immutable as $$
  select lower(btrim(regexp_replace(
    regexp_replace(
      translate(
        coalesce(t, ''),
        U&'\064A\0643\0629\06C0\0623\0625\0671\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9',
        U&'\06CC\06A9\0647\0647\0627\0627\0627' || '01234567890123456789'),
      '[\u200c\u200d\u0640\u064B-\u065F\u0670]', '', 'g'),
    '\s+', ' ', 'g')))
$$;

create or replace function gl_can_manage(a profiles, m profiles) returns boolean
language sql immutable as $$
  select a.id is not null and m.id is not null
     and (a.role = 'super' or (a.role = 'admin' and m.supervisor_id = a.id))
$$;

-- ---------------------------------------------------------------------
-- ۲) ستون‌ها و جدول‌های جدید
-- ---------------------------------------------------------------------
alter table profiles add column if not exists search_norm text;
alter table profiles add column if not exists active boolean not null default true;
alter table reports  add column if not exists content_hash text;

-- وضعیت «خوانده‌شده» روی سرور (به‌جای localStorage هر دستگاه)
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admin_messages' and column_name = 'read_at') then
    alter table admin_messages add column read_at timestamptz;
    update admin_messages set read_at = coalesce(created_at, now());
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'report_messages' and column_name = 'read_at') then
    alter table report_messages add column read_at timestamptz;
    update report_messages set read_at = coalesce(created_at, now());
  end if;
end $$;

-- تاریخچه XP (چه کسی، کی، چرا)
create table if not exists xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  delta int not null,
  reason text not null default '',
  kind text not null default 'admin' check (kind in ('report', 'admin', 'initial')),
  by_id uuid references profiles(id) on delete set null,
  report_id bigint references reports(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table xp_events disable row level security;

-- مانده فعلی XP هر کاربر به‌عنوان رکورد اولیه ثبت می‌شود (فقط یک بار)
insert into xp_events (user_id, delta, reason, kind, created_at)
select p.id, p.xp, 'مانده اولیه (پیش از ثبت تاریخچه)', 'initial', coalesce(p.created_at, now())
from profiles p
where p.xp > 0 and not exists (select 1 from xp_events e where e.user_id = p.id);

-- ---------------------------------------------------------------------
-- ۳) حوزه‌ها: اتصال واقعی profiles.field به fields.name
-- ---------------------------------------------------------------------
update profiles set field = btrim(field) where field is not null and field <> btrim(field);
update profiles set field = null where field is not null and field = '';
insert into fields (name)
select distinct field from profiles where field is not null
on conflict (name) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_field_fkey') then
    alter table profiles
      add constraint profiles_field_fkey foreign key (field) references fields(name)
      on update cascade on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ۴) تریگرها: یکپارچگی داده در خود دیتابیس
-- ---------------------------------------------------------------------
create or replace function trg_profiles_guard() returns trigger
language plpgsql as $$
declare
  cur uuid;
  hops int := 0;
  v_role text;
begin
  new.name := gl_fa(new.name);
  new.city := nullif(gl_fa(new.city), '');
  new.field := nullif(btrim(new.field), '');
  new.search_norm := gl_norm(coalesce(new.name, '') || ' ' || coalesce(new.city, ''));

  if new.supervisor_id is not null
     and (tg_op = 'INSERT' or new.supervisor_id is distinct from old.supervisor_id) then
    if new.supervisor_id = new.id then
      raise exception 'GL_SUP_SELF';
    end if;
    select role into v_role from profiles where id = new.supervisor_id;
    if v_role is null or v_role not in ('admin', 'super') then
      raise exception 'GL_SUP_NOT_ADMIN';
    end if;
    cur := new.supervisor_id;
    while cur is not null and hops < 100 loop
      if cur = new.id then
        raise exception 'GL_SUP_CYCLE';
      end if;
      select supervisor_id into cur from profiles where id = cur;
      hops := hops + 1;
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before insert or update on profiles
  for each row execute function trg_profiles_guard();

-- اگر ادمینی به عضو تبدیل شد، زیرمجموعه‌هایش همان لحظه و در همان تراکنش آزاد می‌شوند
create or replace function trg_profiles_demote() returns trigger
language plpgsql as $$
begin
  if new.role = 'member' and old.role <> 'member' then
    update profiles set supervisor_id = null where supervisor_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists profiles_demote on profiles;
create trigger profiles_demote after update of role on profiles
  for each row execute function trg_profiles_demote();

create or replace function trg_reports_prepare() returns trigger
language plpgsql as $$
begin
  new.content := btrim(new.content);
  new.content_hash := md5(gl_norm(new.content));
  return new;
end $$;

drop trigger if exists reports_prepare on reports;
create trigger reports_prepare before insert or update of content on reports
  for each row execute function trg_reports_prepare();

-- پرکردن داده‌های قدیمی (نام‌ها، ستون جستجو، هش گزارش‌ها)
update profiles set name = name
where search_norm is null or name is distinct from gl_fa(name) or city is distinct from nullif(gl_fa(city), '');
update reports set content_hash = md5(gl_norm(content)) where content_hash is null;

-- ---------------------------------------------------------------------
-- ۵) قیدهای CHECK (NOT VALID = فقط برای نوشتن‌های جدید)
-- ---------------------------------------------------------------------
-- پیش از افزودن قیدها، فقط ردیف‌های قدیمیِ نامعتبر اصلاح می‌شوند (معمولاً هیچ ردیفی نیست).
-- دلیل: PostgreSQL حتی با NOT VALID هر آپدیت بعدیِ یک ردیف نامعتبر را رد می‌کند.
update profiles set age = null where age is not null and (age < 5 or age > 120);
update profiles set xp = 0 where xp < 0;
update profiles set name = left(name, 80) where char_length(name) > 80;
update profiles set city = left(city, 80) where char_length(city) > 80;
update skills set xp = 0 where xp < 0;
update skills set name = left(name, 60) where char_length(name) > 60;
update reports set status = 'pending' where status not in ('pending', 'reviewed');
update reports set xp_awarded = 0 where xp_awarded < 0;
update report_messages set content = left(content, 2000) where char_length(content) > 2000;
update admin_messages set content = left(content, 2000) where char_length(content) > 2000;
update activity set count = 0 where count < 0;
update fields set name = left(name, 60) where char_length(name) > 60;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_profiles_xp') then
    alter table profiles add constraint chk_profiles_xp check (xp >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_profiles_age') then
    alter table profiles add constraint chk_profiles_age check (age is null or age between 5 and 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_profiles_name') then
    alter table profiles add constraint chk_profiles_name check (char_length(btrim(name)) between 1 and 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_profiles_city') then
    alter table profiles add constraint chk_profiles_city check (city is null or char_length(city) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_skills_name') then
    alter table skills add constraint chk_skills_name check (char_length(btrim(name)) between 1 and 60) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_skills_xp') then
    alter table skills add constraint chk_skills_xp check (xp >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_reports_status') then
    alter table reports add constraint chk_reports_status check (status in ('pending', 'reviewed')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_reports_len') then
    alter table reports add constraint chk_reports_len check (char_length(content) between 1 and 5000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_reports_xp') then
    alter table reports add constraint chk_reports_xp check (xp_awarded >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_report_messages_len') then
    alter table report_messages add constraint chk_report_messages_len check (char_length(content) between 1 and 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_admin_messages_len') then
    alter table admin_messages add constraint chk_admin_messages_len check (char_length(content) between 1 and 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_activity_count') then
    alter table activity add constraint chk_activity_count check (count >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_fields_name') then
    alter table fields add constraint chk_fields_name check (char_length(btrim(name)) between 1 and 60) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ۶) ایندکس‌ها
-- ---------------------------------------------------------------------
create index if not exists idx_skills_user              on skills (user_id);
create index if not exists idx_reports_user_created     on reports (user_id, created_at desc);
create index if not exists idx_reports_status_created   on reports (status, created_at desc);
create index if not exists idx_reports_user_hash        on reports (user_id, content_hash);
create index if not exists idx_report_messages_report   on report_messages (report_id, created_at);
create index if not exists idx_report_messages_sender   on report_messages (sender_id);
create index if not exists idx_admin_messages_user      on admin_messages (user_id, created_at desc);
create index if not exists idx_admin_messages_from      on admin_messages (from_id);
create index if not exists idx_profiles_supervisor      on profiles (supervisor_id);
create index if not exists idx_profiles_rank            on profiles (xp desc, created_at, id);
create index if not exists idx_profiles_field           on profiles (field);
create index if not exists idx_xp_events_user           on xp_events (user_id, created_at desc);
create index if not exists idx_xp_events_created        on xp_events (created_at);
create index if not exists idx_xp_events_report         on xp_events (report_id);
create index if not exists idx_activity_day             on activity (day);

-- ---------------------------------------------------------------------
-- ۷) نماهای رتبه‌بندی (رتبه پایدار و یکسان در همه‌جا)
-- ---------------------------------------------------------------------
drop view if exists skills_top3;
drop view if exists leaderboard;

create view leaderboard as
select p.id, p.name, p.age, p.city, p.field, p.role, p.xp, p.supervisor_id, p.created_at, p.search_norm,
       (row_number() over (order by p.xp desc, p.created_at asc, p.id asc))::int as rank
from profiles p
where p.active;

create view skills_top3 as
select t.id, t.user_id, t.name, t.xp
from (
  select s.id, s.user_id, s.name, s.xp,
         row_number() over (partition by s.user_id order by s.xp desc, s.id) as rn
  from skills s
) t
where t.rn <= 3;

-- ---------------------------------------------------------------------
-- ۸) توابع (RPC): همه قوانین حساس به‌صورت اتمیک روی سرور
-- ---------------------------------------------------------------------

-- ورود: رمز دیگر داخل URL کوئری نمی‌رود
create or replace function gl_login(p_phone text, p_password text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'active', active)
  from profiles where phone = p_phone and password = p_password limit 1
$$;

-- ثبت گزارش: درج گزارش + XP + تاریخچه + فعالیت امروز، همه در یک تراکنش
create or replace function submit_report(p_user uuid, p_content text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_text text := btrim(coalesce(p_content, ''));
  v_norm text;
  v_chars int;
  v_words int;
  v_distinct int;
  v_old int;
  v_xp int;
  v_earn int := 0;
  v_reason text := null;
  v_today date := gl_today();
  v_start timestamptz := gl_today()::timestamp at time zone 'Asia/Tehran';
  v_hash text;
  v_cnt int;
  v_rid bigint;
begin
  if p_user is null then raise exception 'GL_NO_USER'; end if;
  -- قفل سطر کاربر: ارسال‌های همزمان یک نفر پشت سر هم اجرا می‌شوند
  select xp into v_old from profiles where id = p_user and active for update;
  if not found then raise exception 'GL_NO_USER'; end if;

  if v_text = '' then raise exception 'GL_EMPTY'; end if;
  if char_length(v_text) > 5000 then raise exception 'GL_TOO_LONG'; end if;

  v_norm := btrim(regexp_replace(v_text, '\s+', ' ', 'g'));
  v_chars := char_length(v_norm);
  v_words := coalesce(array_length(string_to_array(v_norm, ' '), 1), 0);
  v_distinct := (select count(distinct c) from regexp_split_to_table(lower(replace(v_norm, ' ', '')), '') as c);
  v_hash := md5(gl_norm(v_text));

  if v_chars < gl_cfg('min_chars') then
    v_reason := 'too_short';
  elsif v_words < gl_cfg('min_words') then
    v_reason := 'few_words';
  elsif v_distinct < gl_cfg('min_distinct') then
    v_reason := 'low_variety';
  else
    select count(*) into v_cnt from reports
      where user_id = p_user and xp_awarded > 0 and created_at >= v_start;
    if v_cnt >= gl_cfg('daily_cap') then
      v_reason := 'daily_cap';
    elsif exists (select 1 from reports
                  where user_id = p_user and xp_awarded > 0 and content_hash = v_hash
                    and created_at > now() - interval '30 days') then
      v_reason := 'duplicate';
    else
      v_earn := gl_cfg('report_xp');
    end if;
  end if;

  insert into reports (user_id, content, xp_awarded)
  values (p_user, v_text, v_earn)
  returning id into v_rid;

  v_xp := v_old;
  if v_earn > 0 then
    update profiles set xp = xp + v_earn where id = p_user returning xp into v_xp;
    insert into xp_events (user_id, delta, reason, kind, by_id, report_id)
    values (p_user, v_earn, 'گزارش روزانه', 'report', p_user, v_rid);
    insert into activity (user_id, day, count) values (p_user, v_today, 1)
    on conflict (user_id, day) do update set count = activity.count + 1;
  end if;

  return jsonb_build_object('report_id', v_rid, 'earned', v_earn, 'reason', v_reason,
                            'xp', v_xp, 'old_xp', v_old);
end $$;

-- ویرایش/حذف گزارشِ بدون XP توسط خود عضو (گزارش‌های امتیازدار قابل تغییر نیستند)
create or replace function report_edit(p_user uuid, p_report bigint, p_content text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_text text := btrim(coalesce(p_content, ''));
  r reports;
begin
  select * into r from reports where id = p_report for update;
  if r.id is null or r.user_id is distinct from p_user then raise exception 'GL_FORBIDDEN'; end if;
  if r.xp_awarded > 0 or r.status <> 'pending' then raise exception 'GL_LOCKED'; end if;
  if v_text = '' then raise exception 'GL_EMPTY'; end if;
  if char_length(v_text) > 5000 then raise exception 'GL_TOO_LONG'; end if;
  update reports set content = v_text where id = p_report;
end $$;

create or replace function report_delete(p_user uuid, p_report bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r reports;
begin
  select * into r from reports where id = p_report for update;
  if r.id is null or r.user_id is distinct from p_user then raise exception 'GL_FORBIDDEN'; end if;
  if r.xp_awarded > 0 or r.status <> 'pending' then raise exception 'GL_LOCKED'; end if;
  delete from reports where id = p_report;
end $$;

-- تنظیم XP توسط ادمین: قفل سطر + تشخیص تعارض + ثبت در تاریخچه
create or replace function admin_set_xp(p_admin uuid, p_user uuid, p_new int, p_expected int, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a profiles;
  m profiles;
  v_delta int;
begin
  select * into a from profiles where id = p_admin;
  select * into m from profiles where id = p_user for update;
  if a.id is null or m.id is null then raise exception 'GL_NO_USER'; end if;
  if not gl_can_manage(a, m) then raise exception 'GL_FORBIDDEN'; end if;
  if p_new is null or p_new < 0 or p_new > 10000000 then raise exception 'GL_BAD_VALUE'; end if;
  if p_expected is not null and m.xp <> p_expected then raise exception 'GL_CONFLICT'; end if;
  v_delta := p_new - m.xp;
  if v_delta = 0 then
    return jsonb_build_object('xp', m.xp, 'delta', 0);
  end if;
  update profiles set xp = p_new where id = p_user;
  insert into xp_events (user_id, delta, reason, kind, by_id)
  values (p_user, v_delta, coalesce(nullif(btrim(p_reason), ''), 'تنظیم توسط ادمین'), 'admin', p_admin);
  return jsonb_build_object('xp', p_new, 'delta', v_delta);
end $$;

-- ویرایش نمودار هفتگی: فقط روزهای تغییرکرده، با تشخیص تعارض (بدون بازنویسی کورکورانه)
create or replace function admin_set_activity(p_admin uuid, p_user uuid, p_changes jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a profiles;
  m profiles;
  r jsonb;
  v_day date;
  v_count int;
  v_exp int;
  v_cur int;
  v_saved int := 0;
  v_conf jsonb := '[]'::jsonb;
begin
  select * into a from profiles where id = p_admin;
  select * into m from profiles where id = p_user;
  if a.id is null or m.id is null then raise exception 'GL_NO_USER'; end if;
  if not gl_can_manage(a, m) then raise exception 'GL_FORBIDDEN'; end if;

  for r in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    v_day := (r->>'day')::date;
    v_count := greatest(0, least(coalesce((r->>'count')::int, 0), 1000));
    v_exp := coalesce((r->>'expected')::int, 0);
    if v_day > gl_today() or v_day < gl_today() - 10 then
      continue;
    end if;
    select ac.count into v_cur from activity ac where ac.user_id = p_user and ac.day = v_day for update;
    if not found then v_cur := 0; end if;
    if v_cur <> v_exp then
      v_conf := v_conf || to_jsonb(v_day::text);
      continue;
    end if;
    insert into activity (user_id, day, count) values (p_user, v_day, v_count)
    on conflict (user_id, day) do update set count = excluded.count;
    v_saved := v_saved + 1;
  end loop;
  return jsonb_build_object('saved', v_saved, 'conflicts', v_conf);
end $$;

-- پیام ادمین به عضو
create or replace function send_admin_message(p_from uuid, p_user uuid, p_content text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles;
  m profiles;
  v_text text := btrim(coalesce(p_content, ''));
begin
  select * into a from profiles where id = p_from;
  select * into m from profiles where id = p_user;
  if a.id is null or m.id is null then raise exception 'GL_NO_USER'; end if;
  if not gl_can_manage(a, m) then raise exception 'GL_FORBIDDEN'; end if;
  if v_text = '' then raise exception 'GL_EMPTY'; end if;
  if char_length(v_text) > 2000 then raise exception 'GL_TOO_LONG'; end if;
  insert into admin_messages (user_id, from_id, content) values (p_user, p_from, v_text);
end $$;

-- پیام در گفتگوی گزارش + تغییر وضعیت، اتمیک
create or replace function send_report_message(p_sender uuid, p_report bigint, p_content text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s profiles;
  r reports;
  v_owner profiles;
  v_text text := btrim(coalesce(p_content, ''));
begin
  select * into s from profiles where id = p_sender;
  select * into r from reports where id = p_report for update;
  if s.id is null or r.id is null then raise exception 'GL_NO_USER'; end if;
  select * into v_owner from profiles where id = r.user_id;
  if p_sender <> r.user_id and not gl_can_manage(s, v_owner) then raise exception 'GL_FORBIDDEN'; end if;
  if v_text = '' then raise exception 'GL_EMPTY'; end if;
  if char_length(v_text) > 2000 then raise exception 'GL_TOO_LONG'; end if;
  insert into report_messages (report_id, sender_id, content) values (p_report, p_sender, v_text);
  if p_sender <> r.user_id then
    update reports set status = 'reviewed' where id = p_report;
  elsif r.status = 'reviewed' then
    update reports set status = 'pending' where id = p_report;
  end if;
end $$;

create or replace function admin_mark_reviewed(p_admin uuid, p_report bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles;
  r reports;
  v_owner profiles;
begin
  select * into a from profiles where id = p_admin;
  select * into r from reports where id = p_report;
  select * into v_owner from profiles where id = r.user_id;
  if not gl_can_manage(a, v_owner) then raise exception 'GL_FORBIDDEN'; end if;
  update reports set status = 'reviewed' where id = p_report;
end $$;

-- غیرفعال‌سازی و حذف عضو
create or replace function admin_set_active(p_admin uuid, p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles;
  m profiles;
begin
  select * into a from profiles where id = p_admin;
  select * into m from profiles where id = p_user;
  if a.id is null or m.id is null then raise exception 'GL_NO_USER'; end if;
  if p_admin = p_user or m.role = 'super' or not gl_can_manage(a, m) then raise exception 'GL_FORBIDDEN'; end if;
  update profiles set active = coalesce(p_active, true) where id = p_user;
end $$;

create or replace function super_delete_user(p_admin uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles;
  m profiles;
begin
  select * into a from profiles where id = p_admin;
  select * into m from profiles where id = p_user;
  if a.id is null or m.id is null then raise exception 'GL_NO_USER'; end if;
  if a.role <> 'super' or p_admin = p_user or m.role = 'super' then raise exception 'GL_FORBIDDEN'; end if;
  delete from profiles where id = p_user;
end $$;

-- اعلان‌ها (پیام ادمین + پاسخ در گفتگوی گزارش)
create or replace function my_unread(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'msgs', (select count(*) from admin_messages where user_id = p_user and read_at is null),
    'threads', (select count(*) from report_messages m join reports r on r.id = m.report_id
                where r.user_id = p_user and m.sender_id <> p_user and m.read_at is null)
  )
$$;

create or replace function mark_msgs_read(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update admin_messages set read_at = now() where user_id = p_user and read_at is null
$$;

create or replace function mark_thread_read(p_user uuid, p_report bigint) returns void
language sql security definer set search_path = public as $$
  update report_messages m set read_at = now()
  from reports r
  where r.id = m.report_id and m.report_id = p_report and r.user_id = p_user
    and m.sender_id <> p_user and m.read_at is null
$$;

-- آمار پنل ادمین (بدون لود کردن کل جدول‌ها)
create or replace function admin_counts(p_admin uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
  v_role text;
  v_start timestamptz := gl_today()::timestamp at time zone 'Asia/Tehran';
begin
  select id, role into v_id, v_role from profiles where id = p_admin;
  if v_id is null or v_role = 'member' then raise exception 'GL_FORBIDDEN'; end if;
  return (
    with scope as (
      select p.id, p.xp from profiles p where v_role = 'super' or p.supervisor_id = v_id
    )
    select jsonb_build_object(
      'members', (select count(*) from scope),
      'xp', (select coalesce(sum(xp), 0) from scope),
      'pending', (select count(*) from reports r join scope s on s.id = r.user_id where r.status = 'pending'),
      'today', (select count(*) from reports r join scope s on s.id = r.user_id where r.created_at >= v_start)
    )
  );
end $$;

-- گزارش‌های قابل مشاهده برای ادمین (صفحه‌بندی‌شده، بدون .in(ids))
create or replace function admin_reports(p_admin uuid, p_status text default 'pending', p_limit int default 20, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
  v_role text;
begin
  select id, role into v_id, v_role from profiles where id = p_admin;
  if v_id is null or v_role = 'member' then raise exception 'GL_FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(x order by x.created_at desc, x.id desc)
    from (
      select r.id, r.user_id, r.content, r.xp_awarded, r.status, r.created_at, p.name as user_name
      from reports r
      join profiles p on p.id = r.user_id
      where (v_role = 'super' or p.supervisor_id = v_id)
        and (p_status = 'all' or r.status = p_status)
      order by r.created_at desc, r.id desc
      limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
    ) x
  ), '[]'::jsonb);
end $$;

-- خلاصه رشد یک نفر در یک درخواست (مهارت‌ها، فعالیت ۱۲ هفته، streak سمت سرور)
create or replace function growth_summary(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := gl_today();
  v_streak int;
  v_longest int;
begin
  with d as (
    select ac.day from activity ac where ac.user_id = p_user and ac.count > 0 and ac.day <= v_today
  ),
  g as (
    select d.day, d.day - (row_number() over (order by d.day))::int as grp from d
  ),
  runs as (
    select grp, count(*) as n, max(day) as last_day from g group by grp
  )
  select coalesce(max(n) filter (where last_day >= v_today - 1), 0), coalesce(max(n), 0)
    into v_streak, v_longest
  from runs;

  return jsonb_build_object(
    'today', v_today,
    'streak', v_streak,
    'longest', v_longest,
    'reports', (select count(*) from reports where user_id = p_user),
    'valid_reports', (select count(*) from reports where user_id = p_user and xp_awarded > 0),
    'skills', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'xp', s.xp) order by s.id)
                        from skills s where s.user_id = p_user), '[]'::jsonb),
    'acts', coalesce((select jsonb_agg(jsonb_build_object('day', ac.day, 'count', ac.count))
                      from activity ac where ac.user_id = p_user and ac.day >= v_today - 83), '[]'::jsonb)
  );
end $$;

create or replace function community_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'members', count(*),
    'total_xp', coalesce(sum(p.xp), 0),
    'avg_level', coalesce(round(avg(p.xp / gl_cfg('level_xp') + 1)), 0),
    'reports', (select count(*) from reports),
    'top_name', (select l.name from leaderboard l where l.rank = 1 limit 1)
  )
  from profiles p where p.active
$$;

-- رتبه‌بندی هفتگی/ماهانه از روی تاریخچه XP
create or replace function leaderboard_period(p_days int, p_limit int default 20)
returns table (id uuid, name text, field text, role text, xp int, period_xp bigint, rank bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.field, p.role, p.xp, sum(e.delta)::bigint as period_xp,
         row_number() over (order by sum(e.delta) desc, p.created_at, p.id) as rank
  from xp_events e
  join profiles p on p.id = e.user_id
  where e.created_at >= now() - make_interval(days => greatest(p_days, 1))
    and e.kind <> 'initial' and p.active
  group by p.id
  having sum(e.delta) > 0
  order by sum(e.delta) desc, p.created_at, p.id
  limit least(greatest(p_limit, 1), 100)
$$;

-- ---------------------------------------------------------------------
-- ۹) Realtime برای پیام‌ها (اگر در این پروژه فعال باشد)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table admin_messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table report_messages;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ۱۰) دسترسی‌ها (مطابق تصمیم فعلی پروژه: RLS خاموش)
-- ---------------------------------------------------------------------
alter table profiles disable row level security;
alter table xp_events disable row level security;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

notify pgrst, 'reload schema';
