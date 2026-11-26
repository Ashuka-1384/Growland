-- =====================================================================
-- GrowLand v5 — سرعت + مدیریت گزارش/کاربر
-- روی دیتابیس زنده امن است و چندبار اجرا کردنش مشکلی ایجاد نمی‌کند.
-- =====================================================================

-- ۱) ایندکس جستجو (برای ilike/like روی نام و شهر)
do $$
begin
  begin
    create extension if not exists pg_trgm;
  exception when others then null;
  end;
  begin
    execute 'create index if not exists idx_profiles_search_trgm on profiles using gin (search_norm gin_trgm_ops)';
  exception when others then
    begin
      execute 'create index if not exists idx_profiles_search_trgm on profiles using gin (search_norm extensions.gin_trgm_ops)';
    exception when others then null;
    end;
  end;
end $$;
create index if not exists idx_reports_user_paid on reports (user_id) where xp_awarded > 0;
create index if not exists idx_reports_created on reports (created_at desc);

-- ۲) رتبه‌ی یک نفر بدون محاسبه‌ی پنجره روی کل جدول
create or replace function gl_rank_of(p_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select (count(*) + 1)::int
  from profiles q, profiles p
  where p.id = p_id and p.active and q.active
    and (q.xp > p.xp
      or (q.xp = p.xp and (coalesce(q.created_at, 'infinity') < coalesce(p.created_at, 'infinity')
        or (coalesce(q.created_at, 'infinity') = coalesce(p.created_at, 'infinity') and q.id < p.id))))
$$;

-- ۳) نشانگرها در یک درخواست (به‌جای دو درخواست)
create or replace function app_badges(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_pending int := 0;
  v_u jsonb := my_unread(p_user);
begin
  select role into v_role from profiles where id = p_user;
  if v_role is not null and v_role <> 'member' then
    v_pending := coalesce((admin_counts(p_user)->>'pending')::int, 0);
  end if;
  return jsonb_build_object('msgs', coalesce((v_u->>'msgs')::int, 0),
                            'threads', coalesce((v_u->>'threads')::int, 0),
                            'pending', v_pending);
end $$;

-- ۴) بوت اپ: پروفایل + رتبه + نشانگرها در یک درخواست
create or replace function app_boot(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p profiles;
begin
  select * into p from profiles where id = p_user;
  if p.id is null then return null; end if;
  return jsonb_build_object(
    'self', jsonb_build_object('id', p.id, 'name', p.name, 'age', p.age, 'city', p.city, 'phone', p.phone,
              'field', p.field, 'role', p.role, 'xp', p.xp, 'supervisor_id', p.supervisor_id,
              'created_at', p.created_at, 'active', p.active),
    'rank', case when p.active then gl_rank_of(p.id) end,
    'badges', app_badges(p_user));
end $$;

-- ۵) لیست اعضا با مهارت‌های برتر در همان درخواست
create or replace function members_page(
  p_q text default '', p_field text default '', p_lo int default null, p_hi int default null,
  p_sort text default 'xp', p_limit int default 24, p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := gl_norm(p_q);
  v_total int;
  v_rows jsonb;
begin
  select count(*) into v_total from profiles p
  where p.active
    and (v_q = '' or strpos(p.search_norm, v_q) > 0)
    and (coalesce(p_field, '') = '' or p.field = p_field)
    and (p_lo is null or p.xp >= p_lo)
    and (p_hi is null or p.xp < p_hi);

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_rows from (
    select p.id, p.name, p.age, p.city, p.field, p.role, p.xp, p.supervisor_id, p.created_at,
           gl_rank_of(p.id) as rank,
           coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'xp', s.xp) order by s.xp desc, s.id)
                     from (select s2.id, s2.name, s2.xp from skills s2 where s2.user_id = p.id
                           order by s2.xp desc, s2.id limit 3) s), '[]'::jsonb) as skills
    from profiles p
    where p.active
      and (v_q = '' or strpos(p.search_norm, v_q) > 0)
      and (coalesce(p_field, '') = '' or p.field = p_field)
      and (p_lo is null or p.xp >= p_lo)
      and (p_hi is null or p.xp < p_hi)
    order by (case when p_sort = 'name' then p.name end) asc nulls last,
             (case when p_sort = 'new' then p.created_at end) desc nulls last,
             p.xp desc, p.created_at asc, p.id asc
    limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
  ) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end $$;

