-- اختیاری و دستی (داخل migrations نیست تا خودکار اجرا نشود).
-- پیش‌نیاز: Dashboard > Database > Webhooks را یک بار Enable کنید (افزونه pg_net).
-- قبل از اجرا دو مقدار را عوض کنید: YOUR-DOMAIN و YOUR_WEBHOOK_SECRET (همان WEBHOOK_SECRET در Vercel).
-- جایگزین: ساخت دو Webhook با همین تنظیمات از خود داشبورد.
drop trigger if exists push_admin_messages on public.admin_messages;
create trigger push_admin_messages after insert on public.admin_messages
  for each row execute function supabase_functions.http_request(
    'https://YOUR-DOMAIN/api/push', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"YOUR_WEBHOOK_SECRET"}', '{}', '5000');

drop trigger if exists push_report_messages on public.report_messages;
create trigger push_report_messages after insert on public.report_messages
  for each row execute function supabase_functions.http_request(
    'https://YOUR-DOMAIN/api/push', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"YOUR_WEBHOOK_SECRET"}', '{}', '5000');
