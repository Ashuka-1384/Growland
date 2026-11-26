/**
 * لایه داده: همه‌ی فراخوانی‌های Supabase فقط از اینجا انجام می‌شوند.
 * هر تابع یا داده برمی‌گرداند یا ApiError (با پیام فارسی) پرتاب می‌کند؛
 * پس هیچ خطایی بی‌صدا نادیده گرفته نمی‌شود.
 */
import { sb, PUBLIC_COLS, SELF_COLS } from './db.js';
import { normFa, fixFa, fa2en, tierXpRange, escLike } from './rules.js';

/* ---------- خطا ---------- */
const MESSAGES = {
  GL_NO_USER: 'کاربر پیدا نشد',
  GL_FORBIDDEN: 'شما اجازه انجام این کار را ندارید',
  GL_EMPTY: 'متن نمی‌تواند خالی باشد',
  GL_TOO_LONG: 'متن بیش از حد طولانی است',
  GL_BAD_VALUE: 'مقدار واردشده مجاز نیست',
  GL_LOCKED: 'این گزارش دیگر قابل تغییر نیست',
  GL_CONFLICT: 'این مقدار هم‌زمان توسط شخص دیگری تغییر کرد؛ اطلاعات به‌روز شد، دوباره تلاش کنید',
  GL_SUP_SELF: 'یک نفر نمی‌تواند سرپرست خودش باشد',
  GL_SUP_NOT_ADMIN: 'سرپرست باید ادمین باشد',
  GL_SUP_CYCLE: 'این انتخاب باعث ایجاد حلقه در سرپرستی می‌شود',
  '23505': 'این مورد قبلاً ثبت شده است',
  '23503': 'این مورد به اطلاعات دیگری وابسته است',
  '23514': 'مقدار واردشده مجاز نیست',
  '22P02': 'مقدار واردشده معتبر نیست',
  PGRST202: 'دیتابیس به‌روز نیست؛ فایل supabase.sql را در Supabase اجرا کنید',
};
const NETWORK_RE = /failed to fetch|networkerror|network request|load failed|fetch|timeout|abort|offline/i;

