# Alraqabi Astro Business Template v2.0

قالب عربي RTL سريع لمواقع الخدمات المحلية مبني على Astro + Cloudflare Pages + Decap CMS.

## البداية السريعة لعميل جديد

1. انسخ هذا المجلد كاملًا إلى Repository جديد للعميل.
2. ثبّت الاعتمادات:

```bash
npm install
```

3. أنشئ ملف بيانات العميل:

```bash
npm run client:init
```

4. عدّل `client.config.json` فقط: الاسم، الدومين، المدينة، الهاتف، واتساب، البريد، اللون، Repo وOAuth.
5. طبّق البيانات:

```bash
npm run client:setup
```

6. استبدل الصور في `public/uploads/` أو ارفعها من `/admin/`.
7. نفّذ الفحص والبناء:

```bash
npm run validate
npm run build
npm run audit:dist
```

8. اربط Repository بـCloudflare Pages.

> لا تشغّل `client:setup` مرارًا للتبديل بين عملاء داخل المشروع نفسه. القالب المرجعي يُنسخ أولًا، ثم يطبق على عميل واحد.

## أوامر مهمة

```bash
npm run dev             # تشغيل الموقع؛ يجهز الصور تلقائيًا قبل التشغيل
npm run cms             # Decap CMS local backend في نافذة ثانية
npm run client:init     # إنشاء client.config.json من المثال
npm run client:setup    # تطبيق بيانات العميل
npm run images:build    # AVIF/WebP/srcset + علامة مائية + Cache incremental
npm run validate        # فحص إعدادات المصدر
npm run build           # redirects + images + validate + Astro build
npm run audit:dist      # فحص HTML الناتج والروابط والصور
npm run quality         # build ثم audit:dist
npm run indexnow        # إشعار IndexNow عند إعداد INDEXNOW_KEY
```

## صفحات الإدارة

- `/admin/` لإدارة المحتوى والإعدادات عبر Decap CMS.
- `/seo-admin/` لمراجعة SEO والزحف والفهرسة والأداء والصور.

احمِ الصفحتين في الإنتاج بواسطة Cloudflare Access؛ `robots.txt` لا يمثل حماية أمنية.

راجع بعد ذلك:

- `CLIENT_SETUP.md`
- `IMAGE_SYSTEM.md`
- `CLOUDFLARE_SETUP.md`
- `DEPLOY_CHECKLIST.md`
- `TEMPLATE_RELEASE_NOTES.md`