create or replace function member_public(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'age', p.age, 'city', p.city, 'field', p.field,
                            'role', p.role, 'xp', p.xp, 'supervisor_id', p.supervisor_id,
                            'created_at', p.created_at, 'rank', gl_rank_of(p.id))
  from profiles p where p.id = p_id and p.active
$$;

-- ۶) گزارش‌های ادمین با جستجو و فیلتر عضو
drop function if exists admin_reports(uuid, text, int, int);
create or replace function admin_reports(
  p_admin uuid, p_status text default 'pending', p_limit int default 20, p_offset int default 0,
  p_q text default '', p_user uuid default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
  v_role text;
  v_q text := lower(btrim(coalesce(p_q, '')));
  v_nq text := gl_norm(p_q);
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
        and (p_user is null or r.user_id = p_user)
        and (v_q = '' or strpos(p.search_norm, v_nq) > 0 or strpos(lower(r.content), v_q) > 0)
      order by r.created_at desc, r.id desc
      limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
    ) x
  ), '[]'::jsonb);
end $$;

-- ۷) حذف گزارش (تکی/گروهی) توسط ادمین؛ اختیاری: برگرداندن XP و فعالیت آن گزارش
create or replace function admin_delete_reports(p_admin uuid, p_ids bigint[], p_revoke boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a profiles;
  o profiles;
  r reports;
  v_del int := 0;
  v_xp int := 0;
  v_cur int;
  v_d int;
begin
  select * into a from profiles where id = p_admin;
  if a.id is null or a.role = 'member' then raise exception 'GL_FORBIDDEN'; end if;
  for r in select * from reports where id = any(coalesce(p_ids, '{}'::bigint[])) order by id for update loop
    select * into o from profiles where id = r.user_id;
    if not gl_can_manage(a, o) then raise exception 'GL_FORBIDDEN'; end if;
    if coalesce(p_revoke, false) and r.xp_awarded > 0 then
      select xp into v_cur from profiles where id = r.user_id for update;
      v_d := least(r.xp_awarded, coalesce(v_cur, 0));
      if v_d > 0 then
        update profiles set xp = xp - v_d where id = r.user_id;
        insert into xp_events (user_id, delta, reason, kind, by_id)
        values (r.user_id, -v_d, 'حذف گزارش توسط ادمین', 'admin', p_admin);
        v_xp := v_xp + v_d;
      end if;
      update activity set count = greatest(0, count - 1)
      where user_id = r.user_id and day = (r.created_at at time zone 'Asia/Tehran')::date;
    end if;
    delete from reports where id = r.id;
    v_del := v_del + 1;
  end loop;
  return jsonb_build_object('deleted', v_del, 'xp_revoked', v_xp);
end $$;

create or replace function admin_delete_user_reports(p_admin uuid, p_user uuid, p_revoke boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ids bigint[];
begin
  select coalesce(array_agg(id), '{}') into v_ids from reports where user_id = p_user;
  return admin_delete_reports(p_admin, v_ids, p_revoke);
end $$;

-- ۸) حذف کامل عضو: سوپر ادمین هر کسی (جز خودش)، ادمین فقط اعضای تحت سرپرستی خودش
create or replace function super_delete_user(p_admin uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles;
  m profiles;
begin
  select * into a from profiles where id = p_admin;
  select * into m from profiles where id = p_user;
  if a.id is null or m.id is null then raise exception 'GL_NO_USER'; end if;
  if p_admin = p_user then raise exception 'GL_FORBIDDEN'; end if;
  if not (a.role = 'super' or (a.role = 'admin' and m.role = 'member' and m.supervisor_id = a.id)) then
    raise exception 'GL_FORBIDDEN';
  end if;
  delete from profiles where id = p_user;
end $$;

grant execute on all functions in schema public to anon, authenticated;
notify pgrst, 'reload schema';
