# Worker ربط لوحة السيو بـ Google

يوفر مسارات قراءة فقط لـ Search Console وPageSpeed:

- `/health`
- `/performance?days=28`
- `/queries?days=28`
- `/pages?days=28`
- `/sitemaps`
- `POST /inspect`
- `/pagespeed?url=...&strategy=mobile`

## الإعداد
Search Console API
1. أنشئ Service Account في Google Cloud وفعّل Search Console API وURL Inspection API.
2. أضف بريد Service Account مستخدمًا إلى خاصية Search Console `sc-domain:paintsriyadh.site`.
3. انشر Worker وأضف المتغيرات:
   - `SEARCH_CONSOLE_PROPERTY=sc-domain:paintsriyadh.site`
   - `ALLOWED_ORIGINS=https://paintsriyadh.site`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` كـ Secret
   - `PAGESPEED_API_KEY` كـ Secret اختياري
4. في Cloudflare Pages أضف:
   - `PUBLIC_SEO_API_URL=https://seo-api-worker.m-lankab.workers.dev`
5. أعد نشر الموقع.
   تمنكتكتنمت

## الحماية

احمِ `/seo-admin/*` ورابط Worker بواسطة Cloudflare Access. لا تضع مفتاح Google الخاص داخل ملفات الموقع أو JavaScript في المتصفح.

> هذا Worker للقراءة والمراقبة. لا يطلب فهرسة الصفحات العادية تلقائيًا.
