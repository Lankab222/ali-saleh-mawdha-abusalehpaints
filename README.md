# Alraqabi Astro Business Template

قالب عربي RTL لمواقع الخدمات المحلية، مبني على Astro ومهيأ لـCloudflare Pages وDecap CMS.

## المزايا

- Astro Static Site سريع وخفيف.
- SEO: Canonical، Open Graph، Twitter Cards، Sitemap، robots.txt وJSON-LD.
- Schema للهوية والخدمات والمقالات والأسئلة الشائعة وBreadcrumbs.
- لوحة Decap CMS لإدارة المحتوى والبيانات والصور والتحويلات.
- لوحة `/seo-admin/` للفحص الداخلي والزحف وحقول SEO والصور وربط Search Console/PageSpeed اختياريًا.
- نظام صور احترافي عبر Sharp: AVIF/WebP، `srcset`، Lazy Loading، أبعاد ثابتة، وإعادة استخدام النسخ غير المتغيرة.
- علامة مائية اختيارية مدمجة فعليًا داخل الصور المولدة باستخدام شعار الموقع.
- تحويلات 301/302 مركزية.
- IndexNow اختياري.
- إعداد عميل جديد من ملف واحد عبر `client:init` و`client:setup`.
- فحص للمصدر قبل البناء وفحص للـHTML الناتج بعد البناء.
- Workflow اختياري في GitHub Actions لفحص الـBuild تلقائيًا.
- ترويسات أمان وكاش مناسبة لـCloudflare Pages.

## البداية

ابدأ من [`README_FIRST.md`](./README_FIRST.md)، ثم راجع:

- [`CLIENT_SETUP.md`](./CLIENT_SETUP.md)
- [`IMAGE_SYSTEM.md`](./IMAGE_SYSTEM.md)
- [`CLOUDFLARE_SETUP.md`](./CLOUDFLARE_SETUP.md)
- [`DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md)
- [`TEMPLATE_RELEASE_NOTES.md`](./TEMPLATE_RELEASE_NOTES.md)

## تشغيل محلي

```bash
npm install
npm run dev
```

وفي نافذة ثانية:

```bash
npm run cms
```

لوحة Decap المحلية:

```text
http://localhost:4321/admin/index.html
```

## فحص وبناء الإنتاج

```bash
npm run validate
npm run build
npm run audit:dist
```

أو:

```bash
npm run quality
```

`npm run build` يشغّل تلقائيًا توليد التحويلات، تحسين الصور والعلامة المائية، وفحص إعدادات القالب قبل Astro build.