export class ApiError extends Error {
  constructor(message, { code = '', network = false, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.network = network;
    this.cause = cause;
  }
}

export function toApiError(err) {
  if (err instanceof ApiError) return err;
  const msg = String(err?.message || '');
  const code = String(err?.code || '');
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  // پیام‌هایی که خودمان با raise exception 'GL_...' ساخته‌ایم
  const gl = Object.keys(MESSAGES).find((k) => k.startsWith('GL_') && msg.includes(k));
  if (gl) return new ApiError(MESSAGES[gl], { code: gl, cause: err });
  if (offline || (!code && NETWORK_RE.test(msg)) || err?.name === 'AbortError') {
    return new ApiError('ارتباط با سرور برقرار نشد. اینترنت خود را بررسی کنید و دوباره تلاش کنید.', { network: true, code: 'network', cause: err });
  }
  if (MESSAGES[code]) return new ApiError(MESSAGES[code], { code, cause: err });
  // کد/متن خطا هم نشان داده می‌شود تا ریشه‌یابی ساده باشد
  const detail = [code, msg].filter(Boolean).join(': ').slice(0, 140);
  return new ApiError(`خطای غیرمنتظره‌ای رخ داد${detail ? ` (${detail})` : ''}`, { code: code || 'unknown', cause: err });
}

/** اجرای یک query/rpc: خطا را به ApiError تبدیل می‌کند و {data,count} برمی‌گرداند */
async function run(builder) {
  let res;
  try {
    res = await builder;
  } catch (e) {
    throw toApiError(e);
  }
  if (res.error) throw toApiError(res.error);
  return { data: res.data, count: res.count ?? null };
}
const rpc = (name, args) => run(sb.rpc(name, args)).then((r) => r.data);

/* ---------- نشست و پروفایل ---------- */
export async function login(phone, password) {
  const data = await rpc('gl_login', { p_phone: fa2en(phone), p_password: password });
  if (!data) throw new ApiError('شماره یا رمز عبور اشتباه است', { code: 'bad_credentials' });
  if (data.active === false) throw new ApiError('حساب شما غیرفعال شده است. با ادمین تماس بگیرید.', { code: 'inactive' });
  return data.id;
}

/** null فقط وقتی برمی‌گردد که کاربر واقعاً وجود ندارد؛ خطای شبکه همیشه throw می‌شود */
export async function fetchSelf(id) {
  const { data } = await run(sb.from('profiles').select(SELF_COLS).eq('id', id).maybeSingle());
  return data;
}

/** بوت اپ در یک درخواست: پروفایل + رتبه + نشانگرها. اگر دیتابیس هنوز به‌روز نشده باشد به روش قدیمی برمی‌گردد */
export async function boot(id) {
  try {
    const d = await rpc('app_boot', { p_user: id });
    return d ? { user: d.self, rank: d.rank ?? null, badges: d.badges || null } : { user: null, rank: null, badges: null };
  } catch (e) {
    if (e?.code !== 'PGRST202') throw e;
    return { user: await fetchSelf(id), rank: null, badges: null };
  }
}
export const badges = (id) => rpc('app_badges', { p_user: id });

export async function register(f) {
  const { data } = await run(
    sb.from('profiles')
      .insert({
        name: fixFa(f.name), age: parseInt(fa2en(f.age), 10), city: fixFa(f.city),
        phone: fa2en(f.phone), password: f.password, field: f.field || null,
      })
      .select('id').single(),
  );
  return data.id;
}

export async function updateProfile(id, f) {
  const patch = {
    name: fixFa(f.name), age: parseInt(fa2en(f.age), 10), city: fixFa(f.city),
    phone: fa2en(f.phone), field: f.field || null,
  };
  if (f.password) patch.password = f.password;
  await run(sb.from('profiles').update(patch).eq('id', id));
}

export const listFields = () => run(sb.from('fields').select('id,name').order('id')).then((r) => r.data || []);

/* ---------- رشد، رتبه، تاریخچه ---------- */
export const growth = (id) => rpc('growth_summary', { p_user: id });

export async function xpHistory(id, limit = 15) {
  const { data } = await run(
    sb.from('xp_events').select('id,delta,reason,kind,created_at,by:profiles!by_id(name)')
      .eq('user_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit),
  );
  return data || [];
}

export const memberById = (id) => rpc('member_public', { p_id: id });

export async function myRank(id) {
  const m = await memberById(id);
  return m?.rank ?? null;
}

export const communityStats = () => rpc('community_stats');

/* ---------- اعضا (صفحه‌بندی سمت سرور؛ مهارت‌های برتر داخل همان پاسخ) ---------- */
export async function membersPage({ q = '', field = '', tier = '', sort = 'xp', offset = 0, limit = 24 }) {
  const range = tier ? tierXpRange(tier) : null;
  const d = await rpc('members_page', {
    p_q: normFa(q), p_field: field || '', p_lo: range ? range.lo : null, p_hi: range ? range.hi : null,
    p_sort: sort, p_limit: limit, p_offset: offset,
  });
  return { rows: d?.rows || [], total: d?.total ?? null };
}

export const leaderboardPeriod = (days, limit = 20) => rpc('leaderboard_period', { p_days: days, p_limit: limit });

/* ---------- گزارش‌ها ---------- */
export async function submitReport(userId, content) {
  return rpc('submit_report', { p_user: userId, p_content: content });
}

export async function myReports(userId, offset = 0, limit = 10) {
  const { data } = await run(
    sb.from('reports').select('id,user_id,content,xp_awarded,status,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + limit - 1),
  );
  return { rows: data || [], total: null };
}
export const editReport = (userId, id, content) => rpc('report_edit', { p_user: userId, p_report: id, p_content: content });
export const deleteReport = (userId, id) => rpc('report_delete', { p_user: userId, p_report: id });

export async function threadMessages(reportId, limit = 200) {
  const { data } = await run(
    sb.from('report_messages').select('id,sender_id,content,created_at,sender:profiles!sender_id(name)')
      .eq('report_id', reportId).order('created_at').order('id').limit(limit),
  );
  return data || [];
}
export const sendReportMessage = (senderId, reportId, content) =>
  rpc('send_report_message', { p_sender: senderId, p_report: reportId, p_content: content });
export const markThreadRead = (userId, reportId) => rpc('mark_thread_read', { p_user: userId, p_report: reportId });

/* ---------- پیام‌ها و اعلان‌ها ---------- */
export async function adminMessages(userId, limit = 50) {
  const { data } = await run(
    sb.from('admin_messages').select('id,content,created_at,read_at,sender:profiles!from_id(name)')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
  );
  return data || [];
}
export const unread = (userId) => rpc('my_unread', { p_user: userId });
export const markMsgsRead = (userId) => rpc('mark_msgs_read', { p_user: userId });

/* ---------- مدیریت ---------- */
export const adminCounts = (adminId) => rpc('admin_counts', { p_admin: adminId });

export async function adminReports(adminId, status, offset = 0, limit = 20, { q = '', user = null } = {}) {
  const rows = await rpc('admin_reports', { p_admin: adminId, p_status: status, p_limit: limit, p_offset: offset, p_q: q || '', p_user: user });
  return { rows: rows || [], total: null };
}
export const deleteReports = (adminId, ids, revoke = true) => rpc('admin_delete_reports', { p_admin: adminId, p_ids: ids, p_revoke: revoke });
export const deleteUserReports = (adminId, userId, revoke = true) => rpc('admin_delete_user_reports', { p_admin: adminId, p_user: userId, p_revoke: revoke });
export const markReviewed = (adminId, reportId) => rpc('admin_mark_reviewed', { p_admin: adminId, p_report: reportId });

const ADMIN_COLS = 'id,name,age,city,field,role,xp,supervisor_id,phone,active,created_at';
export async function adminMembers(me, { q = '', offset = 0, limit = 30 }) {
  let qb = sb.from('profiles').select(ADMIN_COLS, offset === 0 ? { count: 'exact' } : undefined);
  if (me.role !== 'super') qb = qb.eq('supervisor_id', me.id);
  const nq = normFa(q);
  if (nq) qb = qb.ilike('search_norm', `%${escLike(nq)}%`);
  const { data, count } = await run(qb.order('xp', { ascending: false }).order('created_at').order('id').range(offset, offset + limit - 1));
  return { rows: data || [], total: count };
}
export async function adminCandidates() {
  const { data } = await run(sb.from('profiles').select('id,name,role').in('role', ['admin', 'super']).order('name'));
  return data || [];
}

export const setXp = (adminId, userId, value, expected, reason) =>
  rpc('admin_set_xp', { p_admin: adminId, p_user: userId, p_new: value, p_expected: expected, p_reason: reason || '' });
export const setActivity = (adminId, userId, changes) => rpc('admin_set_activity', { p_admin: adminId, p_user: userId, p_changes: changes });
export const sendAdminMessage = (fromId, userId, content) => rpc('send_admin_message', { p_from: fromId, p_user: userId, p_content: content });
export const setActive = (adminId, userId, active) => rpc('admin_set_active', { p_admin: adminId, p_user: userId, p_active: active });
export const deleteUser = (adminId, userId) => rpc('super_delete_user', { p_admin: adminId, p_user: userId });

export const addSkill = (userId, name) => run(sb.from('skills').insert({ user_id: userId, name: fixFa(name), xp: 0 }));
export const saveSkill = (s) => run(sb.from('skills').update({ name: fixFa(s.name), xp: Math.max(0, parseInt(s.xp, 10) || 0) }).eq('id', s.id));
export const deleteSkill = (id) => run(sb.from('skills').delete().eq('id', id));

export const updateMember = (id, patch) => run(sb.from('profiles').update(patch).eq('id', id));

/* ---------- حوزه‌ها ---------- */
export const addField = (name) => run(sb.from('fields').insert({ name: fixFa(name) }));
export const renameField = (id, name) => run(sb.from('fields').update({ name: fixFa(name) }).eq('id', id));
export const deleteField = (id) => run(sb.from('fields').delete().eq('id', id));
export async function fieldUsage(name) {
  const { count } = await run(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('field', name));
  return count || 0;
}

/* ---------- اعلان پوش (اشتراک دستگاه) ---------- */
export const pushSave = (userId, sub) =>
  rpc('push_save', { p_user: userId, p_endpoint: sub.endpoint, p_p256dh: sub.keys?.p256dh, p_auth: sub.keys?.auth });
export const pushRemove = (endpoint) => rpc('push_remove', { p_endpoint: endpoint });
