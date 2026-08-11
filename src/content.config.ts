import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const faqItem = z.object({
  question: z.string(),
  answer: z.string(),
});

const seoFields = {
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  focusKeyword: z.string().optional(),
  canonical: z.string().optional(),
  noindex: z.boolean().default(false),
  ogImage: z.string().optional(),
  indexingPriority: z.enum(["عالية", "عادية", "منخفضة"]).default("عادية"),
};

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    ...seoFields,
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    category: z.string().default("مقالات ونصائح"),
    tags: z.array(z.string()).default([]),
    author: z.string().default("فريق الموقع"),
    relatedServices: z.array(z.string()).default([]),
    faq: z.array(faqItem).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/services" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    shortDescription: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    icon: z.string().optional(),
    order: z.coerce.number().default(0),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    features: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    serviceArea: z.array(z.string()).default([]),
    faq: z.array(faqItem).default([]),
    updatedDate: z.coerce.date().optional(),
    ...seoFields,
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string().default("مشاريع"),
    location: z.string().optional(),
    completionDate: z.coerce.date().optional(),
    coverImage: z.string().optional(),
    coverImageAlt: z.string().optional(),
    gallery: z.array(z.object({ image: z.string(), alt: z.string() })).default([]),
    services: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    order: z.coerce.number().default(0),
    ...seoFields,
  }),
});

const imageProcessingSchema = z.object({
  enabled: z.boolean().default(true),
  processUnreferenced: z.boolean().default(false),
  widths: z.array(z.coerce.number().int().positive()).default([480, 768, 1200, 1600]),
  webpQuality: z.coerce.number().min(40).max(100).default(82),
  avifQuality: z.coerce.number().min(30).max(100).default(58),
  warnAboveKb: z.coerce.number().positive().default(500),
});

const watermarkSchema = z.object({
  enabled: z.boolean().default(true),
  logo: z.string().optional(),
  position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).default("bottom-right"),
  opacity: z.coerce.number().min(0.05).max(1).default(0.5),
  sizePercent: z.coerce.number().min(5).max(40).default(14),
  padding: z.coerce.number().min(0).max(200).default(24),
  applyTo: z.array(z.enum(["service", "blog", "project", "content", "card"])).default(["service", "blog", "project", "content", "card"]),
});

const settings = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/settings" }),
  schema: z.object({
    siteName: z.string(),
    siteTitle: z.string(),
    description: z.string(),
    siteUrl: z.string().url(),
    locale: z.string().default("ar-SA"),
    businessType: z.string().default("LocalBusiness"),
    city: z.string(),
    region: z.string().optional(),
    country: z.string().default("SA"),
    serviceAreas: z.array(z.string()).default([]),
    services: z.array(z.string()).default([]),
    openingHours: z.string().optional(),
    priceRange: z.string().optional(),
    logo: z.string().optional(),
    defaultImage: z.string().default("/uploads/og-default.jpg"),
    heroBadge: z.string().optional(),
    heroTitle: z.string(),
    heroDescription: z.string(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    heroPrimaryButtonText: z.string().default("تواصل معنا"),
    heroPrimaryButtonUrl: z.string().default("/contact/"),
    heroSecondaryButtonText: z.string().optional(),
    heroSecondaryButtonUrl: z.string().optional(),
    heroPoints: z.array(z.string()).default([]),
    aboutBadge: z.string().optional(),
    aboutTitle: z.string(),
    aboutDescription: z.string(),
    aboutImage: z.string().optional(),
    aboutImageAlt: z.string().optional(),
    aboutButtonText: z.string().default("تعرف علينا"),
    aboutButtonUrl: z.string().default("/about/"),
    aboutFeatures: z.array(z.string()).default([]),
    ctaTitle: z.string(),
    ctaDescription: z.string(),
    ctaButtonText: z.string().default("تواصل معنا"),
    ctaButtonUrl: z.string().default("/contact/"),
    phone: z.string().optional(),
    phoneDisplay: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    googleBusinessProfileUrl: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    x: z.string().optional(),
    youtube: z.string().optional(),
    primaryColor: z.string().default("#8a6a32"),
    footerText: z.string().default("جميع الحقوق محفوظة"),
    developerCredit: z.object({
      enabled: z.boolean().default(true),
      name: z.string().default("محمد الرقابي"),
      whatsapp: z.string().default("967730266665"),
    }).default({ enabled: true, name: "محمد الرقابي", whatsapp: "967730266665" }),
    imageProcessing: imageProcessingSchema.default({
      enabled: true,
      processUnreferenced: false,
      widths: [480, 768, 1200, 1600],
      webpQuality: 82,
      avifQuality: 58,
      warnAboveKb: 500,
    }),
    watermark: watermarkSchema.default({
      enabled: true,
      position: "bottom-right",
      opacity: 0.5,
      sizePercent: 14,
      padding: 24,
      applyTo: ["service", "blog", "project", "content", "card"],
    }),
  }),
});

const seoSettings = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/seo-settings" }),
  schema: z.object({
    titleTemplate: z.string().default("%s"),
    defaultDescription: z.string(),
    defaultImage: z.string().default("/uploads/og-default.jpg"),
    searchConsoleProperty: z.string().default(""),
    googleSiteVerification: z.string().optional(),
    bingSiteVerification: z.string().optional(),
    googleBusinessProfileUrl: z.string().optional(),
    noindexTagPages: z.boolean().default(true),
    noindexCategoryPages: z.boolean().default(true),
    robots: z.object({
      allowAll: z.boolean().default(true),
      disallow: z.array(z.string()).default(["/admin/", "/seo-admin/", "/seo-api/"]),
    }),
    audit: z.object({
      minimumTitleLength: z.coerce.number().default(30),
      maximumTitleLength: z.coerce.number().default(65),
      minimumDescriptionLength: z.coerce.number().default(80),
      maximumDescriptionLength: z.coerce.number().default(165),
      minimumContentCharacters: z.coerce.number().default(700),
      reviewScore: z.coerce.number().default(80),
      targetPerformanceScore: z.coerce.number().default(90),
    }),
  }),
});

const redirects = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/redirects" }),
  schema: z.object({
    redirects: z.array(z.object({
      from: z.string(),
      to: z.string(),
      status: z.enum(["301", "302"]).default("301"),
      enabled: z.boolean().default(true),
      note: z.string().optional(),
    })).default([]),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/faq" }),
  schema: z.object({
    question: z.string(),
    answer: z.string(),
    category: z.string().default("عام"),
    order: z.coerce.number().default(0),
    published: z.boolean().default(true),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/testimonials" }),
  schema: z.object({
    name: z.string(),
    role: z.string().optional(),
    company: z.string().optional(),
    rating: z.coerce.number().min(1).max(5).default(5),
    image: z.string().optional(),
    quote: z.string(),
    order: z.coerce.number().default(0),
    published: z.boolean().default(true),
  }),
});

export const collections = {
  blog,
  services,
  projects,
  settings,
  faq,
  testimonials,
  seoSettings,
  redirects,
};
