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
