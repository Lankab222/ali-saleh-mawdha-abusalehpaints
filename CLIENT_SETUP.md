# دليل إنشاء موقع عميل جديد

## 1) أنشئ نسخة مستقلة

لا تعدّل النسخة المرجعية مباشرة. انسخ القالب إلى مجلد/Repository جديد للعميل.

## 2) أدخل بيانات العميل مرة واحدة

أنشئ ملف الإعداد:

```bash
npm run client:init
```

سينشئ `client.config.json` من المثال. ثم عدّل: اسم النشاط، الدومين، المدينة، المنطقة، الهاتف، واتساب، البريد، العنوان، اللون، Repository وOAuth Worker.

نفّذ:

```bash
npm run client:setup
```

الأمر يحدث تلقائيًا:

- `src/content/settings/site.json`
- `src/content/seo-settings/settings.json`
- الدومين واسم النشاط والمدينة والهاتف داخل المحتوى النصي القديم.
- قيم Decap CMS الافتراضية.
- `repo` و`base_url` في `public/admin/config.yml` عند تزويدهما.
- ملفات الأمثلة والإعدادات التي تحتوي بيانات النسخة السابقة.

> القالب مصمم ليُنسخ من النسخة المرجعية لكل عميل. لا تستخدم `client:setup` للتبديل المتكرر بين عدة عملاء داخل نفس النسخة.

## 3) الصور والهوية

ضع صور العميل في `public/uploads/`. أهم الصور:

- `logo.webp`
- صورة Hero
- صورة من نحن
- صور الخدمات
- صور المقالات والمشاريع

يمكن تغيير المسارات من لوحة `/admin/` دون تعديل الكود.

بعد إضافة الصور:

```bash
npm run images:build
```

سيُنشأ تلقائيًا WebP وAVIF وأحجام متجاوبة، ويمكن دمج الشعار كعلامة مائية.

## 4) المحتوى

من `/admin/` راجع:

- إعدادات الموقع
- الخدمات
- المقالات
- المشاريع
- الأسئلة الشائعة
- آراء العملاء
- إعدادات SEO
- التحويلات 301/302

لا تنشر محتوى العميل السابق أو صوره على موقع العميل الجديد.

## 5) SEO قبل النشر

شغّل:

```bash
npm run validate
npm run seo:check
npm run build
npm run audit:dist
```

ثم راجع محليًا أو عبر Preview:

- `/robots.txt`
- `/sitemap-index.xml`
- `/seo-admin/`
- Canonical
- Schema
- ALT للصور
- العناوين والأوصاف
- الروابط الداخلية

## 6) Cloudflare Pages

الإعدادات المعتادة:

```text
Framework preset: Astro
Build command: npm run build
Build output: dist
Node: 22.12+
```

عرّف:

```text
PUBLIC_SITE_URL=https://domain.example
```

وإذا استخدمت SEO API:

```text
PUBLIC_SEO_API_URL=https://your-worker.workers.dev
```

## 7) Decap CMS

عدّل `public/admin/config.yml` تلقائيًا عبر `client:setup` أو يدويًا:

```yaml
backend:
  name: github
  repo: OWNER/REPOSITORY
  branch: main
  base_url: https://YOUR-OAUTH-WORKER.workers.dev
  auth_endpoint: auth
```

اختبر تسجيل الدخول والنشر قبل تسليم الموقع.

## 8) الحماية

طبّق Cloudflare Access على:

```text
/admin/*
/seo-admin/*
```

وتذكر أن `Disallow` في robots يمنع الزحف فقط ولا يمنع الأشخاص من الدخول.

## 9) محركات البحث

بعد النشر:

- Google Search Console: إضافة الدومين وإرسال `sitemap-index.xml`.
- Bing Webmaster Tools: إضافة الموقع وإرسال Sitemap.
- Google Business Profile: ربط رابط الموقع وملف النشاط الحقيقي.
- IndexNow اختياري: إعداد `INDEXNOW_KEY` ثم تشغيل `npm run indexnow` بعد النشر المهم.

## 10) تسليم العميل

أرسل للعميل:

- رابط الموقع.
- رابط `/admin/`.
- حساب GitHub/صلاحية المستودع المناسبة.
- تعليمات رفع الصور والمقالات.
- لا تسلمه أسرار OAuth أو مفاتيح API في ملف أو رسالة غير آمنة.
