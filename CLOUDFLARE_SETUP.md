# إعداد Cloudflare للإنتاج

## Pages

```text
Build command: npm run build
Output directory: dist
Node.js: 22.12+
```

## Variables

```text
PUBLIC_SITE_URL=https://example.com
```

اختياري:

```text
PUBLIC_SEO_API_URL=https://seo-api.example.workers.dev
```

## HTTPS

- SSL/TLS: Full (strict) عندما تكون الاستضافة مهيأة بشهادة صحيحة.
- Always Use HTTPS: ON.
- اختر نسخة رئيسية واحدة من الدومين وحوّل الأخرى 301 إليها.

## Access

أنشئ تطبيق Cloudflare Access لحماية:

```text
example.com/admin/*
example.com/seo-admin/*
```

اسمح فقط ببريد العميل والمطور/المدير المطلوب.

## Cache

القالب يرسل ترويسات طويلة المدة لـ:

```text
/_astro/*
/generated/images/*
```

ويعطي `/uploads/*` كاشًا مناسبًا. لا تطبق Cache Everything عشوائيًا على `/admin/` أو `/seo-admin/`.
