export type ContentKind = "مقال" | "خدمة" | "مشروع";

export type AuditThresholds = {
  minimumTitleLength: number;
  maximumTitleLength: number;
  minimumDescriptionLength: number;
  maximumDescriptionLength: number;
  minimumContentCharacters: number;
  reviewScore: number;
  targetPerformanceScore: number;
};

export type AuditSource = {
  id: string;
  collection: "blog" | "services" | "projects";
  kind: ContentKind;
  title: string;
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  canonical?: string;
  noindex?: boolean;
  indexingPriority?: "عالية" | "عادية" | "منخفضة";
  image?: string;
  imageAlt?: string;
  terms?: string[];
  body?: string;
  updatedDate?: Date;
  faqCount?: number;
  draft: boolean;
  path: string;
  supportsUpdatedDate?: boolean;
  supportsFaq?: boolean;
};

export type AuditItem = {
  id: string;
  collection: AuditSource["collection"];
  kind: ContentKind;
  title: string;
  path: string;
  editPath: string;
  score: number;
  draft: boolean;
  noindex: boolean;
  indexingPriority: "عالية" | "عادية" | "منخفضة";
  warnings: string[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonical: string;
  seoTitleLength: number;
  descriptionLength: number;
  contentLength: number;
};
